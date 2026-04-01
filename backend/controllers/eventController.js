// controllers/eventController.js
// CRUD operations for food events — Phase 3: priority engine + urgency scoring
const pool = require('../config/db');
const { haversineDistance } = require('../services/distanceService');
const { sortByUrgency, computeUrgency } = require('../services/priorityService');

/**
 * POST /events
 * Creates a new food event. Only ORGANIZER role.
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
        qty,
        expiry_time,
      ]
    );

    const event = result.rows[0];
    res.status(201).json({ message: 'Event created', event: { ...event, ...computeUrgency(event.expiry_time) } });
  } catch (err) {
    console.error('Create event error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * GET /events
 * Returns all events sorted by urgency (Phase 3 priority engine).
 * Includes request counts instead of booking counts.
 */
const getEvents = async (req, res) => {
  const { mine } = req.query;

  try {
    let query, params = [];

    if (mine === 'true' && req.user.role === 'ORGANIZER') {
      query = `
        SELECT e.*, u.name AS organizer_name,
               COUNT(DISTINCT r.id) AS request_count,
               COUNT(DISTINCT r.id) FILTER (WHERE r.status = 'PENDING')  AS pending_requests,
               COUNT(DISTINCT r.id) FILTER (WHERE r.status = 'APPROVED') AS approved_requests
        FROM events e
        JOIN users u ON e.organizer_id = u.id
        LEFT JOIN requests r ON r.event_id = e.id
        WHERE e.organizer_id = $1
        GROUP BY e.id, u.name
      `;
      params = [req.user.id];
    } else {
      query = `
        SELECT e.*, u.name AS organizer_name,
               COUNT(DISTINCT r.id) AS request_count,
               COUNT(DISTINCT r.id) FILTER (WHERE r.status = 'PENDING')  AS pending_requests,
               COUNT(DISTINCT r.id) FILTER (WHERE r.status = 'APPROVED') AS approved_requests
        FROM events e
        JOIN users u ON e.organizer_id = u.id
        LEFT JOIN requests r ON r.event_id = e.id
        GROUP BY e.id, u.name
      `;
    }

    const result = await pool.query(query, params);
    // Apply priority engine: sort by urgency score (most urgent first)
    const sorted = sortByUrgency(result.rows);
    res.json({ events: sorted });
  } catch (err) {
    console.error('Get events error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * GET /events/nearby
 * Returns events within radius km, sorted by urgency then distance.
 */
const getNearbyEvents = async (req, res) => {
  const { lat, lng, radius } = req.query;

  if (!lat || !lng) {
    return res.status(400).json({ error: 'lat and lng query parameters are required' });
  }

  const userLat  = parseFloat(lat);
  const userLng  = parseFloat(lng);
  const radiusKm = parseFloat(radius) || 10;

  if (isNaN(userLat) || isNaN(userLng)) {
    return res.status(400).json({ error: 'lat and lng must be valid numbers' });
  }

  try {
    const result = await pool.query(
      `SELECT e.*, u.name AS organizer_name,
              COUNT(DISTINCT r.id) AS request_count
       FROM events e
       JOIN users u ON e.organizer_id = u.id
       LEFT JOIN requests r ON r.event_id = e.id
       WHERE e.expiry_time > NOW()
         AND e.remaining_quantity > 0
       GROUP BY e.id, u.name`
    );

    // Filter by radius and attach distance
    const nearby = result.rows
      .map((event) => {
        const dist = haversineDistance(userLat, userLng, parseFloat(event.latitude), parseFloat(event.longitude));
        return { ...event, distance_km: parseFloat(dist.toFixed(2)) };
      })
      .filter((event) => event.distance_km <= radiusKm);

    // Sort by urgency first, then distance
    const sorted = sortByUrgency(nearby);

    res.json({ events: sorted, count: sorted.length, radius_km: radiusKm });
  } catch (err) {
    console.error('Get nearby events error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * GET /events/:id
 * Returns details of a single event including request info.
 */
const getEventById = async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      `SELECT e.*, u.name AS organizer_name, u.email AS organizer_email,
              COUNT(DISTINCT r.id) AS request_count,
              COALESCE(SUM(r.allocated_quantity) FILTER (WHERE r.status = 'APPROVED'), 0) AS total_allocated
       FROM events e
       JOIN users u ON e.organizer_id = u.id
       LEFT JOIN requests r ON r.event_id = e.id
       WHERE e.id = $1
       GROUP BY e.id, u.name, u.email`,
      [id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const event = result.rows[0];
    res.json({ event: { ...event, ...computeUrgency(event.expiry_time) } });
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
    if (!existing.rows.length) return res.status(404).json({ error: 'Event not found' });
    if (existing.rows[0].organizer_id !== organizer_id) {
      return res.status(403).json({ error: 'You can only edit your own events' });
    }

    const event = existing.rows[0];

    let newQty       = quantity ? parseInt(quantity, 10) : null;
    let newRemaining = event.remaining_quantity;

    if (newQty !== null) {
      if (isNaN(newQty) || newQty <= 0) {
        return res.status(400).json({ error: 'quantity must be a positive integer' });
      }
      const delta  = newQty - event.quantity;
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
    if (!existing.rows.length) return res.status(404).json({ error: 'Event not found' });
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
