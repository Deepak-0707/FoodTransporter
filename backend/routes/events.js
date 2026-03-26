// routes/events.js
const express = require('express');
const router = express.Router();
const { authenticate, requireRole } = require('../middleware/auth');
const {
  createEvent,
  getEvents,
  getEventById,
  updateEvent,
  deleteEvent,
} = require('../controllers/eventController');

// All event routes require authentication
router.use(authenticate);

// GET /events — all authenticated users can view events
router.get('/', getEvents);

// GET /events/:id — view single event details
router.get('/:id', getEventById);

// POST /events — only ORGANIZERs can create events
router.post('/', requireRole('ORGANIZER'), createEvent);

// PUT /events/:id — only ORGANIZERs can update (ownership verified in controller)
router.put('/:id', requireRole('ORGANIZER'), updateEvent);

// DELETE /events/:id — only ORGANIZERs can delete (ownership verified in controller)
router.delete('/:id', requireRole('ORGANIZER'), deleteEvent);

module.exports = router;
