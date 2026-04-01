// src/pages/EventDetailPage.jsx — Phase 3
import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { eventsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import PageLayout from '../components/PageLayout';

const URGENCY_STYLES = {
  CRITICAL: { cls: 'bg-red-100 text-red-700 border-red-200',      icon: '🔴', pulse: true  },
  HIGH:     { cls: 'bg-orange-100 text-orange-700 border-orange-200', icon: '🟠', pulse: false },
  MEDIUM:   { cls: 'bg-amber-100 text-amber-700 border-amber-200',   icon: '🟡', pulse: false },
  LOW:      { cls: 'bg-forest-100 text-forest-700 border-forest-100',icon: '🟢', pulse: false },
  EXPIRED:  { cls: 'bg-stone-100 text-stone-500 border-stone-200',   icon: '⚫', pulse: false },
};

function formatDateTime(dt) {
  return new Date(dt).toLocaleString(undefined, {
    weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function EventDetailPage() {
  const { id }     = useParams();
  const { user }   = useAuth();
  const navigate   = useNavigate();

  const [event, setEvent]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  useEffect(() => {
    eventsAPI.getById(id)
      .then((res) => setEvent(res.data.event))
      .catch(() => setError('Event not found'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <PageLayout><div className="text-center py-16 text-stone-400 animate-pulse-soft">Loading…</div></PageLayout>;
  if (error)   return (
    <PageLayout>
      <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl px-4 py-3">{error}</div>
      <Link to="/events" className="text-sm text-stone-500 hover:underline mt-4 inline-block">← Back to Events</Link>
    </PageLayout>
  );

  const isOwner   = user?.id === event?.organizer_id;
  const isNGO     = user?.role === 'NGO';
  const isExpired = event.label === 'EXPIRED' || new Date(event.expiry_time) < new Date();
  const urg       = URGENCY_STYLES[event.label] || URGENCY_STYLES.LOW;
  const pct       = Math.max(0, Math.min(100, Math.round((event.remaining_quantity / event.quantity) * 100)));

  const handleDelete = async () => {
    if (!window.confirm('Delete this event?')) return;
    try {
      await eventsAPI.remove(id);
      navigate('/dashboard');
    } catch {
      alert('Failed to delete event');
    }
  };

  return (
    <PageLayout title={event.title} subtitle={`By ${event.organizer_name}`}>
      <div className="max-w-2xl mx-auto">
        <Link to="/events" className="text-sm text-stone-500 hover:text-stone-700 flex items-center gap-1 mb-6">
          ← Back to Events
        </Link>

        {/* Urgency banner */}
        {event.label === 'CRITICAL' && (
          <div className="mb-5 flex items-center gap-3 bg-red-600 text-white rounded-2xl px-5 py-3 shadow-md animate-pulse">
            <span className="text-2xl">🚨</span>
            <div>
              <p className="font-bold text-sm">URGENT — Expires in under 1 hour!</p>
              <p className="text-red-100 text-xs">Immediate action needed to avoid food waste.</p>
            </div>
          </div>
        )}

        {/* Main event card */}
        <div className="card p-6 mb-6">
          <div className="flex items-start justify-between gap-3 mb-5">
            <h2 className="font-display font-bold text-2xl text-stone-900">{event.title}</h2>
            <span className={`shrink-0 text-xs font-bold px-3 py-1.5 rounded-full border flex items-center gap-1.5 ${urg.cls} ${urg.pulse ? 'animate-pulse' : ''}`}>
              {urg.icon} {event.label}
            </span>
          </div>

          {event.description && (
            <p className="text-stone-600 mb-5 leading-relaxed">{event.description}</p>
          )}

          {/* Quantity cards */}
          <div className="grid grid-cols-2 gap-3 mb-5">
            <div className="bg-brand-50 border border-brand-100 rounded-xl p-4">
              <p className="text-xs text-brand-600 font-semibold uppercase tracking-wide mb-1">Total Quantity</p>
              <p className="text-stone-900 font-bold text-xl">{event.quantity} <span className="text-sm font-normal text-stone-500">{event.quantity_unit}</span></p>
            </div>
            <div className={`border rounded-xl p-4 ${event.remaining_quantity > 0 ? 'bg-forest-50 border-forest-100' : 'bg-stone-50 border-stone-200'}`}>
              <p className={`text-xs font-semibold uppercase tracking-wide mb-1 ${event.remaining_quantity > 0 ? 'text-forest-600' : 'text-stone-400'}`}>Remaining</p>
              <p className="text-stone-900 font-bold text-xl">{event.remaining_quantity} <span className="text-sm font-normal text-stone-500">{event.quantity_unit}</span></p>
            </div>
          </div>

          {/* Availability bar */}
          <div className="mb-5">
            <div className="flex justify-between text-xs text-stone-500 mb-1.5">
              <span>Availability</span>
              <span>{pct}% remaining</span>
            </div>
            <div className="w-full bg-stone-100 rounded-full h-2.5">
              <div
                className={`h-2.5 rounded-full transition-all duration-500 ${
                  event.label === 'CRITICAL' ? 'bg-red-500' : 'bg-forest-500'
                }`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          {/* Meta details */}
          <div className="space-y-2 text-sm text-stone-600 border-t border-stone-100 pt-4">
            <p>⏰ <strong>Expires:</strong> {formatDateTime(event.expiry_time)}</p>
            <p>📍 <strong>Location:</strong> {parseFloat(event.latitude).toFixed(4)}, {parseFloat(event.longitude).toFixed(4)}</p>
            <p>👤 <strong>Organizer:</strong> {event.organizer_name} ({event.organizer_email})</p>
            {event.request_count != null && (
              <p>📋 <strong>Requests:</strong> {event.request_count}</p>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-3">
          {isNGO && !isExpired && event.remaining_quantity > 0 && (
            <Link
              to={`/events/${event.id}/request`}
              className={`font-semibold py-2.5 px-5 rounded-xl transition-all text-sm ${
                event.label === 'CRITICAL' ? 'bg-red-600 hover:bg-red-700 text-white' : 'btn-primary'
              }`}
            >
              {event.label === 'CRITICAL' ? '🚨 Request Urgently' : '📋 Request Food'}
            </Link>
          )}

          {isOwner && (
            <>
              <Link to={`/events/${event.id}/requests`} className="btn-primary text-sm py-2.5 px-5">
                ⚡ Allocation Dashboard
              </Link>
              <Link to={`/events/${event.id}/edit`} className="btn-secondary text-sm py-2.5 px-5">
                Edit Event
              </Link>
              <button onClick={handleDelete} className="btn-danger text-sm py-2.5 px-5">
                Delete
              </button>
            </>
          )}

          {isNGO && isExpired && (
            <div className="text-sm text-stone-500 bg-stone-50 border border-stone-200 rounded-xl px-4 py-2.5">
              This event has expired and is no longer accepting requests.
            </div>
          )}
        </div>
      </div>
    </PageLayout>
  );
}
