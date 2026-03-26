import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate         = useNavigate();
  const location         = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const isNGO = user?.role === 'NGO';
  const isOrganizer = user?.role === 'ORGANIZER';

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isActive = (path) =>
    location.pathname === path || location.pathname.startsWith(path + '/');

  const linkCls = (path) =>
    `text-sm font-medium transition-colors ${
      isActive(path)
        ? 'text-brand-600'
        : 'text-stone-600 hover:text-stone-900'
    }`;

  return (
    <nav className="bg-white border-b border-stone-100 sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
        {/* Logo */}
        <Link to="/dashboard" className="font-display font-bold text-xl text-stone-900 shrink-0">
          🍱 FoodBridge
        </Link>

        {/* Desktop links */}
        <div className="hidden sm:flex items-center gap-6">
          <Link to="/dashboard" className={linkCls('/dashboard')}>Dashboard</Link>
          <Link to="/events"    className={linkCls('/events')}>Events</Link>
          <Link to="/map"       className={linkCls('/map')}>Map</Link>
          {isNGO && (
            <Link to="/bookings" className={linkCls('/bookings')}>My Bookings</Link>
          )}
        </div>

        {/* Right side */}
        <div className="hidden sm:flex items-center gap-3">
          <span className="text-xs bg-stone-100 text-stone-600 px-2.5 py-1 rounded-full font-medium">
            {user?.role}
          </span>
          <span className="text-sm text-stone-500 max-w-[120px] truncate">{user?.name}</span>
          <button
            onClick={handleLogout}
            className="btn-secondary text-sm py-1.5 px-3"
          >
            Logout
          </button>
        </div>

        {/* Mobile hamburger */}
        <button
          className="sm:hidden p-2 rounded-lg text-stone-500 hover:bg-stone-100"
          onClick={() => setMenuOpen((o) => !o)}
          aria-label="Toggle menu"
        >
          {menuOpen ? '✕' : '☰'}
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="sm:hidden border-t border-stone-100 bg-white px-4 py-3 flex flex-col gap-3">
          <Link to="/dashboard" className="text-sm font-medium text-stone-700" onClick={() => setMenuOpen(false)}>Dashboard</Link>
          <Link to="/events"    className="text-sm font-medium text-stone-700" onClick={() => setMenuOpen(false)}>Events</Link>
          <Link to="/map"       className="text-sm font-medium text-stone-700" onClick={() => setMenuOpen(false)}>Map</Link>
          {isNGO && (
            <Link to="/bookings" className="text-sm font-medium text-stone-700" onClick={() => setMenuOpen(false)}>My Bookings</Link>
          )}
          <hr className="border-stone-100" />
          <div className="flex items-center justify-between">
            <span className="text-xs text-stone-500">{user?.name} · {user?.role}</span>
            <button onClick={handleLogout} className="btn-secondary text-sm py-1.5 px-3">Logout</button>
          </div>
        </div>
      )}
    </nav>
  );
}
