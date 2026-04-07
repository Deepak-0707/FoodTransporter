require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const http    = require('http');

const authRoutes    = require('./routes/auth');
const eventRoutes   = require('./routes/events');
const bookingRoutes = require('./routes/bookings');
const requestRoutes = require('./routes/requests');
const notificationRoutes = require('./routes/notifications');

// Realtime + services
const { initSocket }                = require('./realtime/socket');
const { runAllocationForAllEvents } = require('./services/allocationService');

const app    = express();
const server = http.createServer(app);
const PORT   = process.env.PORT || 5001;

// ─── Socket.io ───────────────────────────────────────────────
const io = initSocket(server);
app.set('io', io);

// ─── CORS ────────────────────────────────────────────────────
const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS: origin "${origin}" not allowed`));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── Logger ──────────────────────────────────────────────────
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// ─── Health check ────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    phase: 4
  });
});

// ─── Routes ─────────────────────────────────────────────────
app.use('/auth',          authRoutes);
app.use('/events',        eventRoutes);
app.use('/bookings',      bookingRoutes);
app.use('/requests',      requestRoutes);
app.use('/notifications', notificationRoutes);

// ─── 404 Handler ────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// ─── Global Error Handler ───────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

// ─── Background Allocation Job ──────────────────────────────
const ALLOCATION_INTERVAL_MS = 5 * 60 * 1000;

setInterval(async () => {
  console.log('[CronJob] Running allocation...');
  try {
    await runAllocationForAllEvents();
  } catch (err) {
    console.error('[CronJob] Allocation failed:', err.message);
  }
}, ALLOCATION_INTERVAL_MS);

// ─── START SERVER (IMPORTANT FIX) ────────────────────────────
server.listen(PORT, () => {
  console.log(`🚀 FoodBridge API (Phase 4) running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Allocation cron: every ${ALLOCATION_INTERVAL_MS / 60000} minutes`);
});

module.exports = app;