const pool = require('../config/db');
const { haversineDistance } = require('../services/distanceService');

/**
 * POST /events
 * Creates a new food event. Only ORGANIZER role.
 * Body: { title, description, latitude, longitude, quantity, quantity_unit, expiry_time }
 */
const createEvent = async (req, res) => {
  const { title, description, latitude, longitude, quantity, quantity_unit, expiry_time } = req.body;
  const organizer_id = req.user.id;

  if (!title || !latitude || !longitude || !quantity || !expiry_time) {
    return res.status(400).json({ error: 'title, latitude, longitude, quantity, and expiry_time are required' });
  }

  const qty = parseInt(quantity, 10);
  if (isNaN(qty) || qty <= 0) {
    return res.status(400).json({ error: 'quantity must be a positive integer' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO events
         (organizer_id, title, description, latitude, longitude, quantity, quantity_unit, remaining_quantity, expiry_time)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        organizer_id,
        title,
        description || '',
        parseFloat(latitude),
        parseFloat(longitude),
        qty,
        quantity_unit || 'kg',
        qty,           // remaining_quantity starts equal to total quantity
        expiry_time,
      ]
    );

    res.status(201).json({ message: 'Event created', event: result.rows[0] });
  } catch (err) {
    console.error('Create event error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * GET /events
 * Returns all events (or organizer's own if ?mine=true).
 * Includes remaining_quantity and booking count.
 */
const getEvents = async (req, res) => {
  const { mine } = req.query;

  try {
    let query, params = [];

    if (mine === 'true' && req.user.role === 'ORGANIZER') {
      query = `
        SELECT e.*, u.name AS organizer_name,
               COUNT(b.id) AS booking_count
        FROM events e
        JOIN users u ON e.organizer_id = u.id
        LEFT JOIN bookings b ON b.event_id = e.id
        WHERE e.organizer_id = $1
        GROUP BY e.id, u.name
        ORDER BY e.created_at DESC
      `;
      params = [req.user.id];
    } else {
      query = `
        SELECT e.*, u.name AS organizer_name,
               COUNT(b.id) AS booking_count
        FROM events e
        JOIN users u ON e.organizer_id = u.id
        LEFT JOIN bookings b ON b.event_id = e.id
        GROUP BY e.id, u.name
        ORDER BY e.expiry_time ASC
      `;
    }

    const result = await pool.query(query, params);
    res.json({ events: result.rows });
  } catch (err) {
    console.error('Get events error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * GET /events/nearby?lat=...&lng=...&radius=...
 * Returns events within radius km of the given coordinates.
 * Uses Haversine calculation in JS after fetching all active events.
 */
const getNearbyEvents = async (req, res) => {
  const { lat, lng, radius } = req.query;

  if (!lat || !lng) {
    return res.status(400).json({ error: 'lat and lng query parameters are required' });
  }

  const userLat    = parseFloat(lat);
  const userLng    = parseFloat(lng);
  const radiusKm   = parseFloat(radius) || 10; // default 10 km

  if (isNaN(userLat) || isNaN(userLng)) {
    return res.status(400).json({ error: 'lat and lng must be valid numbers' });
  }

  try {
    // Fetch all non-expired, non-empty events
    const result = await pool.query(
      `SELECT e.*, u.name AS organizer_name,
              COUNT(b.id) AS booking_count
       FROM events e
       JOIN users u ON e.organizer_id = u.id
       LEFT JOIN bookings b ON b.event_id = e.id
       WHERE e.expiry_time > NOW()
         AND e.remaining_quantity > 0
       GROUP BY e.id, u.name
       ORDER BY e.expiry_time ASC`
    );

    // Apply Haversine filter in JS
    const nearby = result.rows
      .map((event) => {
        const dist = haversineDistance(
          userLat,
          userLng,
          parseFloat(event.latitude),
          parseFloat(event.longitude)
        );
        return { ...event, distance_km: parseFloat(dist.toFixed(2)) };
      })
      .filter((event) => event.distance_km <= radiusKm)
      .sort((a, b) => a.distance_km - b.distance_km);

    res.json({ events: nearby, count: nearby.length, radius_km: radiusKm });
  } catch (err) {
    console.error('Get nearby events error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * GET /events/:id
 * Returns details of a single event including booking info.
 */
const getEventById = async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      `SELECT e.*, u.name AS organizer_name, u.email AS organizer_email,
              COUNT(b.id) AS booking_count,
              COALESCE(SUM(b.quantity_requested), 0) AS total_booked
       FROM events e
       JOIN users u ON e.organizer_id = u.id
       LEFT JOIN bookings b ON b.event_id = e.id AND b.status = 'confirmed'
       WHERE e.id = $1
       GROUP BY e.id, u.name, u.email`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }

    res.json({ event: result.rows[0] });
  } catch (err) {
    console.error('Get event error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * PUT /events/:id
 * Updates an existing event. Only the event's organizer can update.
 */
const updateEvent = async (req, res) => {
  const { id } = req.params;
  const { title, description, latitude, longitude, quantity, quantity_unit, expiry_time } = req.body;
  const organizer_id = req.user.id;

  try {
    const existing = await pool.query('SELECT * FROM events WHERE id = $1', [id]);
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Event not found' });
    if (existing.rows[0].organizer_id !== organizer_id) {
      return res.status(403).json({ error: 'You can only edit your own events' });
    }

    const event = existing.rows[0];

    // If quantity is updated, adjust remaining_quantity proportionally
    let newQty = quantity ? parseInt(quantity, 10) : null;
    let newRemaining = event.remaining_quantity;

    if (newQty !== null) {
      if (isNaN(newQty) || newQty <= 0) {
        return res.status(400).json({ error: 'quantity must be a positive integer' });
      }
      // Difference in total quantity; cap remaining at new total
      const delta = newQty - event.quantity;
      newRemaining = Math.max(0, Math.min(event.remaining_quantity + delta, newQty));
    }

    const result = await pool.query(
      `UPDATE events
       SET title              = COALESCE($1, title),
           description        = COALESCE($2, description),
           latitude           = COALESCE($3, latitude),
           longitude          = COALESCE($4, longitude),
           quantity           = COALESCE($5, quantity),
           quantity_unit      = COALESCE($6, quantity_unit),
           remaining_quantity = $7,
           expiry_time        = COALESCE($8, expiry_time)
       WHERE id = $9
       RETURNING *`,
      [
        title,
        description,
        latitude ? parseFloat(latitude) : null,
        longitude ? parseFloat(longitude) : null,
        newQty,
        quantity_unit || null,
        newRemaining,
        expiry_time,
        id,
      ]
    );

    res.json({ message: 'Event updated', event: result.rows[0] });
  } catch (err) {
    console.error('Update event error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * DELETE /events/:id
 * Deletes an event. Only the event's organizer.
 */
const deleteEvent = async (req, res) => {
  const { id } = req.params;
  const organizer_id = req.user.id;

  try {
    const existing = await pool.query('SELECT * FROM events WHERE id = $1', [id]);
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Event not found' });
    if (existing.rows[0].organizer_id !== organizer_id) {
      return res.status(403).json({ error: 'You can only delete your own events' });
    }

    await pool.query('DELETE FROM events WHERE id = $1', [id]);
    res.json({ message: 'Event deleted successfully' });
  } catch (err) {
    console.error('Delete event error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = { createEvent, getEvents, getNearbyEvents, getEventById, updateEvent, deleteEvent };
