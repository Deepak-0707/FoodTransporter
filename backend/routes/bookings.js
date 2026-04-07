const express = require('express');
const router  = express.Router();
const { authenticate, requireRole } = require('../middleware/auth');
const { createBooking, getMyBookings } = require('../controllers/bookingController'); // ✅ removed unused getEventBookings

// All booking routes require authentication
router.use(authenticate);

// POST /bookings — NGO creates a booking
router.post('/', requireRole('NGO'), createBooking);

// GET /bookings/my — NGO views their own bookings
router.get('/my', requireRole('NGO'), getMyBookings);

module.exports = router;