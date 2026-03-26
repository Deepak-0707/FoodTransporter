import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { eventsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import PageLayout from '../components/PageLayout';
import BookingForm from '../components/BookingForm';

function formatDateTime(dt) {
  return new Date(dt).toLocaleString(undefined, {
    weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function BookEventPage() {
  const { id }     = useParams();
  const { user }   = useAuth();
  const navigate   = useNavigate();

  const [event, setEvent]       = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [booked, setBooked]     = useState(false);

  useEffect(() => {
    eventsAPI.getById(id)
      .then((res) => setEvent(res.data.event))
      .catch(() => setError('Event not found'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleBookingSuccess = (booking) => {
    setBooked(true);
    // Optimistically update remaining qty
    setEvent((prev) => ({
      ...prev,
      remaining_quantity: prev.remaining_quantity - booking.quantity_requested,
    }));
  };

  if (loading) return <PageLayout><div className="text-stone-400 py-16 text-center animate-pulse-soft">Loading…</div></PageLayout>;
  if (error)   return <PageLayout><div className="bg-red-50 border border-red-200 text-red-600 rounded-xl px-4 py-3">{error}</div></PageLayout>;

  const isExpired = new Date(event.expiry_time) < new Date();
  const isOwner   = user?.id === event?.organizer_id;
  const isNGO     = user?.role === 'NGO';

  return (
    <PageLayout title="Book Food" subtitle="Review event details and request your quantity.">
      <div className="max-w-xl mx-auto">
        <Link to={`/events/${id}`} className="text-sm text-stone-500 hover:text-stone-700 flex items-center gap-1 mb-6">
          ← Back to Event
        </Link>

        {/* Event summary card */}
        <div className="card p-6 mb-6">
          <div className="flex items-start justify-between gap-3 mb-4">
            <h2 className="font-display font-bold text-xl text-stone-900">{event.title}</h2>
            {isExpired ? (
              <span className="shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full bg-stone-100 text-stone-500">Expired</span>
            ) : (
              <span className="shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full bg-forest-100 text-forest-700">Available</span>
            )}
          </div>

          {event.description && (
            <p className="text-stone-600 text-sm mb-4">{event.description}</p>
          )}

          {/* Quantity info */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-brand-50 border border-brand-100 rounded-xl p-3">
              <p className="text-xs text-brand-600 font-semibold uppercase tracking-wide mb-1">Total Quantity</p>
              <p className="text-stone-900 font-bold text-lg">{event.quantity} <span className="text-sm font-normal text-stone-500">{event.quantity_unit}</span></p>
            </div>
            <div className={`border rounded-xl p-3 ${event.remaining_quantity > 0 ? 'bg-forest-50 border-forest-100' : 'bg-stone-50 border-stone-200'}`}>
              <p className={`text-xs font-semibold uppercase tracking-wide mb-1 ${event.remaining_quantity > 0 ? 'text-forest-600' : 'text-stone-400'}`}>Remaining</p>
              <p className="text-stone-900 font-bold text-lg">
                {event.remaining_quantity} <span className="text-sm font-normal text-stone-500">{event.quantity_unit}</span>
              </p>
            </div>
          </div>

          {/* Availability bar */}
          <div className="mb-4">
            <div className="flex justify-between text-xs text-stone-500 mb-1">
              <span>Availability</span>
              <span>{Math.round((event.remaining_quantity / event.quantity) * 100)}% remaining</span>
            </div>
            <div className="w-full bg-stone-100 rounded-full h-2">
              <div
                className="bg-forest-500 h-2 rounded-full transition-all duration-500"
                style={{ width: `${(event.remaining_quantity / event.quantity) * 100}%` }}
              />
            </div>
          </div>

          <div className="text-sm text-stone-600 space-y-1">
            <p>⏰ Expires: <strong>{formatDateTime(event.expiry_time)}</strong></p>
            <p>👤 By: <strong>{event.organizer_name}</strong></p>
            <p>📍 {parseFloat(event.latitude).toFixed(4)}, {parseFloat(event.longitude).toFixed(4)}</p>
          </div>
        </div>

        {/* Booking section */}
        {!isNGO && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-700">
            ℹ️ Only NGO accounts can book food from events.
          </div>
        )}

        {isNGO && isExpired && (
          <div className="bg-stone-50 border border-stone-200 rounded-xl p-4 text-sm text-stone-500">
            This event has expired and is no longer accepting bookings.
          </div>
        )}

        {isNGO && !isExpired && (
          <BookingForm
            eventId={event.id}
            remainingQty={event.remaining_quantity}
            unit={event.quantity_unit}
            onSuccess={handleBookingSuccess}
          />
        )}

        {booked && (
          <div className="mt-4 flex gap-3">
            <Link to="/bookings" className="btn-primary text-sm">
              View My Bookings
            </Link>
            <Link to="/events" className="btn-secondary text-sm">
              Browse More Events
            </Link>
          </div>
        )}
      </div>
    </PageLayout>
  );
}
