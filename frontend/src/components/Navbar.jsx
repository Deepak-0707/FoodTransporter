// src/components/Navbar.jsx — Phase 4: with NotificationBell + socket indicator
import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import NotificationBell from './NotificationBell';

export default function Navbar() {
  const { user, logout }  = useAuth();
  const { connected }     = useSocket();
  const location          = useLocation();
  const navigate          = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = () => { logout(); navigate('/login'); };
  const isActive = (path) => location.pathname === path || location.pathname.startsWith(path + '/');

  const ngoLinks = [
    { to: '/dashboard', label: 'Dashboard' },
    { to: '/events',    label: 'Events'    },
    { to: '/requests',  label: 'Requests'  },
    { to: '/map',       label: 'Map'       },
  ];
  const organizerLinks = [
    { to: '/dashboard', label: 'Dashboard' },
    { to: '/events',    label: 'Events'    },
    { to: '/map',       label: 'Map'       },
  ];

  const links = user?.role === 'NGO' ? ngoLinks : organizerLinks;

  return (
    <nav className="bg-white border-b border-stone-100 sticky top-0 z-40 shadow-sm">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
        <Link to="/dashboard" className="font-display font-bold text-brand-600 text-lg tracking-tight shrink-0">
          🌉 FoodBridge
        </Link>

        {user && (
          <>
            {/* Desktop nav */}
            <div className="hidden sm:flex items-center gap-1">
              {links.map(({ to, label }) => (
                <Link
                  key={to}
                  to={to}
                  className={`text-sm font-medium px-3 py-1.5 rounded-lg transition-colors ${
                    isActive(to)
                      ? 'bg-brand-50 text-brand-700'
                      : 'text-stone-600 hover:text-stone-900 hover:bg-stone-50'
                  }`}
                >
                  {label}
                </Link>
              ))}
            </div>

            <div className="flex items-center gap-2 ml-auto">
              {/* Socket connection indicator */}
              <div className="hidden sm:flex items-center gap-1.5" title={connected ? 'Real-time connected' : 'Real-time disconnected'}>
                <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500 animate-pulse' : 'bg-stone-300'}`} />
                <span className="text-xs text-stone-400">{connected ? 'Live' : 'Offline'}</span>
              </div>

              <span className="hidden sm:inline text-xs text-stone-400 font-medium">
                {user.name} · <span className={user.role === 'ORGANIZER' ? 'text-brand-600' : 'text-forest-600'}>{user.role}</span>
              </span>

              {user.role === 'ORGANIZER' && (
                <Link to="/events/new" className="hidden sm:inline btn-primary text-xs py-1.5 px-3">
                  + New Event
                </Link>
              )}

              {/* Notification bell */}
              <NotificationBell />

              <button onClick={handleLogout} className="text-xs text-stone-500 hover:text-stone-700 font-medium">
                Logout
              </button>

              {/* Mobile hamburger */}
              <button
                onClick={() => setMenuOpen((o) => !o)}
                className="sm:hidden p-1.5 rounded-lg hover:bg-stone-100 text-stone-600"
              >
                {menuOpen ? '✕' : '☰'}
              </button>
            </div>
          </>
        )}
      </div>

      {/* Mobile menu */}
      {user && menuOpen && (
        <div className="sm:hidden border-t border-stone-100 bg-white px-4 py-3 space-y-1">
          {links.map(({ to, label }) => (
            <Link
              key={to}
              to={to}
              onClick={() => setMenuOpen(false)}
              className={`block text-sm font-medium px-3 py-2 rounded-lg ${
                isActive(to) ? 'bg-brand-50 text-brand-700' : 'text-stone-600 hover:bg-stone-50'
              }`}
            >
              {label}
            </Link>
          ))}
          {user.role === 'ORGANIZER' && (
            <Link to="/events/new" onClick={() => setMenuOpen(false)} className="block text-sm font-medium px-3 py-2 text-brand-600">
              + New Event
            </Link>
          )}
          {/* Mobile socket status */}
          <div className="flex items-center gap-2 px-3 py-2">
            <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-stone-300'}`} />
            <span className="text-xs text-stone-400">{connected ? 'Live updates active' : 'No live updates'}</span>
          </div>
        </div>
      )}
    </nav>
  );
}
