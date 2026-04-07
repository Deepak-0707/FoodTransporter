// routes/requests.js — Phase 4
const express = require('express');
const router  = express.Router();
const { authenticate, requireRole } = require('../middleware/auth');
const { createRequest, getMyRequests } = require('../controllers/requestController');

router.use(authenticate);

// NGOs and ASHRAMs can both request food
router.post('/', requireRole(['NGO', 'ASHRAM']), createRequest);
router.get('/my', requireRole(['NGO', 'ASHRAM']), getMyRequests);

module.exports = router;
