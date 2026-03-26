import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { bookingsAPI } from '../services/api';
import PageLayout from '../components/PageLayout';

function formatDateTime(dt) {
  return new Date(dt).toLocaleString(undefined, {
    dateStyle: 'medium', timeStyle: 'short',
  });
}

function StatusBadge({ status, expiry }) {
  const isExpired = new Date(expiry) < new Date();
  if (status === 'cancelled') {
    return <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-stone-100 text-stone-500">Cancelled</span>;
  }
  if (isExpired) {
    return <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-100 text-amber-700">Completed</span>;
  }
  return <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-forest-100 text-forest-700">Confirmed</span>;
}

export default function MyBookingsPage() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');

  useEffect(() => {
    bookingsAPI.getMine()
      .then((res) => setBookings(res.data.bookings))
      .catch(() => setError('Failed to load bookings'))
      .finally(() => setLoading(false));
  }, []);

  const total = bookings.reduce((sum, b) => sum + b.quantity_requested, 0);
  const confirmed = bookings.filter(
    (b) => b.status === 'confirmed' && new Date(b.expiry_time) > new Date()
  ).length;

  return (
    <PageLayout
      title="My Bookings"
      subtitle="All food reservations you've made through FoodBridge."
    >
      {/* Stats */}
      {!loading && bookings.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
          <div className="card p-4 flex items-center gap-3">
            <span className="text-2xl">📋</span>
            <div>
              <p className="font-display font-bold text-xl text-stone-900">{bookings.length}</p>
              <p className="text-xs text-stone-500">Total Bookings</p>
            </div>
          </div>
          <div className="card p-4 flex items-center gap-3">
            <span className="text-2xl">✅</span>
            <div>
              <p className="font-display font-bold text-xl text-stone-900">{confirmed}</p>
              <p className="text-xs text-stone-500">Active</p>
            </div>
          </div>
          <div className="card p-4 flex items-center gap-3 col-span-2 sm:col-span-1">
            <span className="text-2xl">🍽️</span>
            <div>
              <p className="font-display font-bold text-xl text-stone-900">{total}</p>
              <p className="text-xs text-stone-500">Total Quantity</p>
            </div>
          </div>
        </div>
      )}

      {loading && <div className="text-center py-16 text-stone-400 animate-pulse-soft">Loading bookings…</div>}
      {error   && <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl px-4 py-3">{error}</div>}

      {!loading && !error && bookings.length === 0 && (
        <div className="card p-12 text-center text-stone-400">
          <p className="text-4xl mb-3">📭</p>
          <p className="font-medium mb-4">No bookings yet.</p>
          <Link to="/events" className="btn-primary text-sm inline-block">
            Browse Available Events
          </Link>
        </div>
      )}

      <div className="flex flex-col gap-4">
        {bookings.map((b) => (
          <div key={b.id} className="card p-5">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <h3 className="font-display font-semibold text-stone-900">{b.event_title}</h3>
                <p className="text-xs text-stone-400 mt-0.5">
                  Booked on {formatDateTime(b.created_at)}
                </p>
              </div>
              <StatusBadge status={b.status} expiry={b.expiry_time} />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <div className="bg-stone-50 rounded-lg p-2.5">
                <p className="text-xs text-stone-400 mb-0.5">Your Request</p>
                <p className="font-semibold text-stone-800">
                  {b.quantity_requested} {b.quantity_unit}
                </p>
              </div>
              <div className="bg-stone-50 rounded-lg p-2.5">
                <p className="text-xs text-stone-400 mb-0.5">Event Total</p>
                <p className="font-semibold text-stone-800">
                  {b.event_total_quantity} {b.quantity_unit}
                </p>
              </div>
              <div className="bg-stone-50 rounded-lg p-2.5">
                <p className="text-xs text-stone-400 mb-0.5">Organizer</p>
                <p className="font-semibold text-stone-800 text-xs truncate">{b.organizer_name}</p>
              </div>
              <div className="bg-stone-50 rounded-lg p-2.5">
                <p className="text-xs text-stone-400 mb-0.5">Expires</p>
                <p className="font-semibold text-stone-800 text-xs">{formatDateTime(b.expiry_time)}</p>
              </div>
            </div>

            <div className="mt-3 flex gap-2">
              <Link
                to={`/events/${b.event_id}`}
                className="btn-secondary text-xs py-1.5 px-3"
              >
                View Event →
              </Link>
            </div>
          </div>
        ))}
      </div>
    </PageLayout>
  );
}
