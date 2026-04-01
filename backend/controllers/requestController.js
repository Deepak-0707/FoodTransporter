// controllers/requestController.js
// ============================================================
// FoodBridge Phase 3 — Request & Allocation Controllers
//
// Replaces bookingController. NGOs submit requests; the system
// allocates food intelligently rather than first-come-first-served.
// ============================================================

const pool = require('../config/db');
const { runAllocationForEvent } = require('../services/allocationService');

// ─────────────────────────────────────────────────────────────
// POST /requests
// NGO submits a food request for an event.
// Triggers allocation automatically after the request is created.
// Body: { event_id, quantity_requested }
// ─────────────────────────────────────────────────────────────
const createRequest = async (req, res) => {
  const { event_id, quantity_requested } = req.body;
  const ngo_id = req.user.id;

  // Input validation
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

    // Lock event row to check state before inserting
    const eventResult = await client.query(
      `SELECT id, title, remaining_quantity, expiry_time, organizer_id
       FROM events
       WHERE id = $1
       FOR UPDATE`,
      [event_id]
    );

    if (!eventResult.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Event not found' });
    }

    const event = eventResult.rows[0];

    // Organizers cannot request from their own events
    if (event.organizer_id === ngo_id) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Organizers cannot request food from their own events' });
    }

    // Block requests for expired events
    if (new Date(event.expiry_time) < new Date()) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'This event has expired and is no longer accepting requests' });
    }

    // Block requests for events with zero remaining food
    if (event.remaining_quantity === 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'No food remaining for this event' });
    }

    // Prevent duplicate PENDING requests from the same NGO for the same event
    const dupCheck = await client.query(
      `SELECT id FROM requests
       WHERE ngo_id = $1 AND event_id = $2 AND status = 'PENDING'`,
      [ngo_id, event_id]
    );

    if (dupCheck.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        error: 'You already have a pending request for this event. Cancel it first to submit a new one.',
      });
    }

    // Insert the request with PENDING status
    const reqResult = await client.query(
      `INSERT INTO requests (ngo_id, event_id, quantity_requested, allocated_quantity, status)
       VALUES ($1, $2, $3, 0, 'PENDING')
       RETURNING *`,
      [ngo_id, event_id, qty]
    );

    await client.query('COMMIT');

    const request = reqResult.rows[0];

    // ── Auto-trigger allocation after new request ──────────────
    // Run outside the transaction so partial failures don't roll back the request
    let allocationResult = null;
    try {
      allocationResult = await runAllocationForEvent(event_id);
    } catch (allocErr) {
      // Non-fatal: request is saved, allocation can be retried manually
      console.error('[createRequest] Auto-allocation failed:', allocErr.message);
    }

    res.status(201).json({
      message:    'Request submitted successfully',
      request,
      allocation: allocationResult,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Create request error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
};

// ─────────────────────────────────────────────────────────────
// GET /requests/my
// Returns all requests made by the authenticated NGO,
// joined with event details.
// ─────────────────────────────────────────────────────────────
const getMyRequests = async (req, res) => {
  const ngo_id = req.user.id;

  try {
    const result = await pool.query(
      `SELECT
         r.id,
         r.quantity_requested,
         r.allocated_quantity,
         r.status,
         r.created_at,
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
       FROM requests r
       JOIN events e ON r.event_id = e.id
       JOIN users  u ON e.organizer_id = u.id
       WHERE r.ngo_id = $1
       ORDER BY r.created_at DESC`,
      [ngo_id]
    );

    res.json({ requests: result.rows });
  } catch (err) {
    console.error('Get my requests error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ─────────────────────────────────────────────────────────────
// GET /events/:id/requests
// Returns all requests for a specific event.
// Only the event's organizer can view this.
// ─────────────────────────────────────────────────────────────
const getEventRequests = async (req, res) => {
  const { id: event_id } = req.params;
  const organizer_id     = req.user.id;

  try {
    // Verify event ownership
    const eventCheck = await pool.query(
      `SELECT id, title, quantity, quantity_unit, remaining_quantity, expiry_time
       FROM events
       WHERE id = $1 AND organizer_id = $2`,
      [event_id, organizer_id]
    );

    if (!eventCheck.rows.length) {
      return res.status(404).json({ error: 'Event not found or access denied' });
    }

    const event = eventCheck.rows[0];

    const result = await pool.query(
      `SELECT
         r.id,
         r.quantity_requested,
         r.allocated_quantity,
         r.status,
         r.created_at,
         u.id    AS ngo_id,
         u.name  AS ngo_name,
         u.email AS ngo_email
       FROM requests r
       JOIN users u ON r.ngo_id = u.id
       WHERE r.event_id = $1
       ORDER BY r.created_at ASC`,
      [event_id]
    );

    const requests = result.rows;

    // Distribution summary for organizer dashboard
    const summary = {
      total_requests:   requests.length,
      pending:          requests.filter((r) => r.status === 'PENDING').length,
      approved:         requests.filter((r) => r.status === 'APPROVED').length,
      rejected:         requests.filter((r) => r.status === 'REJECTED').length,
      total_requested:  requests.reduce((s, r) => s + parseInt(r.quantity_requested), 0),
      total_allocated:  requests.reduce((s, r) => s + parseInt(r.allocated_quantity), 0),
      food_remaining:   parseInt(event.remaining_quantity),
    };

    res.json({ event, requests, summary });
  } catch (err) {
    console.error('Get event requests error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ─────────────────────────────────────────────────────────────
// POST /events/:id/allocate
// Manually triggers the allocation algorithm for an event.
// Only the event's organizer can call this.
// ─────────────────────────────────────────────────────────────
const allocateEvent = async (req, res) => {
  const { id: event_id } = req.params;
  const organizer_id     = req.user.id;

  try {
    // Verify event ownership
    const eventCheck = await pool.query(
      'SELECT id, title FROM events WHERE id = $1 AND organizer_id = $2',
      [event_id, organizer_id]
    );

    if (!eventCheck.rows.length) {
      return res.status(404).json({ error: 'Event not found or access denied' });
    }

    const result = await runAllocationForEvent(event_id);

    res.json({
      message:    'Allocation completed',
      event_id,
      event_title: eventCheck.rows[0].title,
      ...result,
    });
  } catch (err) {
    console.error('Allocate event error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = { createRequest, getMyRequests, getEventRequests, allocateEvent };
