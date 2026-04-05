// controllers/menuController.js
// ============================================================
// FoodBridge Phase 4 — Menu Items Controller
// ============================================================

const pool = require('../config/db');
const { computeMenuItemPriority, sortMenuItemsByPriority } = require('../services/priorityService');
const { sendUrgentFoodAlert } = require('../services/notificationService');

// ─────────────────────────────────────────────────────────────
// POST /events/:id/menu
// Add one or more menu items
// ─────────────────────────────────────────────────────────────
const addMenuItem = async (req, res) => {
  const { id: event_id } = req.params;
  const organizer_id = req.user.id;

  const rawItems = Array.isArray(req.body.items) ? req.body.items : [req.body];

  if (!rawItems.length || !rawItems[0].name) {
    return res.status(400).json({
      error: 'Provide items array with { name, quantity, waste_time_minutes }',
    });
  }

  for (const item of rawItems) {
    if (!item.name || !item.quantity || !item.waste_time_minutes) {
      return res.status(400).json({
        error: 'Each item needs name, quantity, waste_time_minutes',
      });
    }
    if (parseInt(item.quantity) <= 0) {
      return res.status(400).json({ error: `Invalid quantity for ${item.name}` });
    }
    if (parseInt(item.waste_time_minutes) <= 0) {
      return res.status(400).json({ error: `Invalid waste time for ${item.name}` });
    }
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const eventCheck = await client.query(
      `SELECT id, title FROM events WHERE id = $1 AND organizer_id = $2`,
      [event_id, organizer_id]
    );

    if (!eventCheck.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Event not found or access denied' });
    }

    const eventTitle = eventCheck.rows[0].title;
    const inserted = [];

    for (const item of rawItems) {
      const qty = parseInt(item.quantity);
      const wt = parseInt(item.waste_time_minutes);

      const { urgencyLabel } = computeMenuItemPriority(wt);

      const result = await client.query(
        `INSERT INTO menu_items (event_id, name, quantity, quantity_unit, waste_time_minutes)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [event_id, item.name.trim(), qty, item.quantity_unit || 'kg', wt]
      );

      const newItem = result.rows[0];

      inserted.push({ ...newItem, urgency_label: urgencyLabel });
    }

    await client.query('COMMIT');

    // Notify if critical
    const criticalItems = inserted.filter(i => i.urgency_label === 'CRITICAL');

    for (const item of criticalItems) {
      try {
        await sendUrgentFoodAlert(item, eventTitle);
      } catch (err) {
        console.error('Notification failed:', err.message);
      }
    }

    res.status(201).json({
      message: `${inserted.length} item(s) added`,
      menuItem: inserted[0],   // single-item convenience (used by EventDetails)
      menuItems: inserted,     // bulk convenience
    });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Add menu error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
};

// ─────────────────────────────────────────────────────────────
// GET /events/:id/menu
// ─────────────────────────────────────────────────────────────
const getMenuItems = async (req, res) => {
  const { id: event_id } = req.params;

  try {
    const eventCheck = await pool.query(
      `SELECT id, title FROM events WHERE id = $1`,
      [event_id]
    );

    if (!eventCheck.rows.length) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const result = await pool.query(
      `SELECT * FROM menu_items WHERE event_id = $1`,
      [event_id]
    );

    const items = result.rows.map(item => {
      const { urgencyLabel } = computeMenuItemPriority(item.waste_time_minutes);
      return { ...item, urgency_label: urgencyLabel };
    });

    // Sort by waste_time_minutes ascending (least time = highest urgency first)
    const sorted = items.sort((a, b) =>
      (a.waste_time_minutes || 9999) - (b.waste_time_minutes || 9999)
    );

    res.json({
      event: eventCheck.rows[0],
      menuItems: sorted,
      count: sorted.length,
    });

  } catch (err) {
    console.error('Get menu error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ─────────────────────────────────────────────────────────────
// DELETE /events/:id/menu/:itemId
// ─────────────────────────────────────────────────────────────
const removeMenuItem = async (req, res) => {
  const { id: event_id, itemId } = req.params;
  const organizer_id = req.user.id;

  try {
    const result = await pool.query(
      `DELETE FROM menu_items
       WHERE id = $1
       AND event_id = $2
       AND EXISTS (
         SELECT 1 FROM events
         WHERE id = $2 AND organizer_id = $3
       )
       RETURNING *`,
      [itemId, event_id, organizer_id]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        error: 'Item not found or access denied',
      });
    }

    res.json({
      message: 'Menu item removed',
      item: result.rows[0],
    });

  } catch (err) {
    console.error('Delete menu error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ─────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────
module.exports = {
  addMenuItem,
  getMenuItems,
  removeMenuItem,
};