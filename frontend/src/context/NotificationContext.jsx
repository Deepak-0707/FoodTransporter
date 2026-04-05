// src/context/NotificationContext.jsx — FoodBridge Phase 4 (FAST REFRESH FIXED)

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from 'react';
import { notificationsAPI } from '../services/api';
import { getSocket, SOCKET_EVENTS } from '../services/socket';
import { useAuth } from './AuthContext';

// ✅ Exported for better HMR stability
export const NotificationContext = createContext(null);

// ─────────────────────────────────────────────────────────────
// Normalise DB + socket payloads
// ─────────────────────────────────────────────────────────────
const normalise = (n) => ({
  ...n,
  read: n.read_status ?? n.read ?? false,
});

// ─────────────────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────────────────
export function NotificationProvider({ children }) {
  const { user } = useAuth();

  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);

  // ✅ derived state
  const unreadCount = notifications.filter((n) => !n.read).length;

  // ─────────────────────────────────────────────────────────────
  // Fetch notifications
  // ─────────────────────────────────────────────────────────────
  const fetchNotifications = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    try {
      const res = await notificationsAPI.getAll();
      const rows = res.data.notifications || [];
      setNotifications(rows.map(normalise));
    } catch {
      // fallback seed
      setNotifications([
        normalise({
          id: 'welcome',
          message: 'Welcome to FoodBridge! Real-time updates are active.',
          timestamp: new Date().toISOString(),
          read_status: false,
          type: 'INFO',
        }),
      ]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // ─────────────────────────────────────────────────────────────
  // Socket listener
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const socket = getSocket();
    if (!socket || !user) return;

    function handleNew(payload) {
      const raw = payload?.notification ?? payload;

      setNotifications((prev) => {
        if (prev.some((n) => n.id === raw.id)) return prev;
        return [normalise(raw), ...prev];
      });
    }

    socket.on(SOCKET_EVENTS.NEW_NOTIFICATION, handleNew);

    return () => {
      socket.off(SOCKET_EVENTS.NEW_NOTIFICATION, handleNew);
    };
  }, [user]);

  // ─────────────────────────────────────────────────────────────
  // Mark single read
  // ─────────────────────────────────────────────────────────────
  const markRead = async (id) => {
    setNotifications((prev) =>
      prev.map((n) =>
        n.id === id ? { ...n, read: true, read_status: true } : n
      )
    );

    try {
      await notificationsAPI.markRead(id);
    } catch {}
  };

  // ─────────────────────────────────────────────────────────────
  // Mark all read
  // ─────────────────────────────────────────────────────────────
  const markAllRead = async () => {
    setNotifications((prev) =>
      prev.map((n) => ({ ...n, read: true, read_status: true }))
    );

    try {
      await notificationsAPI.markAllRead();
    } catch {}
  };

  // ─────────────────────────────────────────────────────────────
  // Add local notification
  // ─────────────────────────────────────────────────────────────
  const addNotification = useCallback((notification) => {
    setNotifications((prev) => [
      normalise({
        id:
          typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : `local-${Date.now()}-${Math.random()}`,
        timestamp: new Date().toISOString(),
        type: 'INFO',
        ...notification,
      }),
      ...prev,
    ]);
  }, []);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        loading,
        markRead,
        markAllRead,
        addNotification,
        refetch: fetchNotifications,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

// ─────────────────────────────────────────────────────────────
// Hook (✅ FAST REFRESH SAFE)
// ─────────────────────────────────────────────────────────────
function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    throw new Error(
      'useNotifications must be used within <NotificationProvider>'
    );
  }
  return ctx;
}

export { useNotifications };