// controllers/eventController.js
// CRUD operations for food events
const pool = require('../config/db');

/**
 * POST /events
 * Creates a new food event. Only ORGANIZER role can call this.
 * Body: { title, description, latitude, longitude, quantity, expiry_time }
 */
const createEvent = async (req, res) => {
  const { title, description, latitude, longitude, quantity, expiry_time } = req.body;
  const organizer_id = req.user.id;

  if (!title || !latitude || !longitude || !quantity || !expiry_time) {
    return res.status(400).json({ error: 'title, latitude, longitude, quantity, and expiry_time are required' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO events (organizer_id, title, description, latitude, longitude, quantity, expiry_time)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [organizer_id, title, description || '', parseFloat(latitude), parseFloat(longitude), quantity, expiry_time]
    );

    res.status(201).json({ message: 'Event created', event: result.rows[0] });
  } catch (err) {
    console.error('Create event error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * GET /events
 * Returns all events. Accessible by both ORGANIZER and NGO.
 * Organizers also get filtered view via query param ?mine=true
 */
const getEvents = async (req, res) => {
  const { mine } = req.query;

  try {
    let query;
    let params = [];

    if (mine === 'true' && req.user.role === 'ORGANIZER') {
      // Return only this organizer's events
      query = `
        SELECT e.*, u.name AS organizer_name
        FROM events e
        JOIN users u ON e.organizer_id = u.id
        WHERE e.organizer_id = $1
        ORDER BY e.created_at DESC
      `;
      params = [req.user.id];
    } else {
      // Return all events with organizer name
      query = `
        SELECT e.*, u.name AS organizer_name
        FROM events e
        JOIN users u ON e.organizer_id = u.id
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
 * GET /events/:id
 * Returns details of a single event.
 */
const getEventById = async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      `SELECT e.*, u.name AS organizer_name, u.email AS organizer_email
       FROM events e
       JOIN users u ON e.organizer_id = u.id
       WHERE e.id = $1`,
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
 * Updates an existing event. Only the event's organizer can update it.
 */
const updateEvent = async (req, res) => {
  const { id } = req.params;
  const { title, description, latitude, longitude, quantity, expiry_time } = req.body;
  const organizer_id = req.user.id;

  try {
    // Verify ownership
    const existing = await pool.query('SELECT * FROM events WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }
    if (existing.rows[0].organizer_id !== organizer_id) {
      return res.status(403).json({ error: 'You can only edit your own events' });
    }

    const result = await pool.query(
      `UPDATE events
       SET title = COALESCE($1, title),
           description = COALESCE($2, description),
           latitude = COALESCE($3, latitude),
           longitude = COALESCE($4, longitude),
           quantity = COALESCE($5, quantity),
           expiry_time = COALESCE($6, expiry_time)
       WHERE id = $7
       RETURNING *`,
      [title, description, latitude ? parseFloat(latitude) : null, longitude ? parseFloat(longitude) : null, quantity, expiry_time, id]
    );

    res.json({ message: 'Event updated', event: result.rows[0] });
  } catch (err) {
    console.error('Update event error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * DELETE /events/:id
 * Deletes an event. Only the event's organizer can delete it.
 */
const deleteEvent = async (req, res) => {
  const { id } = req.params;
  const organizer_id = req.user.id;

  try {
    // Verify ownership
    const existing = await pool.query('SELECT * FROM events WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }
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

module.exports = { createEvent, getEvents, getEventById, updateEvent, deleteEvent };
