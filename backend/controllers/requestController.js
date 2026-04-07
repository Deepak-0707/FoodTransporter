// controllers/requestController.js — FoodBridge Phase 4
// ─────────────────────────────────────────────────────────────

const pool                      = require('../config/db');
const { runAllocationForEvent } = require('../services/allocationService');
const { emitAllocationUpdate }  = require('../realtime/socket');

// ─────────────────────────────────────────────────────────────
// POST /requests
// ─────────────────────────────────────────────────────────────
const createRequest = async (req, res) => {
  const { event_id, quantity_requested, selected_items } = req.body;
  const ngo_id = req.user.id;

  if (!event_id) {
    return res.status(400).json({ error: 'event_id is required' });
  }

  const qty = parseInt(quantity_requested, 10);
  if (!qty || isNaN(qty) || qty <= 0) {
    return res.status(400).json({ error: 'quantity_requested must be a positive integer' });
  }

  if (selected_items && !Array.isArray(selected_items)) {
    return res.status(400).json({ error: 'selected_items must be an array' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const eventResult = await client.query(
      `SELECT id, title, remaining_quantity, expiry_time, organizer_id
       FROM events WHERE id = $1 FOR UPDATE`,
      [event_id]
    );

    if (!eventResult.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Event not found' });
    }

    const event = eventResult.rows[0];

    if (event.organizer_id === ngo_id) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Organizers cannot request food from their own events' });
    }

    if (new Date(event.expiry_time) < new Date()) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'This event has expired' });
    }

    if (event.remaining_quantity === 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'No food remaining' });
    }

    const dupCheck = await client.query(
      `SELECT id, status FROM requests WHERE ngo_id = $1 AND event_id = $2`,
      [ngo_id, event_id]
    );

    if (dupCheck.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'You already requested this event' });
    }

    const colCheck = await client.query(`
      SELECT 1 FROM information_schema.columns
      WHERE table_name='requests' AND column_name='selected_items'
    `);
    const hasSelectedItemsCol = colCheck.rows.length > 0;

    let reqResult;
    if (hasSelectedItemsCol && selected_items && selected_items.length > 0) {
      const itemsJson = JSON.stringify(selected_items);
      reqResult = await client.query(
        `INSERT INTO requests (ngo_id, event_id, quantity_requested, allocated_quantity, status, selected_items)
         VALUES ($1, $2, $3, 0, 'PENDING', $4) RETURNING *`,
        [ngo_id, event_id, qty, itemsJson]
      );
    } else {
      reqResult = await client.query(
        `INSERT INTO requests (ngo_id, event_id, quantity_requested, allocated_quantity, status)
         VALUES ($1, $2, $3, 0, 'PENDING') RETURNING *`,
        [ngo_id, event_id, qty]
      );
    }

    await client.query('COMMIT');

    res.status(201).json({
      message: 'Request submitted successfully',
      request: reqResult.rows[0],
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err.message);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
};

