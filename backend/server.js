require('dotenv').config();
const express = require('express');
const cors    = require('cors');

const authRoutes    = require('./routes/auth');
const eventRoutes   = require('./routes/events');
const bookingRoutes = require('./routes/bookings');
const requestRoutes = require('./routes/requests');

const app  = express();
const PORT = process.env.PORT || 5001;

// ─── Middleware ──────────────────────────────────────────────
app.use(cors({
  origin: process.env.CLIENT_URL || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// ─── Routes ─────────────────────────────────────────────────
app.use('/auth',     authRoutes);
app.use('/events',   eventRoutes);
app.use('/bookings', bookingRoutes);
app.use('/requests', requestRoutes);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), phase: 2 });
});

// ─── 404 Handler ────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// ─── Global Error Handler ───────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

// ─── Background Allocation Job (cron simulation) ────────────
// Runs every 5 minutes to catch any missed allocations.
// In production, replace with a proper cron service or pg_cron.
const ALLOCATION_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

setInterval(async () => {
  console.log('[CronJob] Running scheduled allocation sweep...');
  try {
    await runAllocationForAllEvents();
  } catch (err) {
    console.error('[CronJob] Scheduled allocation failed:', err.message);
  }
}, ALLOCATION_INTERVAL_MS);

app.listen(PORT, () => {
  console.log(`🚀 FoodBridge API (Phase 3) running on port ${PORT}`);
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`   Allocation cron: every ${ALLOCATION_INTERVAL_MS / 60000} minutes`);
});

module.exports = app;
