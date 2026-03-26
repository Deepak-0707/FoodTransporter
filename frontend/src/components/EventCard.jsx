// src/components/EventCard.jsx
import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/** Returns a colour class based on how close the expiry time is */
function expiryStatus(expiryTime) {
  const now     = new Date();
  const expiry  = new Date(expiryTime);
  const diffMin = (expiry - now) / 60000;

  if (diffMin < 0)   return { label: 'Expired',     cls: 'bg-stone-100 text-stone-500' };
  if (diffMin < 60)  return { label: 'Expiring soon', cls: 'bg-red-100 text-red-600 animate-pulse-soft' };
  if (diffMin < 240) return { label: 'A few hours',  cls: 'bg-amber-100 text-amber-700' };
  return               { label: 'Available',         cls: 'bg-forest-100 text-forest-700' };
}

function formatExpiry(expiryTime) {
  return new Date(expiryTime).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export default function EventCard({ event, onDelete }) {
  const { user } = useAuth();
  const status   = expiryStatus(event.expiry_time);
  const isOwner  = user?.id === event.organizer_id;

  return (
    <div className="card p-5 flex flex-col gap-3 animate-fade-up">
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-display font-semibold text-stone-900 text-base leading-tight">
          {event.title}
        </h3>
        <span className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full ${status.cls}`}>
          {status.label}
        </span>
      </div>

      {/* Description */}
      {event.description && (
        <p className="text-sm text-stone-500 line-clamp-2">{event.description}</p>
      )}

      {/* Meta */}
      <div className="flex flex-wrap gap-3 text-sm text-stone-600">
        <span className="flex items-center gap-1">
          <span>🍽️</span>
          <span className="font-medium">{event.quantity}</span>
        </span>
        <span className="flex items-center gap-1">
          <span>⏰</span>
          <span>{formatExpiry(event.expiry_time)}</span>
        </span>
        <span className="flex items-center gap-1">
          <span>📍</span>
          <span>{parseFloat(event.latitude).toFixed(4)}, {parseFloat(event.longitude).toFixed(4)}</span>
        </span>
      </div>

      {/* Organizer name for NGOs */}
      {user?.role === 'NGO' && event.organizer_name && (
        <p className="text-xs text-stone-400">By {event.organizer_name}</p>
      )}

      {/* Actions */}
      <div className="flex gap-2 mt-1">
        <Link to={`/events/${event.id}`} className="btn-secondary text-sm py-1.5 px-4">
          View Details
        </Link>
        {isOwner && (
          <>
            <Link to={`/events/${event.id}/edit`} className="btn-primary text-sm py-1.5 px-4">
              Edit
            </Link>
            <button
              onClick={() => onDelete && onDelete(event.id)}
              className="btn-danger text-sm py-1.5 px-4"
            >
              Delete
            </button>
          </>
        )}
      </div>
    </div>
  );
}
