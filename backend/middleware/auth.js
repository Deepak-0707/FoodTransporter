// middleware/auth.js — FoodBridge Phase 4
const jwt = require('jsonwebtoken');

const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization token missing or malformed' });
  }
  const token = authHeader.split(' ')[1];
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

// Phase 4: requireRole accepts a single role string OR an array of roles
// e.g. requireRole('ORGANIZER') or requireRole(['NGO', 'ASHRAM'])
const requireRole = (roles) => (req, res, next) => {
  const allowed = Array.isArray(roles) ? roles : [roles];
  if (!allowed.includes(req.user.role)) {
    return res.status(403).json({ error: `Access denied. Required role(s): ${allowed.join(', ')}` });
  }
  next();
};

module.exports = { authenticate, requireRole };
