import React, { useState } from 'react';
import { requestsAPI } from '../services/api';

/**
 * BookingForm
 * @param {string}   eventId          - UUID of the event
 * @param {number}   remainingQty     - Current remaining quantity
 * @param {string}   unit             - Unit label (kg, meals, etc.)
 * @param {function} onSuccess        - Called after successful booking with updated remaining qty
 */
export default function BookingForm({ eventId, remainingQty, unit = 'kg', onSuccess }) {
  const [qty, setQty]         = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const requested = parseInt(qty, 10);
    if (!requested || requested <= 0) {
      return setError('Please enter a valid quantity greater than 0.');
    }
    if (requested > remainingQty) {
      return setError(`Only ${remainingQty} ${unit} available. Please request less.`);
    }

    setLoading(true);
    try {
      const res = await bookingsAPI.create({ event_id: eventId, quantity_requested: requested });
      setSuccess(`Booking confirmed! You requested ${requested} ${unit}.`);
      setQty('');
      if (onSuccess) onSuccess(res.data.booking);
    } catch (err) {
      const msg = err.response?.data?.error || 'Booking failed. Please try again.';
      const available = err.response?.data?.available;
      setError(available != null
        ? `${msg} (${available} ${unit} remaining)`
        : msg
      );
    } finally {
      setLoading(false);
    }
  };

  if (remainingQty <= 0) {
    return (
      <div className="bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 text-sm text-stone-500 text-center">
        🚫 No quantity remaining for this event.
      </div>
    );
  }

  return (
    <div className="bg-forest-50 border border-forest-200 rounded-xl p-4">
      <h3 className="font-display font-semibold text-forest-900 mb-1 text-sm">Request Food</h3>
      <p className="text-xs text-forest-700 mb-3">
        Available: <strong>{remainingQty} {unit}</strong>
      </p>

      {success && (
        <div className="bg-forest-100 border border-forest-300 text-forest-800 rounded-lg px-3 py-2 text-sm mb-3 flex items-center gap-2">
          ✅ {success}
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm mb-3">
          ⚠️ {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex gap-2">
        <div className="flex-1 relative">
          <input
            type="number"
            min="1"
            max={remainingQty}
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            placeholder={`Qty (max ${remainingQty})`}
            className="input-field text-sm pr-10"
            disabled={loading || !!success}
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-stone-400">
            {unit}
          </span>
        </div>
        <button
          type="submit"
          disabled={loading || !!success || !qty}
          className="btn-primary text-sm py-2 px-4 shrink-0"
        >
          {loading ? '⏳' : success ? '✅' : 'Book'}
        </button>
      </form>
    </div>
  );
}
