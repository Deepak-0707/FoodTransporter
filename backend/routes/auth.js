// routes/auth.js — Phase 4
const express = require('express');
const router  = express.Router();
const { authenticate } = require('../middleware/auth');
const { register, login, updateLocation, getMe } = require('../controllers/authController');

router.post('/register', register);
router.post('/login',    login);
router.get('/me',        authenticate, getMe);
router.put('/location',  authenticate, updateLocation);

module.exports = router;
