// controllers/notificationController.js
// ============================================================
// FoodBridge Phase 4 — Notification Controller
//
// GET  /notifications       — fetch user's notifications
// POST /notifications/send  — manual dispatch (ORGANIZER only)
// PUT  /notifications/:id/read — mark as read
// ============================================================

const pool                         = require('../config/db');
const { sendNotificationsForEvent } = require('../services/notificationService');

// ─────────────────────────────────────────────────────────────
// GET /notifications
// Returns all notifications for the authenticated user,
// newest first. Supports ?unread=true query filter.
// ─────────────────────────────────────────────────────────────
const getNotifications = async (req, res) => {
  const user_id      = req.user.id;
  const unreadOnly   = req.query.unread === 'true';

  try {
    const result = await pool.query(
      `SELECT n.*, e.title AS event_title, e.expiry_time
       FROM notifications n
       LEFT JOIN events e ON n.event_id = e.id
       WHERE n.user_id = $1
         ${unreadOnly ? 'AND n.read_status = FALSE' : ''}
       ORDER BY n.created_at DESC`,
      [user_id]
    );

    const unreadCount = result.rows.filter((n) => !n.read_status).length;

    res.json({
      notifications: result.rows,
      total: result.rows.length,
      unread_count: unreadCount,
    });
  } catch (err) {
    console.error('Get notifications error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ─────────────────────────────────────────────────────────────
// POST /notifications/send
// Manually dispatch event notifications (ORGANIZER only).
// Body: { event_id, message, radius_km?, top_n? }
// ─────────────────────────────────────────────────────────────
const sendNotification = async (req, res) => {
  const { event_id, message, radius_km, top_n } = req.body;
  const organizer_id = req.user.id;

  if (!event_id || !message) {
    return res.status(400).json({ error: 'event_id and message are required' });
  }

  // Verify the requester owns this event
  const eventCheck = await pool.query(
    `SELECT id, title FROM events WHERE id = $1 AND organizer_id = $2`,
    [event_id, organizer_id]
  );

  if (!eventCheck.rows.length) {
    return res.status(404).json({ error: 'Event not found or access denied' });
  }

  try {
    const result = await sendNotificationsForEvent({
      eventId:  event_id,
      message:  message.trim(),
      radiusKm: radius_km ? parseFloat(radius_km) : undefined,
      topN:     top_n     ? parseInt(top_n, 10)   : undefined,
    });

    res.status(201).json({
      message:   'Notifications dispatched',
      event_id,
      ...result,
    });
  } catch (err) {
    console.error('Send notification error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ─────────────────────────────────────────────────────────────
// PUT /notifications/:id/read
// Mark a notification as read. User can only update their own.
// ─────────────────────────────────────────────────────────────
const markAsRead = async (req, res) => {
  const { id }  = req.params;
  const user_id = req.user.id;

  try {
    const result = await pool.query(
      `UPDATE notifications
       SET read_status = TRUE
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [id, user_id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: 'Notification not found or access denied' });
    }

    res.json({ message: 'Notification marked as read', notification: result.rows[0] });
  } catch (err) {
    console.error('Mark as read error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ─────────────────────────────────────────────────────────────
// PUT /notifications/read-all
// Mark all of the authenticated user's notifications as read.
// ─────────────────────────────────────────────────────────────
const markAllAsRead = async (req, res) => {
  const user_id = req.user.id;

  try {
    const result = await pool.query(
      `UPDATE notifications SET read_status = TRUE
       WHERE user_id = $1 AND read_status = FALSE
       RETURNING id`,
      [user_id]
    );

    res.json({ message: 'All notifications marked as read', updated: result.rowCount });
  } catch (err) {
    console.error('Mark all as read error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = { getNotifications, sendNotification, markAsRead, markAllAsRead };
