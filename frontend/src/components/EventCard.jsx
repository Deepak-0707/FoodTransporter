import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function expiryStatus(expiryTime) {
  const diffMin = (new Date(expiryTime) - new Date()) / 60000;
  if (diffMin < 0)   return { label: 'Expired',       cls: 'bg-stone-100 text-stone-500' };
  if (diffMin < 60)  return { label: 'Expiring soon', cls: 'bg-red-100 text-red-600 animate-pulse-soft' };
  if (diffMin < 240) return { label: 'A few hours',   cls: 'bg-amber-100 text-amber-700' };
  return               { label: 'Available',           cls: 'bg-forest-100 text-forest-700' };
}

function formatExpiry(expiryTime) {
  return new Date(expiryTime).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export default function EventCard({ event, onDelete, distanceKm }) {
  const { user }   = useAuth();
  const status     = expiryStatus(event.expiry_time);
  const isOwner    = user?.id === event.organizer_id;
  const isNGO      = user?.role === 'NGO';
  const isExpired  = new Date(event.expiry_time) < new Date();
  const remaining  = event.remaining_quantity ?? 0;
  const total      = event.quantity ?? 1;
  const pct        = Math.max(0, Math.min(100, Math.round((remaining / total) * 100)));

  return (
    <div className="card p-5 flex flex-col gap-3 animate-fade-up">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-display font-semibold text-stone-900 text-base leading-tight">{event.title}</h3>
        <span className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full ${status.cls}`}>{status.label}</span>
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
            className={`h-1.5 rounded-full transition-all duration-500 ${pct === 0 ? 'bg-stone-300' : 'bg-forest-500'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Meta */}
      <div className="flex flex-wrap gap-2 text-xs text-stone-500">
        <span>⏰ {formatExpiry(event.expiry_time)}</span>
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
          <Link to={`/events/${event.id}/book`} className="btn-primary text-sm py-1.5 px-3">
            🛒 Book
          </Link>
        )}

        {isOwner && (
          <>
            <Link to={`/events/${event.id}/edit`} className="btn-primary text-sm py-1.5 px-3">Edit</Link>
            <Link to={`/events/${event.id}/bookings`} className="btn-secondary text-sm py-1.5 px-3">Bookings</Link>
            <button onClick={() => onDelete && onDelete(event.id)} className="btn-danger text-sm py-1.5 px-3">Delete</button>
          </>
        )}
      </div>
    </div>
  );
}
