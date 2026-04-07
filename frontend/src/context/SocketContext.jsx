// src/context/SocketContext.jsx — FoodBridge Phase 4
// ─────────────────────────────────────────────────────────────
// Manages the Socket.io lifecycle tied to the auth state.
// Key fix: after connecting, JOIN_USER_ROOM is emitted so the
// server can deliver targeted per-user notifications.
// ─────────────────────────────────────────────────────────────
import React, { createContext, useContext, useEffect, useState } from 'react';
import { connectSocket, disconnectSocket, getSocket, SOCKET_EVENTS } from '../services/socket';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const { user, token } = useAuth();
  const [connected, setConnected] = useState(false);
  const [lastEvent, setLastEvent]  = useState(null);

  useEffect(() => {
    if (!user || !token) {
      disconnectSocket();
      setConnected(false);
      return;
    }

    const socket = connectSocket(token);

    const onConnect = () => {
      setConnected(true);
      // ── Critical: join the per-user room so targeted
      //    NEW_NOTIFICATION events reach this client. ──
      if (user?.id) {
        socket.emit('JOIN_USER_ROOM', user.id);
        console.log('[Socket] Joined user room:', user.id);
      }
    };

    const onDisconnect = () => setConnected(false);

    // Generic tracker — consumers can watch lastEvent to react to
    // global broadcasts without wiring individual socket listeners.
    const track = (type) => (data) =>
      setLastEvent({ type, data, ts: Date.now() });

    socket.on('connect',                          onConnect);
    socket.on('disconnect',                       onDisconnect);
    socket.on(SOCKET_EVENTS.NEW_EVENT,         track(SOCKET_EVENTS.NEW_EVENT));
    socket.on(SOCKET_EVENTS.ALLOCATION_UPDATE, track(SOCKET_EVENTS.ALLOCATION_UPDATE));
    socket.on(SOCKET_EVENTS.EVENT_UPDATED,     track(SOCKET_EVENTS.EVENT_UPDATED));
    socket.on(SOCKET_EVENTS.EVENT_DELETED,     track(SOCKET_EVENTS.EVENT_DELETED));
    socket.on(SOCKET_EVENTS.MENU_UPDATED,      track(SOCKET_EVENTS.MENU_UPDATED));

    // If already connected when this effect runs (e.g. token refresh)
    if (socket.connected) onConnect();

    return () => {
      socket.off('connect',                          onConnect);
      socket.off('disconnect',                       onDisconnect);
      socket.off(SOCKET_EVENTS.NEW_EVENT);
      socket.off(SOCKET_EVENTS.ALLOCATION_UPDATE);
      socket.off(SOCKET_EVENTS.EVENT_UPDATED);
      socket.off(SOCKET_EVENTS.EVENT_DELETED);
      socket.off(SOCKET_EVENTS.MENU_UPDATED);
      // Don't call disconnectSocket here — only disconnect on logout
    };
  }, [user, token]);

  return (
    <SocketContext.Provider value={{ connected, lastEvent, socket: getSocket() }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error('useSocket must be used within <SocketProvider>');
  return ctx;
};
