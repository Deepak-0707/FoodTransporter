import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { eventsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import PageLayout from '../components/PageLayout';
import BookingForm from '../components/BookingForm';

function formatDateTime(dt) {
  return new Date(dt).toLocaleString(undefined, {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function ExpiryBadge({ expiryTime }) {
  const diffMin = (new Date(expiryTime) - new Date()) / 60000;
  let label, cls;
  if (diffMin < 0)        { label = 'Expired';          cls = 'bg-stone-100 text-stone-500'; }
  else if (diffMin < 60)  { label = 'Expiring soon!';   cls = 'bg-red-100 text-red-600 animate-pulse-soft'; }
  else if (diffMin < 240) { label = 'A few hours left'; cls = 'bg-amber-100 text-amber-700'; }
  else                    { label = 'Available';         cls = 'bg-forest-100 text-forest-700'; }
  return <span className={`inline-flex items-center gap-1 text-sm font-semibold px-3 py-1.5 rounded-full ${cls}`}>⏰ {label}</span>;
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

  const handleDelete = async () => {
    if (!window.confirm('Delete this event permanently?')) return;
    try { await eventsAPI.remove(id); navigate('/events'); }
    catch { alert('Failed to delete event'); }
  };

  const handleBookingSuccess = (booking) => {
    setEvent((prev) => ({
      ...prev,
      remaining_quantity: prev.remaining_quantity - booking.quantity_requested,
    }));
  };

  const isOwner   = user?.id === event?.organizer_id;
  const isNGO     = user?.role === 'NGO';
  const isExpired = event ? new Date(event.expiry_time) < new Date() : false;

  if (loading) return <PageLayout><div className="text-stone-400 animate-pulse-soft py-16 text-center">Loading…</div></PageLayout>;
  if (error)   return <PageLayout><div className="bg-red-50 border border-red-200 text-red-600 rounded-xl px-4 py-3">{error}</div></PageLayout>;

  const filledPct = Math.round(((event.quantity - event.remaining_quantity) / event.quantity) * 100);

  return (
    <PageLayout>
      <div className="max-w-2xl mx-auto">
        <Link to="/events" className="text-sm text-stone-500 hover:text-stone-700 flex items-center gap-1 mb-6">← Back to Events</Link>

        <div className="card p-8 flex flex-col gap-6">
          {/* Title */}
          <div className="flex flex-col gap-3">
            <ExpiryBadge expiryTime={event.expiry_time} />
            <h1 className="font-display font-bold text-2xl text-stone-900">{event.title}</h1>
            {event.description && <p className="text-stone-600 leading-relaxed">{event.description}</p>}
          </div>

          {/* Quantity section */}
          <div className="bg-stone-50 rounded-xl p-4">
            <div className="flex justify-between items-center mb-3">
              <p className="text-xs font-semibold text-stone-400 uppercase tracking-wider">Food Availability</p>
              <span className="text-sm font-semibold text-stone-700">
                {event.remaining_quantity} / {event.quantity} {event.quantity_unit} remaining
              </span>
            </div>
            <div className="w-full bg-white rounded-full h-3 border border-stone-200">
              <div
                className="bg-forest-500 h-3 rounded-full transition-all duration-700"
                style={{ width: `${Math.max(0, 100 - filledPct)}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-stone-400 mt-1.5">
              <span>{filledPct}% claimed</span>
              <span>{event.booking_count} booking{event.booking_count !== 1 ? 's' : ''}</span>
            </div>
          </div>

          {/* Details grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-stone-50 rounded-xl p-4">
              <p className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-1">Expires At</p>
              <p className="text-stone-800 font-medium text-sm">{formatDateTime(event.expiry_time)}</p>
            </div>
            <div className="bg-stone-50 rounded-xl p-4">
              <p className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-1">Posted By</p>
              <p className="text-stone-800 font-medium">{event.organizer_name}</p>
              {event.organizer_email && <p className="text-xs text-stone-500">{event.organizer_email}</p>}
            </div>
            <div className="bg-stone-50 rounded-xl p-4 col-span-2">
              <p className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-1">Location</p>
              <p className="text-stone-800 font-medium text-sm">
                📍 {parseFloat(event.latitude).toFixed(5)}, {parseFloat(event.longitude).toFixed(5)}
              </p>
              <a
                href={`https://www.openstreetmap.org/?mlat=${event.latitude}&mlon=${event.longitude}&zoom=16`}
                target="_blank" rel="noopener noreferrer"
                className="text-xs text-brand-600 hover:underline mt-1 inline-block"
              >
                View on OpenStreetMap ↗
              </a>
            </div>
          </div>

          <p className="text-xs text-stone-400">
            Posted on {new Date(event.created_at).toLocaleDateString(undefined, { dateStyle: 'long' })}
          </p>

          {/* NGO booking form */}
          {isNGO && !isExpired && (
            <BookingForm
              eventId={event.id}
              remainingQty={event.remaining_quantity}
              unit={event.quantity_unit}
              onSuccess={handleBookingSuccess}
            />
          )}
          {isNGO && !isExpired && (
            <Link to={`/events/${event.id}/book`} className="text-xs text-center text-brand-600 hover:underline">
              Open full booking page →
            </Link>
          )}

          {/* Organizer actions */}
          {isOwner && (
            <div className="flex flex-wrap gap-3 pt-2 border-t border-stone-100">
              <Link to={`/events/${event.id}/edit`} className="btn-primary text-sm">Edit Event</Link>
              <Link to={`/events/${event.id}/bookings`} className="btn-secondary text-sm">View Bookings</Link>
              <button onClick={handleDelete} className="btn-danger text-sm">Delete Event</button>
            </div>
          )}
        </div>
      </div>
    </PageLayout>
  );
}
