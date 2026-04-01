// src/components/EventCard.jsx — Phase 3: urgency badges + request button
import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// Maps urgency label → badge style
const URGENCY_STYLES = {
  CRITICAL: { cls: 'bg-red-100 text-red-700 animate-pulse',    icon: '🔴', text: 'URGENT'       },
  HIGH:     { cls: 'bg-orange-100 text-orange-700',             icon: '🟠', text: 'High Priority' },
  MEDIUM:   { cls: 'bg-amber-100 text-amber-700',               icon: '🟡', text: 'A few hours'  },
  LOW:      { cls: 'bg-forest-100 text-forest-700',             icon: '🟢', text: 'Available'    },
  EXPIRED:  { cls: 'bg-stone-100 text-stone-500',               icon: '⚫', text: 'Expired'      },
};

function formatExpiry(expiryTime) {
  return new Date(expiryTime).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function ExpiryCountdown({ hoursLeft, label }) {
  if (label === 'EXPIRED') return <span className="text-xs text-stone-400">Expired</span>;

  const h = Math.floor(hoursLeft);
  const m = Math.round((hoursLeft - h) * 60);

  return (
    <span className={`text-xs font-semibold ${label === 'CRITICAL' ? 'text-red-600' : label === 'HIGH' ? 'text-orange-600' : 'text-stone-500'}`}>
      ⏳ {h > 0 ? `${h}h ` : ''}{m}m left
    </span>
  );
}

export default function EventCard({ event, onDelete, distanceKm }) {
  const { user }    = useAuth();
  const urgency     = URGENCY_STYLES[event.label] || URGENCY_STYLES.LOW;
  const isOwner     = user?.id === event.organizer_id;
  const isNGO       = user?.role === 'NGO';
  const isExpired   = event.label === 'EXPIRED' || new Date(event.expiry_time) < new Date();
  const remaining   = event.remaining_quantity ?? 0;
  const total       = event.quantity ?? 1;
  const pct         = Math.max(0, Math.min(100, Math.round((remaining / total) * 100)));

  return (
    <div className={`card p-5 flex flex-col gap-3 animate-fade-up relative ${event.label === 'CRITICAL' ? 'ring-2 ring-red-300' : ''}`}>

      {/* URGENT badge overlay for critical events */}
      {event.label === 'CRITICAL' && (
        <div className="absolute -top-2 -right-2 bg-red-600 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full shadow-md tracking-wide animate-pulse">
          URGENT
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-display font-semibold text-stone-900 text-base leading-tight">{event.title}</h3>
        <span className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full flex items-center gap-1 ${urgency.cls}`}>
          {urgency.icon} {urgency.text}
        </span>
      </div>

      {event.description && <p className="text-sm text-stone-500 line-clamp-2">{event.description}</p>}

      {/* Quantity + progress */}
      <div>
        <div className="flex justify-between text-xs text-stone-500 mb-1">
          <span>🍽️ <strong className="text-stone-700">{remaining} {event.quantity_unit}</strong> remaining</span>
          <span>{pct}%</span>
        </div>
        <div className="w-full bg-stone-100 rounded-full h-1.5">
          <div
            className={`h-1.5 rounded-full transition-all duration-500 ${
              pct === 0 ? 'bg-stone-300' : event.label === 'CRITICAL' ? 'bg-red-500' : 'bg-forest-500'
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Expiry & distance */}
      <div className="flex flex-wrap gap-3 text-xs text-stone-500 items-center">
        <span>⏰ {formatExpiry(event.expiry_time)}</span>
        <ExpiryCountdown hoursLeft={event.hoursLeft} label={event.label} />
        {distanceKm != null && (
          <span className="text-forest-700 font-semibold">📍 {distanceKm} km away</span>
        )}
      </div>

      {user?.role === 'NGO' && event.organizer_name && (
        <p className="text-xs text-stone-400">By {event.organizer_name}</p>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-2 mt-1">
        <Link to={`/events/${event.id}`} className="btn-secondary text-sm py-1.5 px-3">View Details</Link>

        {isNGO && !isExpired && remaining > 0 && (
          <Link to={`/events/${event.id}/request`} className={`text-sm py-1.5 px-3 rounded-xl font-semibold transition-all ${
            event.label === 'CRITICAL'
              ? 'bg-red-600 text-white hover:bg-red-700'
              : 'btn-primary'
          }`}>
            {event.label === 'CRITICAL' ? '🚨 Request Now' : '📋 Request Food'}
          </Link>
        )}

        {isOwner && (
          <>
            <Link to={`/events/${event.id}/edit`} className="btn-primary text-sm py-1.5 px-3">Edit</Link>
            <Link to={`/events/${event.id}/requests`} className="btn-secondary text-sm py-1.5 px-3">Requests</Link>
            <button onClick={() => onDelete && onDelete(event.id)} className="btn-danger text-sm py-1.5 px-3">Delete</button>
          </>
        )}
      </div>
    </div>
  );
}
