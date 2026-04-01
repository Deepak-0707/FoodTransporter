// routes/events.js — Phase 3
const express = require('express');
const router  = express.Router();
const { authenticate, requireRole } = require('../middleware/auth');
const {
  createEvent,
  getEvents,
  getNearbyEvents,
  getEventById,
  updateEvent,
  deleteEvent,
} = require('../controllers/eventController');
const { getEventRequests, allocateEvent } = require('../controllers/requestController');

// All event routes require authentication
router.use(authenticate);

// GET /events/nearby — must be before /:id to avoid route collision
router.get('/nearby', getNearbyEvents);

// GET /events — all authenticated users
router.get('/', getEvents);

// GET /events/:id — single event
router.get('/:id', getEventById);

// GET /events/:id/requests — organizer views requests for their event
router.get('/:id/requests', requireRole('ORGANIZER'), getEventRequests);

// POST /events/:id/allocate — organizer manually triggers allocation
router.post('/:id/allocate', requireRole('ORGANIZER'), allocateEvent);

// POST /events — organizer only
router.post('/', requireRole('ORGANIZER'), createEvent);

// PUT /events/:id — organizer only
router.put('/:id', requireRole('ORGANIZER'), updateEvent);

// DELETE /events/:id — organizer only
router.delete('/:id', requireRole('ORGANIZER'), deleteEvent);

module.exports = router;
