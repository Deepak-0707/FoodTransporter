// src/components/Navbar.jsx
import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isActive = (path) => location.pathname === path;

  const navLink = (to, label) => (
    <Link
      to={to}
      onClick={() => setMenuOpen(false)}
      className={`text-sm font-medium transition-colors duration-150 ${
        isActive(to)
          ? 'text-brand-500'
          : 'text-stone-600 hover:text-stone-900'
      }`}
    >
      {label}
    </Link>
  );

  return (
    <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-stone-100 shadow-sm">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">

        {/* Logo */}
        <Link to="/dashboard" className="flex items-center gap-2 group">
          <span className="text-2xl">🍱</span>
          <span className="font-display font-bold text-xl text-stone-900 group-hover:text-brand-600 transition-colors">
            FoodBridge
          </span>
        </Link>

        {/* Desktop Nav */}
        <div className="hidden sm:flex items-center gap-6">
          {navLink('/dashboard', 'Dashboard')}
          {navLink('/events', 'Events')}
          {navLink('/map', 'Map')}
          {user?.role === 'ORGANIZER' && navLink('/events/new', '+ New Event')}
        </div>

        {/* User Menu */}
        <div className="hidden sm:flex items-center gap-3">
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
            user?.role === 'ORGANIZER'
              ? 'bg-brand-100 text-brand-700'
              : 'bg-forest-100 text-forest-700'
          }`}>
            {user?.role}
          </span>
          <span className="text-sm text-stone-600 font-medium">{user?.name}</span>
          <button
            onClick={handleLogout}
            className="text-sm text-red-500 hover:text-red-700 font-medium transition-colors"
          >
            Logout
          </button>
        </div>

        {/* Mobile Hamburger */}
        <button
          className="sm:hidden p-2 rounded-lg text-stone-600 hover:bg-stone-100"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle menu"
        >
          {menuOpen ? '✕' : '☰'}
        </button>
      </div>

      {/* Mobile Menu */}
      {menuOpen && (
        <div className="sm:hidden border-t border-stone-100 bg-white px-4 py-4 flex flex-col gap-4 animate-fade-up">
          {navLink('/dashboard', 'Dashboard')}
          {navLink('/events', 'Events')}
          {navLink('/map', 'Map')}
          {user?.role === 'ORGANIZER' && navLink('/events/new', '+ New Event')}
          <div className="pt-2 border-t border-stone-100 flex items-center justify-between">
            <span className="text-sm text-stone-500">{user?.name} · {user?.role}</span>
            <button onClick={handleLogout} className="text-sm text-red-500 font-medium">Logout</button>
          </div>
        </div>
      )}
    </nav>
  );
}
