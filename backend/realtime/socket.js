// realtime/socket.js
// ============================================================
// FoodBridge Phase 4 — Socket.io Setup
//
// Singleton pattern: attach once in server.js, then import
// getIO() anywhere to emit events without circular deps.
//
// Emitted events:
//   NEW_EVENT         — broadcast when organizer creates an event
//   NEW_NOTIFICATION  — sent to individual user room on notify
//   ALLOCATION_UPDATE — sent to event room on allocation complete
// ============================================================

const { Server } = require('socket.io');

let io = null;

/**
 * initSocket
 * ----------
 * Attaches Socket.io to the HTTP server. Called once in server.js.
 *
 * @param {http.Server} httpServer
 * @returns {Server} the io instance
 */
function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL || '*',
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket) => {
    console.log(`[Socket.io] Client connected: ${socket.id}`);

    // ── Room: user-specific notifications ───────────────────
    // Clients join their own user room so we can emit to a
    // specific user without broadcasting to all.
    socket.on('JOIN_USER_ROOM', (userId) => {
      if (userId) {
        socket.join(`user:${userId}`);
        console.log(`[Socket.io] ${socket.id} joined room user:${userId}`);
      }
    });

    // ── Room: event-specific updates ────────────────────────
    // Clients watching an event detail page join the event room.
    socket.on('JOIN_EVENT_ROOM', (eventId) => {
      if (eventId) {
        socket.join(`event:${eventId}`);
        console.log(`[Socket.io] ${socket.id} joined room event:${eventId}`);
      }
    });

    socket.on('LEAVE_EVENT_ROOM', (eventId) => {
      if (eventId) socket.leave(`event:${eventId}`);
    });

    socket.on('disconnect', () => {
      console.log(`[Socket.io] Client disconnected: ${socket.id}`);
    });
  });

  return io;
}

/**
 * getIO
 * -----
 * Returns the initialised Socket.io server.
 * Throws if called before initSocket().
 *
 * @returns {Server}
 */
function getIO() {
  if (!io) throw new Error('Socket.io not initialised. Call initSocket(httpServer) first.');
  return io;
}

// ─── Emit helpers ────────────────────────────────────────────

/**
 * Broadcast a new event to ALL connected clients.
 * Triggered by createEvent controller.
 *
 * @param {object} event - full event row from DB
 */
function emitNewEvent(event) {
  getIO().emit('NEW_EVENT', { event });
  console.log(`[Socket.io] NEW_EVENT emitted for event ${event.id}`);
}

/**
 * Send a notification to a specific user room.
 * Triggered by notificationService after DB insert.
 *
 * @param {string} userId
 * @param {object} notification - full notification row from DB
 */
function emitNewNotification(userId, notification) {
  getIO().to(`user:${userId}`).emit('NEW_NOTIFICATION', { notification });
  console.log(`[Socket.io] NEW_NOTIFICATION emitted to user:${userId}`);
}

/**
 * Broadcast allocation results to the event room.
 * Triggered after runAllocationForEvent completes.
 *
 * @param {string} eventId
 * @param {object} allocationResult - { allocated, results }
 */
function emitAllocationUpdate(eventId, allocationResult) {
  getIO().to(`event:${eventId}`).emit('ALLOCATION_UPDATE', {
    event_id: eventId,
    ...allocationResult,
  });
  console.log(`[Socket.io] ALLOCATION_UPDATE emitted for event ${eventId}`);
}

module.exports = { initSocket, getIO, emitNewEvent, emitNewNotification, emitAllocationUpdate };
