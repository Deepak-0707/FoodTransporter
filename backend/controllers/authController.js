// controllers/authController.js — FoodBridge Phase 4
// Phase 4: adds ASHRAM role + optional lat/lng on registration
const pool    = require('../config/db');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');

const VALID_ROLES = ['ORGANIZER', 'NGO', 'ASHRAM'];

// POST /auth/register
const register = async (req, res) => {
  const { name, email, password, role, latitude, longitude } = req.body;

  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: 'name, email, password, and role are required' });
  }
  if (!VALID_ROLES.includes(role)) {
    return res.status(400).json({ error: `role must be one of: ${VALID_ROLES.join(', ')}` });
  }

  try {
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const lat = latitude  ? parseFloat(latitude)  : null;
    const lng = longitude ? parseFloat(longitude) : null;

    const result = await pool.query(
      `INSERT INTO users (name, email, password, role, latitude, longitude)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, name, email, role, latitude, longitude, created_at`,
      [name, email, hashedPassword, role, lat, lng]
    );

    const user  = result.rows[0];
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({ message: 'Registration successful', token, user });
  } catch (err) {
    console.error('Register error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// POST /auth/login
const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }

  try {
    const result = await pool.query(
      'SELECT id, name, email, password, role, latitude, longitude FROM users WHERE email = $1',
      [email]
    );

    if (!result.rows.length) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = result.rows[0];
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    const { password: _, ...safeUser } = user;
    res.json({ message: 'Login successful', token, user: safeUser });
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// PUT /auth/location — update user's lat/lng for notification targeting
const updateLocation = async (req, res) => {
  const { latitude, longitude } = req.body;
  const user_id = req.user.id;

  if (latitude === undefined || longitude === undefined) {
    return res.status(400).json({ error: 'latitude and longitude are required' });
  }

  const lat = parseFloat(latitude);
  const lng = parseFloat(longitude);

  if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return res.status(400).json({ error: 'Invalid latitude or longitude values' });
  }

  try {
    const result = await pool.query(
      `UPDATE users SET latitude = $1, longitude = $2
       WHERE id = $3
       RETURNING id, name, email, role, latitude, longitude`,
      [lat, lng, user_id]
    );
    res.json({ message: 'Location updated', user: result.rows[0] });
  } catch (err) {
    console.error('Update location error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// GET /auth/me
const getMe = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, email, role, latitude, longitude, created_at FROM users WHERE id = $1',
      [req.user.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'User not found' });
    res.json({ user: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = { register, login, updateLocation, getMe };
