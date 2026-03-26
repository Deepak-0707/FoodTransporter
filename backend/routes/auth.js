// routes/auth.js
const express = require('express');
const router = express.Router();
const { register, login } = require('../controllers/authController');

// POST /register — create a new user account
router.post('/register', register);

// POST /login — authenticate and receive JWT
router.post('/login', login);

module.exports = router;
