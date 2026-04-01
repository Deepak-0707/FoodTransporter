// routes/requests.js — Phase 3
const express = require('express');
const router  = express.Router();
const { authenticate, requireRole } = require('../middleware/auth');
const {
  createRequest,
  getMyRequests,
} = require('../controllers/requestController');

// All request routes require authentication
router.use(authenticate);

// POST /requests — NGO submits a food request
router.post('/', requireRole('NGO'), createRequest);

// GET /requests/my — NGO views their own requests and allocation status
router.get('/my', requireRole('NGO'), getMyRequests);

module.exports = router;
