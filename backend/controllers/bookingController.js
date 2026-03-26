const pool = require('../config/db');

/**
 * POST /bookings
 * NGO creates a booking for a specific event.
 * Body: { event_id, quantity_requested }
 *
 * Uses a PostgreSQL transaction with FOR UPDATE to prevent race conditions
 * (overbooking). If remaining_quantity < requested, returns 409 Conflict.
 */
const createBooking = async (req, res) => {
  const { event_id, quantity_requested } = req.body;
  const ngo_id = req.user.id;

  // ─── Input validation ────────────────────────────────────────
  if (!event_id) {
    return res.status(400).json({ error: 'event_id is required' });
  }

  const qty = parseInt(quantity_requested, 10);
  if (!qty || isNaN(qty) || qty <= 0) {
    return res.status(400).json({ error: 'quantity_requested must be a positive integer' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Lock the event row to prevent concurrent overbooking
    const eventResult = await client.query(
      `SELECT id, title, remaining_quantity, expiry_time, organizer_id
       FROM events
       WHERE id = $1
       FOR UPDATE`,
      [event_id]
    );

    if (eventResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Event not found' });
    }

    const event = eventResult.rows[0];

    // Block organizers from booking their own events
    if (event.organizer_id === ngo_id) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Organizers cannot book their own events' });
    }

    // Block bookings for expired events
    if (new Date(event.expiry_time) < new Date()) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'This event has expired and is no longer accepting bookings' });
    }

    // ─── Overbooking guard ───────────────────────────────────────
    if (event.remaining_quantity < qty) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        error: 'Insufficient quantity available',
        available: event.remaining_quantity,
        requested: qty,
      });
    }

    // Deduct from remaining_quantity
    await client.query(
      'UPDATE events SET remaining_quantity = remaining_quantity - $1 WHERE id = $2',
      [qty, event_id]
    );

    // Insert booking record
    const bookingResult = await client.query(
      `INSERT INTO bookings (ngo_id, event_id, quantity_requested)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [ngo_id, event_id, qty]
    );

    await client.query('COMMIT');

    res.status(201).json({
      message: 'Booking confirmed',
      booking: bookingResult.rows[0],
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Create booking error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
};

/**
 * GET /bookings/my
 * Returns all bookings made by the authenticated NGO,
 * joined with event details.
 */
const getMyBookings = async (req, res) => {
  const ngo_id = req.user.id;

  try {
    const result = await pool.query(
      `SELECT
         b.id,
         b.quantity_requested,
         b.status,
         b.created_at,
         e.id            AS event_id,
         e.title         AS event_title,
         e.description   AS event_description,
         e.latitude,
         e.longitude,
         e.quantity      AS event_total_quantity,
         e.quantity_unit,
         e.remaining_quantity,
         e.expiry_time,
         u.name          AS organizer_name,
         u.email         AS organizer_email
       FROM bookings b
       JOIN events e ON b.event_id = e.id
       JOIN users  u ON e.organizer_id = u.id
       WHERE b.ngo_id = $1
       ORDER BY b.created_at DESC`,
      [ngo_id]
    );

    res.json({ bookings: result.rows });
  } catch (err) {
    console.error('Get my bookings error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * GET /events/:id/bookings
 * Returns all bookings for a specific event.
 * Only the event's organizer can view this.
 */
const getEventBookings = async (req, res) => {
  const { id: event_id } = req.params;
  const organizer_id = req.user.id;

  try {
    // Verify event ownership
    const eventCheck = await pool.query(
      'SELECT id, title FROM events WHERE id = $1 AND organizer_id = $2',
      [event_id, organizer_id]
    );

    if (eventCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found or access denied' });
    }

    const result = await pool.query(
      `SELECT
         b.id,
         b.quantity_requested,
         b.status,
         b.created_at,
         u.id    AS ngo_id,
         u.name  AS ngo_name,
         u.email AS ngo_email
       FROM bookings b
       JOIN users u ON b.ngo_id = u.id
       WHERE b.event_id = $1
       ORDER BY b.created_at ASC`,
      [event_id]
    );

    res.json({
      event: eventCheck.rows[0],
      bookings: result.rows,
      total_booked: result.rows.reduce((sum, b) => sum + b.quantity_requested, 0),
    });
  } catch (err) {
    console.error('Get event bookings error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = { createBooking, getMyBookings, getEventBookings };
