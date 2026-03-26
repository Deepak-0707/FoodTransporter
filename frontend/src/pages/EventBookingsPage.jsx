import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { eventsAPI } from '../services/api';
import PageLayout from '../components/PageLayout';

function formatDateTime(dt) {
  return new Date(dt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export default function EventBookingsPage() {
  const { id } = useParams();
  const [data, setData]     = useState(null); // { event, bookings, total_booked }
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState('');

  useEffect(() => {
    eventsAPI.getBookings(id)
      .then((res) => setData(res.data))
      .catch((err) => setError(err.response?.data?.error || 'Failed to load bookings'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <PageLayout><div className="text-center py-16 text-stone-400 animate-pulse-soft">Loading…</div></PageLayout>;
  if (error)   return (
    <PageLayout>
      <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl px-4 py-3">{error}</div>
      <Link to="/dashboard" className="text-sm text-stone-500 hover:underline mt-4 inline-block">← Back to Dashboard</Link>
    </PageLayout>
  );

  const { event, bookings, total_booked } = data;
  const booked_pct = event ? Math.round(((event.quantity - event.remaining_quantity) / event.quantity) * 100) : 0;

  return (
    <PageLayout
      title="Event Bookings"
      subtitle={`NGO bookings for: ${event?.title}`}
    >
      <Link to={`/events/${id}`} className="text-sm text-stone-500 hover:text-stone-700 flex items-center gap-1 mb-6">
        ← Back to Event
      </Link>

      {/* Event summary */}
      <div className="card p-5 mb-6">
        <div className="flex flex-wrap gap-4 items-center justify-between">
          <div>
            <h2 className="font-display font-bold text-lg text-stone-900">{event?.title}</h2>
            <p className="text-sm text-stone-500 mt-0.5">Expires: {formatDateTime(event?.expiry_time)}</p>
          </div>
          <div className="flex gap-3">
            <div className="text-center">
              <p className="font-bold text-xl text-stone-900">{event?.quantity}</p>
              <p className="text-xs text-stone-400">{event?.quantity_unit} total</p>
            </div>
            <div className="w-px bg-stone-200" />
            <div className="text-center">
              <p className="font-bold text-xl text-brand-600">{total_booked}</p>
              <p className="text-xs text-stone-400">{event?.quantity_unit} booked</p>
            </div>
            <div className="w-px bg-stone-200" />
            <div className="text-center">
              <p className="font-bold text-xl text-forest-600">{event?.remaining_quantity}</p>
              <p className="text-xs text-stone-400">{event?.quantity_unit} left</p>
            </div>
          </div>
        </div>

        {/* Fill bar */}
        <div className="mt-4">
          <div className="flex justify-between text-xs text-stone-500 mb-1">
            <span>{bookings.length} NGO{bookings.length !== 1 ? 's' : ''} booked</span>
            <span>{booked_pct}% claimed</span>
          </div>
          <div className="w-full bg-stone-100 rounded-full h-2.5">
            <div
              className="bg-brand-500 h-2.5 rounded-full transition-all duration-500"
              style={{ width: `${booked_pct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Bookings list */}
      {bookings.length === 0 ? (
        <div className="card p-10 text-center text-stone-400">
          <p className="text-3xl mb-2">📭</p>
          <p className="font-medium">No bookings yet for this event.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-stone-100 shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 border-b border-stone-100">
              <tr>
                <th className="text-left px-5 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wider">NGO</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wider">Email</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wider">Qty ({event?.quantity_unit})</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wider">Status</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wider">Booked At</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-50 bg-white">
              {bookings.map((b) => (
                <tr key={b.id} className="hover:bg-stone-50 transition-colors">
                  <td className="px-5 py-3.5 font-medium text-stone-900">{b.ngo_name}</td>
                  <td className="px-5 py-3.5 text-stone-500">{b.ngo_email}</td>
                  <td className="px-5 py-3.5 text-right font-semibold text-brand-700">{b.quantity_requested}</td>
                  <td className="px-5 py-3.5">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      b.status === 'confirmed' ? 'bg-forest-100 text-forest-700' : 'bg-stone-100 text-stone-500'
                    }`}>
                      {b.status}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-stone-500 text-xs">{formatDateTime(b.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PageLayout>
  );
}
