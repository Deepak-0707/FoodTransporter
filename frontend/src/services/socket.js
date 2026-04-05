// src/services/socket.js — FoodBridge Phase 4
// ─────────────────────────────────────────────────────────────
// Singleton Socket.io client.
// Uses VITE_SOCKET_URL so the URL is independently configurable
// from the REST API URL (useful when using a CDN or proxy).
// ─────────────────────────────────────────────────────────────
import { io } from 'socket.io-client';

// Separate env var so Socket.io can target a different host/path
// than the REST API (e.g. when using Vercel rewrites for API only).
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL
  || import.meta.env.VITE_API_URL
  || 'http://localhost:5000';

let socket = null;

/**
 * connectSocket
 * Creates (or returns existing) Socket.io connection.
 * Passes the JWT so the server can authenticate if needed.
 *
 * @param {string} token  JWT from localStorage
 * @returns {Socket}
 */
export const connectSocket = (token) => {
  if (socket?.connected) return socket;

  socket = io(SOCKET_URL, {
    auth:                { token },
    transports:          ['websocket', 'polling'],
    reconnectionAttempts: 5,
    reconnectionDelay:    1000,
  });

  socket.on('connect', () => {
    console.log('[Socket] Connected:', socket.id);
  });

  socket.on('disconnect', (reason) => {
    console.log('[Socket] Disconnected:', reason);
  });

  socket.on('connect_error', (err) => {
    console.warn('[Socket] Connection error:', err.message);
  });

  return socket;
};

/** Disconnect and nullify the singleton. Called on logout. */
export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
    console.log('[Socket] Manually disconnected');
  }
};

/** Returns the current socket instance (may be null before login). */
export const getSocket = () => socket;

// ─── Event name constants ─────────────────────────────────────
// Keep in sync with backend/realtime/socket.js emit helpers.
export const SOCKET_EVENTS = {
  NEW_EVENT:         'NEW_EVENT',
  NEW_NOTIFICATION:  'NEW_NOTIFICATION',
  ALLOCATION_UPDATE: 'ALLOCATION_UPDATE',
  EVENT_UPDATED:     'EVENT_UPDATED',
  EVENT_DELETED:     'EVENT_DELETED',
  MENU_UPDATED:      'MENU_UPDATED',
};
