// src/components/RequestForm.jsx — Phase 4 (with menu item selection)
import React, { useState, useEffect } from 'react';
import { requestsAPI, menuAPI } from '../services/api';
import { useNotifications } from '../context/NotificationContext';

const URGENCY = {
  CRITICAL: 'bg-red-100 text-red-700 border-red-200',
  HIGH:     'bg-orange-100 text-orange-700 border-orange-200',
  MEDIUM:   'bg-amber-100 text-amber-700 border-amber-200',
  LOW:      'bg-green-100 text-green-700 border-green-200',
};

export default function RequestForm({ event, onSuccess }) {
  const { addNotification } = useNotifications();

  const [menuItems, setMenuItems]     = useState([]);
  const [menuLoading, setMenuLoading] = useState(true);
  const [itemQtys, setItemQtys]       = useState({});
  const [note, setNote]               = useState('');
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState('');
  const [success, setSuccess]         = useState('');

  const maxQty    = event?.remaining_quantity || 0;
  const eventUnit = event?.quantity_unit || 'units';

  useEffect(() => {
    if (!event?.id) return;
    setMenuLoading(true);
    menuAPI.getByEvent(event.id)
      .then((res) => setMenuItems(res.data.menuItems || []))
      .catch(() => setMenuItems([]))
      .finally(() => setMenuLoading(false));
  }, [event?.id]);

  const totalRequested = Object.values(itemQtys).reduce((s, v) => s + (Number(v) || 0), 0);

  const setItemQty = (itemId, val) => {
    setItemQtys((prev) => ({ ...prev, [itemId]: val }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const qty = totalRequested;
    if (!qty || qty <= 0) return setError('Please enter a quantity for at least one item.');
    if (qty > maxQty)     return setError(`Only ${maxQty} ${eventUnit} remaining. You requested ${qty}.`);

    const selectedItems = menuItems
      .filter((item) => Number(itemQtys[item.id]) > 0)
      .map((item) => ({ menu_item_id: item.id, name: item.name, quantity: Number(itemQtys[item.id]) }));

    setLoading(true);
    try {
      const res = await requestsAPI.create({
        event_id:           event.id,
        quantity_requested: qty,
        note:               note.trim() || undefined,
        selected_items:     selectedItems.length > 0 ? selectedItems : undefined,
      });

      const allocated = res.data.allocation?.allocated || 0;
      setSuccess(allocated > 0
        ? `✅ ${allocated} ${eventUnit} allocated to you!`
        : '✅ Request submitted! Awaiting allocation.');
      setItemQtys({});
      setNote('');

      addNotification({ message: `Food request submitted for "${event.title}" — ${qty} ${eventUnit}`, type: 'SUCCESS' });
      if (onSuccess) onSuccess(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to submit request. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {error   && <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl px-3 py-2 text-sm">{error}</div>}
      {success && <div className="bg-green-50 border border-green-200 text-green-700 rounded-xl px-3 py-2 text-sm font-medium">{success}</div>}

      {menuLoading ? (
        <div className="space-y-2">{[1,2].map(i => <div key={i} className="h-16 bg-stone-100 rounded-xl animate-pulse"/>)}</div>
      ) : menuItems.length > 0 ? (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-stone-700">Select items to request:</p>
          {menuItems.map((item) => {
            const wasteHours = item.waste_time_minutes ? item.waste_time_minutes / 60 : 24;
            const urgencyKey = item.urgency_label || (wasteHours <= 2 ? 'CRITICAL' : wasteHours <= 6 ? 'HIGH' : wasteHours <= 24 ? 'MEDIUM' : 'LOW');
            const urgencyCls = URGENCY[urgencyKey] || URGENCY.LOW;
            const qty = itemQtys[item.id] || '';
            // Per-item max = min(item's own quantity, what's left of the event after other items)
            const otherItemsTotal = Object.entries(itemQtys)
              .filter(([id]) => id !== item.id)
              .reduce((s, [, v]) => s + (Number(v) || 0), 0);
            const itemMax = Math.min(item.quantity, Math.max(0, maxQty - otherItemsTotal));
            return (
              <div key={item.id} className={`p-3 rounded-xl border transition-all ${qty > 0 ? 'border-brand-300 bg-brand-50' : 'border-stone-200 bg-white'}`}>
                {/* Name row */}
                <div className="flex items-center justify-between gap-2 mb-2">
                  <p className="text-sm font-semibold text-stone-900 flex-1">{item.name}</p>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border shrink-0 ${urgencyCls}`}>{urgencyKey}</span>
                </div>
                {/* Details + input row */}
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs text-stone-500 space-y-0.5">
                    <p>{item.quantity} {item.quantity_unit} available · max you can take: <strong>{itemMax}</strong></p>
                    {item.waste_time_minutes && <p className="text-stone-400">spoils in {wasteHours}h</p>}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <input
                      type="number" min="0" max={itemMax} step="1"
                      value={qty}
                      onChange={(e) => {
                        const val = Math.min(Number(e.target.value), itemMax);
                        setItemQty(item.id, val >= 0 ? val : '');
                      }}
                      placeholder="0"
                      className="w-16 border border-stone-300 rounded-lg text-center text-sm py-1 px-1 focus:outline-none focus:border-brand-400"
                    />
                    <span className="text-xs text-stone-400">{item.quantity_unit}</span>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Total */}
          {totalRequested > 0 && (
            <div className={`flex justify-between text-sm font-semibold px-3 py-2 rounded-xl border ${totalRequested > maxQty ? 'bg-red-50 text-red-600 border-red-200' : 'bg-brand-50 text-brand-700 border-brand-200'}`}>
              <span>Total</span>
              <span>{totalRequested} / {maxQty} {eventUnit}</span>
            </div>
          )}
        </div>
      ) : (
        /* No menu items — plain quantity input */
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1.5">
            Quantity ({eventUnit}) <span className="ml-1 text-xs text-stone-400">Max: {maxQty}</span>
          </label>
          <input
            type="number" min="1" max={maxQty} step="1"
            value={itemQtys['_total'] || ''} onChange={(e) => setItemQtys({ _total: e.target.value })}
            placeholder={`Enter amount (max ${maxQty})`} className="input-field" required
          />
          {Number(itemQtys['_total']) > 0 && Number(itemQtys['_total']) <= maxQty && (
            <div className="mt-2">
              <div className="w-full bg-stone-100 rounded-full h-2">
                <div className="bg-brand-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(100, (Number(itemQtys['_total']) / maxQty) * 100)}%` }}/>
              </div>
              <p className="text-xs text-stone-400 mt-1">{Math.round((Number(itemQtys['_total']) / maxQty) * 100)}% of available</p>
            </div>
          )}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-stone-700 mb-1">
          Note <span className="text-stone-400 font-normal text-xs">(optional)</span>
        </label>
        <textarea value={note} onChange={(e) => setNote(e.target.value)}
          placeholder="Any special instructions..." rows={2} className="input-field resize-none"/>
      </div>

      <button type="submit" disabled={loading || totalRequested <= 0}
        className={`btn-primary w-full ${event?.label === 'CRITICAL' ? 'bg-red-600 hover:bg-red-700' : ''}`}>
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            Submitting…
          </span>
        ) : event?.label === 'CRITICAL' ? '🚨 Request Urgently' : '📋 Submit Request'}
      </button>
    </form>
  );
}
