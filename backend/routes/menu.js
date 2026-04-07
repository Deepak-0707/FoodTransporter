// routes/menu.js — FoodBridge Phase 4
const express = require('express');
const router  = express.Router();
const { authenticate, requireRole } = require('../middleware/auth');
const { addMenuItems, getMenuItems } = require('../controllers/menuController');

// All menu routes require authentication
router.use(authenticate);

// POST /events/:id/menu — ORGANIZER adds menu items
router.post('/:id/menu', requireRole('ORGANIZER'), addMenuItems);

// GET /events/:id/menu — any authenticated user can view the menu
router.get('/:id/menu', getMenuItems);

module.exports = router;
