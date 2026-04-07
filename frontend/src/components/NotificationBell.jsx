// src/components/NotificationBell.jsx — Phase 4
import React, { useState, useRef, useEffect } from 'react';
import { useNotifications } from '../context/NotificationContext';

const TYPE_STYLES = {
  INFO:     { bg: 'bg-blue-50',   dot: 'bg-blue-500',   icon: 'ℹ️' },
  SUCCESS:  { bg: 'bg-green-50',  dot: 'bg-green-500',  icon: '✅' },
  WARNING:  { bg: 'bg-amber-50',  dot: 'bg-amber-500',  icon: '⚠️' },
  ERROR:    { bg: 'bg-red-50',    dot: 'bg-red-500',    icon: '🔴' },
  URGENT:   { bg: 'bg-red-50',    dot: 'bg-red-600',    icon: '🚨' },
  ALLOCATION: { bg: 'bg-forest-50', dot: 'bg-forest-500', icon: '🎁' },
};

function timeAgo(ts) {
  const diff = (Date.now() - new Date(ts).getTime()) / 1000;
  if (diff < 60)   return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function NotificationBell() {
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Animate bell when new notification arrives
  const [shake, setShake] = useState(false);
  const prevCount = useRef(unreadCount);
  useEffect(() => {
    if (unreadCount > prevCount.current) {
      setShake(true);
      setTimeout(() => setShake(false), 600);
    }
    prevCount.current = unreadCount;
  }, [unreadCount]);

  return (
    <div className="relative" ref={ref}>
      {/* Bell button */}
      <button
        onClick={() => setOpen((o) => !o)}
        className={`relative p-2 rounded-xl hover:bg-stone-100 transition-colors ${shake ? 'animate-bell-shake' : ''}`}
        aria-label="Notifications"
      >
        <svg
          className={`w-5 h-5 transition-colors ${unreadCount > 0 ? 'text-brand-600' : 'text-stone-500'}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 leading-none">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl shadow-xl border border-stone-100 overflow-hidden z-50 animate-fade-up">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-stone-100">
            <h3 className="font-display font-semibold text-stone-900 text-sm">
              Notifications
              {unreadCount > 0 && (
                <span className="ml-2 bg-red-100 text-red-600 text-xs font-bold px-2 py-0.5 rounded-full">
                  {unreadCount} new
                </span>
              )}
            </h3>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs text-brand-600 hover:text-brand-700 font-medium"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* Notification list */}
          <div className="max-h-[340px] overflow-y-auto divide-y divide-stone-50">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-stone-400">
                <p className="text-2xl mb-2">🔔</p>
                <p className="text-sm">No notifications yet</p>
              </div>
            ) : (
              notifications.map((n) => {
                const style = TYPE_STYLES[n.type] || TYPE_STYLES.INFO;
                return (
                  <button
                    key={n.id}
                    onClick={() => markRead(n.id)}
                    className={`w-full text-left px-4 py-3 flex gap-3 hover:bg-stone-50 transition-colors ${
                      !n.read ? style.bg : ''
                    }`}
                  >
                    <div className="flex-shrink-0 mt-0.5">
                      {!n.read && (
                        <span className={`inline-block w-2 h-2 rounded-full mt-1 ${style.dot}`} />
                      )}
                      {n.read && <span className="inline-block w-2 h-2" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm leading-snug ${!n.read ? 'font-medium text-stone-900' : 'text-stone-600'}`}>
                        {style.icon} {n.message}
                      </p>
                      <p className="text-xs text-stone-400 mt-1">{timeAgo(n.timestamp)}</p>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {notifications.length > 0 && (
            <div className="px-4 py-2.5 border-t border-stone-100 text-center">
              <p className="text-xs text-stone-400">
                {notifications.length} notification{notifications.length !== 1 ? 's' : ''} total
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
