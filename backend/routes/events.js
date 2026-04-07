// routes/events.js — FoodBridge Phase 4
// ─────────────────────────────────────────────────────────────
// All routes require authentication. Menu-item subroutes are
// declared here (before module.exports) rather than in a
// separate file to avoid the "dead-code after export" bug that
// silently caused them to never register.
// ─────────────────────────────────────────────────────────────
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
const { getEventRequests, allocateEvent, updateRequestAllocation } = require('../controllers/requestController');
const { getMenuItems, addMenuItem, removeMenuItem } = require('../controllers/menuController');

// Every event route requires a valid JWT
router.use(authenticate);

// ── Read routes ─────────────────────────────────────────────
// /nearby MUST come before /:id to prevent "nearby" being
// treated as a UUID param.
router.get('/nearby', getNearbyEvents);
router.get('/',       getEvents);
router.get('/:id',    getEventById);

// ── Organizer: requests + allocation ────────────────────────
router.get( '/:id/requests', requireRole('ORGANIZER'), getEventRequests);
router.post('/:id/allocate', requireRole('ORGANIZER'), allocateEvent);
router.put( '/:id/requests/:requestId', requireRole('ORGANIZER'), updateRequestAllocation);

// ── Menu items (Phase 4) ─────────────────────────────────────
// Any authenticated user can view a menu; only organizer can modify.
router.get(   '/:id/menu',           getMenuItems);
router.post(  '/:id/menu',           requireRole('ORGANIZER'), addMenuItem);
router.delete('/:id/menu/:itemId',   requireRole('ORGANIZER'), removeMenuItem);

// ── Event CRUD (organizer only) ──────────────────────────────
router.post(  '/',    requireRole('ORGANIZER'), createEvent);
router.put(   '/:id', requireRole('ORGANIZER'), updateEvent);
router.delete('/:id', requireRole('ORGANIZER'), deleteEvent);

module.exports = router;