// ─────────────────────────────────────────────────────────────
// GET /requests/my
// ─────────────────────────────────────────────────────────────
const getMyRequests = async (req, res) => {
  const ngo_id = req.user.id;
  try {
    const result = await pool.query(
      `SELECT r.*, e.title FROM requests r
       JOIN events e ON r.event_id = e.id
       WHERE r.ngo_id = $1
       ORDER BY r.created_at DESC`,
      [ngo_id]
    );
    res.json({ requests: result.rows });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ─────────────────────────────────────────────────────────────
// GET /events/:id/requests
// ─────────────────────────────────────────────────────────────
const getEventRequests = async (req, res) => {
  const { id: event_id } = req.params;
  const organizer_id = req.user.id;

  try {
    const eventCheck = await pool.query(
      `SELECT * FROM events WHERE id = $1 AND organizer_id = $2`,
      [event_id, organizer_id]
    );

    if (!eventCheck.rows.length) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const colCheck = await pool.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'requests'
        AND column_name IN ('selected_items', 'allocated_items')
    `);
    const existingCols = new Set(colCheck.rows.map(r => r.column_name));
    const siCol = existingCols.has('selected_items')  ? 'r.selected_items'  : 'NULL AS selected_items';
    const aiCol = existingCols.has('allocated_items') ? 'r.allocated_items' : 'NULL AS allocated_items';

    const result = await pool.query(
      `SELECT r.id, r.ngo_id, r.event_id, r.quantity_requested, r.allocated_quantity,
              r.status, r.note, r.created_at,
              ${siCol}, ${aiCol},
              u.name AS ngo_name, u.email AS ngo_email
       FROM requests r
       JOIN users u ON r.ngo_id = u.id
       WHERE r.event_id = $1
       ORDER BY r.created_at ASC`,
      [event_id]
    );

    const safeParseJSON = (val) => {
      if (!val) return [];
      if (Array.isArray(val)) return val;
      try { return JSON.parse(val); } catch { return []; } // ✅ removed unused _ binding
    };

    const requests = result.rows.map(row => ({
      ...row,
      selected_items: safeParseJSON(row.selected_items),
      allocated_items: safeParseJSON(row.allocated_items),
    }));

    const summary = {
      total_requests: requests.length,
      pending:  requests.filter(r => r.status === 'PENDING').length,
      approved: requests.filter(r => r.status === 'APPROVED').length,
      rejected: requests.filter(r => r.status === 'REJECTED').length,
      total_requested: requests.reduce((s, r) => s + (r.quantity_requested || 0), 0),
      total_allocated: requests.filter(r => r.status === 'APPROVED').reduce((s, r) => s + (r.allocated_quantity || 0), 0),
      food_remaining: eventCheck.rows[0].remaining_quantity,
    };

    res.json({ event: eventCheck.rows[0], requests, summary });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ─────────────────────────────────────────────────────────────
// POST /events/:id/allocate
// ─────────────────────────────────────────────────────────────
const allocateEvent = async (req, res) => {
  const { id: event_id } = req.params;
  const organizer_id = req.user.id;

  try {
    const eventCheck = await pool.query(
      'SELECT id FROM events WHERE id = $1 AND organizer_id = $2',
      [event_id, organizer_id]
    );

    if (!eventCheck.rows.length) {
      return res.status(404).json({ error: 'Access denied' });
    }

    const result = await runAllocationForEvent(event_id);

    try {
      emitAllocationUpdate(event_id, result);
    } catch { // ✅ removed unused _ binding; added body to fix no-empty error
      // Socket emit is non-critical — failure is intentionally ignored
    }

    res.json({ message: 'Allocation completed', ...result });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ─────────────────────────────────────────────────────────────
// PUT /events/:eventId/requests/:requestId
// ─────────────────────────────────────────────────────────────
const updateRequestAllocation = async (req, res) => {
  const { id: event_id, requestId } = req.params;
  const organizer_id = req.user.id;
  const { allocated_quantity, status, allocated_items } = req.body;

  const qty = parseInt(allocated_quantity, 10);

  if (!['APPROVED', 'REJECTED', 'PENDING'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  if (isNaN(qty) || qty < 0) {
    return res.status(400).json({ error: 'Invalid quantity' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const eventCheck = await client.query(
      `SELECT remaining_quantity FROM events WHERE id = $1 AND organizer_id = $2 FOR UPDATE`,
      [event_id, organizer_id]
    );

    if (!eventCheck.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Event not found' });
    }

    const reqCheck = await client.query(
      `SELECT allocated_quantity, status FROM requests WHERE id = $1`,
      [requestId]
    );

    if (!reqCheck.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Request not found' });
    }

    const prev = reqCheck.rows[0];

    const delta =
      (status === 'APPROVED' ? qty : 0) -
      (prev.status === 'APPROVED' ? prev.allocated_quantity : 0);

    const newRemaining = eventCheck.rows[0].remaining_quantity - delta;

    if (newRemaining < 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Not enough food remaining' });
    }

    const colCheck2 = await client.query(`
      SELECT 1 FROM information_schema.columns
      WHERE table_name='requests' AND column_name='allocated_items'
    `);
    const hasAllocItemsCol = colCheck2.rows.length > 0;

    let updated;
    if (hasAllocItemsCol && allocated_items && allocated_items.length > 0) {
      const allocatedItemsJson = JSON.stringify(allocated_items);
      updated = await client.query(
        `UPDATE requests SET allocated_quantity=$1, status=$2, allocated_items=$3 WHERE id=$4 RETURNING *`,
        [status === 'APPROVED' ? qty : 0, status, allocatedItemsJson, requestId]
      );
    } else {
      updated = await client.query(
        `UPDATE requests SET allocated_quantity=$1, status=$2 WHERE id=$3 RETURNING *`,
        [status === 'APPROVED' ? qty : 0, status, requestId]
      );
    }

    await client.query(
      `UPDATE events SET remaining_quantity=$1 WHERE id=$2`,
      [newRemaining, event_id]
    );

    await client.query('COMMIT');

    res.json({ request: updated.rows[0], remaining_quantity: newRemaining });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err.message);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
};

module.exports = {
  createRequest,
  getMyRequests,
  getEventRequests,
  allocateEvent,
  updateRequestAllocation,
};