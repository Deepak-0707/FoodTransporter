// routes/notifications.js — FoodBridge Phase 4
const express = require('express');
const router  = express.Router();
const { authenticate, requireRole } = require('../middleware/auth');
const {
  getNotifications,
  sendNotification,
  markAsRead,
  markAllAsRead,
} = require('../controllers/notificationController');

router.use(authenticate);

// GET  /notifications             — authenticated user fetches their notifications
router.get('/', getNotifications);

// POST /notifications/send        — ORGANIZER dispatches to nearby NGOs/ASHRAMs
router.post('/send', requireRole('ORGANIZER'), sendNotification);

// PUT  /notifications/read-all    — mark all as read (must be before /:id)
router.put('/read-all', markAllAsRead);

// PUT  /notifications/:id/read    — mark one as read
router.put('/:id/read', markAsRead);

module.exports = router;
