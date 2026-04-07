// src/components/EventForm.jsx
// Reusable form used by both CreateEventPage and EditEventPage
import React, { useState } from 'react';

const defaultForm = {
  title:       '',
  description: '',
  latitude:    '',
  longitude:   '',
  quantity:    '',
  expiry_time: '',
};

export default function EventForm({ initialValues = {}, onSubmit, loading, submitLabel = 'Save Event' }) {
  const [form, setForm] = useState({ ...defaultForm, ...initialValues });
  const [error, setError] = useState('');

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Client-side validation
    if (!form.title.trim()) return setError('Title is required');
    if (!form.latitude || !form.longitude) return setError('Latitude and longitude are required');
    if (isNaN(form.latitude) || isNaN(form.longitude)) return setError('Latitude and longitude must be numbers');
    if (!form.quantity || isNaN(parseInt(form.quantity)) || parseInt(form.quantity) <= 0) return setError('Quantity must be a positive number');
    if (!form.expiry_time) return setError('Expiry time is required');
    if (new Date(form.expiry_time) <= new Date()) return setError('Expiry time must be in the future');

    try {
      await onSubmit({ ...form, expiry_time: new Date(form.expiry_time).toISOString() });
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong');
    }
  };

  // datetime-local needs local time — toISOString() gives UTC which is wrong for non-UTC timezones
  const localDateTimeString = (date) => {
    const offset = date.getTimezoneOffset() * 60000;
    return new Date(date - offset).toISOString().slice(0, 16);
  };
  const minDateTime = localDateTimeString(new Date(Date.now() + 30 * 60000));

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3">
          {error}
        </div>
      )}

      {/* Title */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-semibold text-stone-700">Event Title *</label>
        <input
          name="title"
          value={form.title}
          onChange={handleChange}
          placeholder="e.g. Corporate Lunch Leftovers"
          className="input-field"
          required
        />
      </div>

      {/* Description */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-semibold text-stone-700">Description</label>
        <textarea
          name="description"
          value={form.description}
          onChange={handleChange}
          placeholder="What kind of food? Any dietary notes?"
          rows={3}
          className="input-field resize-none"
        />
      </div>

      {/* Location — side by side */}
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-semibold text-stone-700">Latitude *</label>
          <input
            name="latitude"
            type="number"
            step="any"
            value={form.latitude}
            onChange={handleChange}
            placeholder="e.g. 13.0827"
            className="input-field"
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-semibold text-stone-700">Longitude *</label>
          <input
            name="longitude"
            type="number"
            step="any"
            value={form.longitude}
            onChange={handleChange}
            placeholder="e.g. 80.2707"
            className="input-field"
            required
          />
        </div>
      </div>

      <p className="text-xs text-stone-400 -mt-3">
        Tip: right-click any location on Google Maps → "What's here?" to get coordinates.
      </p>

      {/* Quantity */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-semibold text-stone-700">Food Quantity *</label>
        <input
          name="quantity"
          type="number"
          min="1"
          step="1"
          value={form.quantity}
          onChange={handleChange}
          placeholder="e.g. 50"
          className="input-field"
          required
        />
      </div>

      {/* Expiry Time */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-semibold text-stone-700">Expiry Time *</label>
        <input
          name="expiry_time"
          type="datetime-local"
          value={form.expiry_time}
          onChange={handleChange}
          min={minDateTime}
          className="input-field"
          required
        />
        <p className="text-xs text-stone-400">The food must be picked up before this time.</p>
      </div>

      <button type="submit" className="btn-primary mt-2" disabled={loading}>
        {loading ? 'Saving…' : submitLabel}
      </button>
    </form>
  );
}
