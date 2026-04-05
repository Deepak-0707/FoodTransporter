// src/pages/RequestFoodPage.jsx — Phase 3 + Menu Item Selection
// Replaces BookEventPage. NGO submits a request; system allocates intelligently.
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { eventsAPI, requestsAPI, menuAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import PageLayout from '../components/PageLayout';

const URGENCY_COLORS = {
  CRITICAL: 'text-red-600 bg-red-50 border-red-200',
  HIGH:     'text-orange-600 bg-orange-50 border-orange-200',
  MEDIUM:   'text-amber-700 bg-amber-50 border-amber-200',
  LOW:      'text-forest-700 bg-forest-50 border-forest-200',
  EXPIRED:  'text-stone-500 bg-stone-50 border-stone-200',
};

function formatDateTime(dt) {
  return new Date(dt).toLocaleString(undefined, {
    weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function RequestFoodPage() {
  const { id }   = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [event, setEvent]       = useState(null);
  const [menuItems, setMenuItems] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [qty, setQty]           = useState('');
  // itemQtys: { [menuItemId]: number }
  const [itemQtys, setItemQtys] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitted, setSubmitted]     = useState(false);
  const [allocation, setAllocation]   = useState(null);

  useEffect(() => {
    Promise.all([
      eventsAPI.getById(id),
      menuAPI.getByEvent(id).catch(() => ({ data: { menuItems: [] } })),
    ])
      .then(([eventRes, menuRes]) => {
        setEvent(eventRes.data.event);
        const items = menuRes.data.menuItems || [];
        setMenuItems(items);
        // Pre-fill itemQtys with 0
        const init = {};
        items.forEach(item => { init[item.id] = 0; });
        setItemQtys(init);
      })
      .catch(() => setError('Event not found'))
      .finally(() => setLoading(false));
  }, [id]);

  // When any menu item qty changes, auto-update the total qty
  const handleItemQtyChange = (itemId, value) => {
    const newVal = Math.max(0, parseInt(value, 10) || 0);
    const newItemQtys = { ...itemQtys, [itemId]: newVal };
    setItemQtys(newItemQtys);
    // Auto-sum total
    const total = Object.values(newItemQtys).reduce((a, b) => a + b, 0);
    if (total > 0) setQty(String(total));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError('');
    const quantity = parseInt(qty, 10);
    if (!quantity || quantity <= 0) {
      setSubmitError('Please enter a valid quantity');
      return;
    }

    // Build selected_items array (only items with qty > 0)
    const selected_items = menuItems
      .filter(item => (itemQtys[item.id] || 0) > 0)
      .map(item => ({
        menu_item_id: item.id,
        name: item.name,
        quantity: itemQtys[item.id],
        quantity_unit: item.quantity_unit,
      }));

    setSubmitting(true);
    try {
      const res = await requestsAPI.create({
        event_id: id,
        quantity_requested: quantity,
        selected_items: selected_items.length > 0 ? selected_items : undefined,
      });
      setSubmitted(true);
      setAllocation(res.data.allocation);
    } catch (err) {
      setSubmitError(err.response?.data?.error || 'Failed to submit request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <PageLayout><div className="text-center py-16 text-stone-400 animate-pulse-soft">Loading…</div></PageLayout>;
  if (error)   return (
    <PageLayout>
      <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl px-4 py-3">{error}</div>
      <Link to="/events" className="text-sm text-stone-500 hover:underline mt-4 inline-block">← Back to Events</Link>
    </PageLayout>
  );

  const isExpired = event.label === 'EXPIRED' || new Date(event.expiry_time) < new Date();
  const isNGO     = user?.role === 'NGO';
  const urgencyColor = URGENCY_COLORS[event.label] || URGENCY_COLORS.LOW;
  const hasMenuItems = menuItems.length > 0;

  return (
    <PageLayout title="Request Food" subtitle="Submit your food request — the system will allocate fairly.">
      <div className="max-w-xl mx-auto">
        <Link to={`/events/${id}`} className="text-sm text-stone-500 hover:text-stone-700 flex items-center gap-1 mb-6">
          ← Back to Event
        </Link>

        {/* Urgency Banner */}
        {event.label === 'CRITICAL' && (
          <div className="mb-5 flex items-center gap-3 bg-red-600 text-white rounded-2xl px-5 py-3 shadow-md">
            <span className="text-2xl animate-bounce">🚨</span>
            <div>
              <p className="font-bold text-sm">URGENT — Expires very soon!</p>
              <p className="text-red-100 text-xs">This food expires in under 1 hour. Act quickly.</p>
            </div>
          </div>
        )}
        {event.label === 'HIGH' && (
          <div className="mb-5 flex items-center gap-3 bg-orange-50 border border-orange-200 text-orange-700 rounded-2xl px-5 py-3">
            <span className="text-xl">⚠️</span>
            <p className="text-sm font-medium">High Priority — expires in under 6 hours.</p>
          </div>
        )}

        {/* Event Summary */}
        <div className="card p-6 mb-6">
          <div className="flex items-start justify-between gap-3 mb-4">
            <h2 className="font-display font-bold text-xl text-stone-900">{event.title}</h2>
            <span className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full border ${urgencyColor}`}>
              {event.label}
            </span>
          </div>

          {event.description && <p className="text-stone-600 text-sm mb-4">{event.description}</p>}

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-brand-50 border border-brand-100 rounded-xl p-3">
              <p className="text-xs text-brand-600 font-semibold uppercase tracking-wide mb-1">Total Quantity</p>
              <p className="text-stone-900 font-bold text-lg">{event.quantity} <span className="text-sm font-normal text-stone-500">{event.quantity_unit}</span></p>
            </div>
            <div className={`border rounded-xl p-3 ${event.remaining_quantity > 0 ? 'bg-forest-50 border-forest-100' : 'bg-stone-50 border-stone-200'}`}>
              <p className={`text-xs font-semibold uppercase tracking-wide mb-1 ${event.remaining_quantity > 0 ? 'text-forest-600' : 'text-stone-400'}`}>Still Available</p>
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
                className={`h-2 rounded-full transition-all duration-500 ${event.label === 'CRITICAL' ? 'bg-red-500' : 'bg-forest-500'}`}
                style={{ width: `${(event.remaining_quantity / event.quantity) * 100}%` }}
              />
            </div>
          </div>

          <div className="text-sm text-stone-600 space-y-1">
            <p>⏰ Expires: <strong>{formatDateTime(event.expiry_time)}</strong></p>
            <p>👤 By: <strong>{event.organizer_name}</strong></p>
          </div>
        </div>

        {/* How Allocation Works */}
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-5 text-sm text-blue-800">
          <p className="font-semibold mb-1">ℹ️ How smart allocation works</p>
          <p className="text-blue-700 text-xs leading-relaxed">
            Your request enters a queue. If total requests exceed available food, the system
            distributes proportionally so every NGO gets a fair share. You'll see your allocated
            quantity once the organizer runs allocation.
          </p>
        </div>

        {/* Form or success state */}
        {!isNGO && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-700">
            ℹ️ Only NGO accounts can request food from events.
          </div>
        )}

        {isNGO && isExpired && (
          <div className="bg-stone-50 border border-stone-200 rounded-xl p-4 text-sm text-stone-500">
            This event has expired and is no longer accepting requests.
          </div>
        )}

        {isNGO && !isExpired && !submitted && (
          <form onSubmit={handleSubmit} className="card p-6 space-y-5">
            <h3 className="font-display font-semibold text-stone-900">Submit Your Request</h3>

            {/* Per-menu-item quantities (if menu exists) */}
            {hasMenuItems && (
              <div>
                <label className="block text-sm font-semibold text-stone-700 mb-2">
                  🍽️ Select quantities by menu item
                </label>
                <div className="space-y-2 bg-stone-50 rounded-xl p-3 border border-stone-100">
                  {menuItems.map(item => (
                    <div key={item.id} className="flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-stone-800 truncate">{item.name}</p>
                        <p className="text-xs text-stone-400">Available: {item.quantity} {item.quantity_unit}</p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleItemQtyChange(item.id, (itemQtys[item.id] || 0) - 1)}
                          className="w-7 h-7 rounded-lg bg-stone-200 hover:bg-stone-300 text-stone-700 font-bold text-sm flex items-center justify-center transition-colors"
                        >−</button>
                        <input
                          type="number"
                          min="0"
                          max={item.quantity}
                          value={itemQtys[item.id] || 0}
                          onChange={(e) => handleItemQtyChange(item.id, e.target.value)}
                          className="w-16 text-center border border-stone-200 rounded-lg py-1 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-brand-300"
                        />
                        <button
                          type="button"
                          onClick={() => handleItemQtyChange(item.id, (itemQtys[item.id] || 0) + 1)}
                          className="w-7 h-7 rounded-lg bg-brand-100 hover:bg-brand-200 text-brand-700 font-bold text-sm flex items-center justify-center transition-colors"
                        >+</button>
                        <span className="text-xs text-stone-400 w-8">{item.quantity_unit}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-stone-400 mt-1.5">
                  Select items above to auto-fill total, or enter total manually below.
                </p>
              </div>
            )}

            {/* Total quantity (always visible) */}
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1.5">
                {hasMenuItems ? 'Total quantity requested' : `Quantity requested`} ({event.quantity_unit})
              </label>
              <input
                type="number"
                min="1"
                max={event.remaining_quantity}
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                className="input-field"
                placeholder={`e.g. ${Math.ceil(event.remaining_quantity / 2)}`}
                required
              />
              <p className="text-xs text-stone-400 mt-1">
                Up to {event.remaining_quantity} {event.quantity_unit} available. Actual allocation may vary.
              </p>
            </div>

            {submitError && (
              <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl px-4 py-3 text-sm">
                {submitError}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className={`w-full font-semibold py-3 px-4 rounded-xl transition-all ${
                event.label === 'CRITICAL'
                  ? 'bg-red-600 hover:bg-red-700 text-white'
                  : 'btn-primary'
              } ${submitting ? 'opacity-60 cursor-not-allowed' : ''}`}
            >
              {submitting ? 'Submitting…' : '📋 Submit Request'}
            </button>
          </form>
        )}

        {/* Success State */}
        {submitted && (
          <div className="card p-6 text-center space-y-4">
            <div className="text-5xl">✅</div>
            <h3 className="font-display font-bold text-xl text-stone-900">Request Submitted!</h3>
            <p className="text-stone-500 text-sm">
              Your request has been received. The system will allocate food fairly across all NGOs.
            </p>

            {/* Allocation preview if already processed */}
            {allocation && allocation.results?.length > 0 && (() => {
              const mine = allocation.results.find((r) => r.status === 'APPROVED');
              return mine ? (
                <div className="bg-forest-50 border border-forest-200 rounded-xl p-4 text-sm text-forest-800">
                  <p className="font-semibold">🎉 Already allocated!</p>
                  <p>You've been allocated <strong>{mine.allocated_quantity} {event.quantity_unit}</strong>.</p>
                </div>
              ) : (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
                  <p className="font-semibold">⏳ Pending allocation</p>
                  <p>Check back soon to see your allocated quantity.</p>
                </div>
              );
            })()}

            <div className="flex gap-3 justify-center pt-2">
              <Link to="/requests" className="btn-primary text-sm">View My Requests</Link>
              <Link to="/events" className="btn-secondary text-sm">Browse More Events</Link>
            </div>
          </div>
        )}
      </div>
    </PageLayout>
  );
}