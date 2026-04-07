// src/pages/CreateEventPage.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { eventsAPI, menuAPI } from '../services/api';
import PageLayout from '../components/PageLayout';
import MenuForm from '../components/MenuForm';
import MenuList from '../components/MenuList';

const UNIT_OPTIONS = ['kg', 'meals', 'portions', 'litres', 'boxes', 'bags', 'units'];

const defaultForm = {
  title: '',
  description: '',
  latitude: '',
  longitude: '',
  quantity: '',
  quantity_unit: 'kg',
  expiry_time: '',
};

export default function CreateEventPage() {
  const navigate = useNavigate();

  const [form, setForm]           = useState(defaultForm);
  const [menuItems, setMenuItems] = useState([]);
  const [loading, setLoading]     = useState(false);
  const [locLoading, setLocLoading] = useState(false);
  const [error, setError]         = useState('');
  const [locError, setLocError]   = useState('');

  // datetime-local needs local time string, NOT UTC (toISOString gives UTC which is wrong for IST etc.)
  const localDateTimeString = (date) => {
    const offset = date.getTimezoneOffset() * 60000;
    return new Date(date - offset).toISOString().slice(0, 16);
  };
  const minDateTime = localDateTimeString(new Date(Date.now() + 30 * 60000));

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    if (e.target.name === 'latitude' || e.target.name === 'longitude') {
      setLocError('');
    }
  };

  // GPS auto-detection
  const detectLocation = () => {
    if (!navigator.geolocation) {
      setLocError('Geolocation is not supported by your browser.');
      return;
    }
    setLocLoading(true);
    setLocError('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm((prev) => ({
          ...prev,
          latitude:  pos.coords.latitude.toFixed(6),
          longitude: pos.coords.longitude.toFixed(6),
        }));
        setLocError(''); // clear any stale error on success
        setLocLoading(false);
      },
      (err) => {
        setLocError('Could not get location: ' + err.message);
        setLocLoading(false);
      },
      { timeout: 10000, enableHighAccuracy: true, maximumAge: 0 }
    );
  };

  const handleAddMenuItem = (item) => {
    setMenuItems((prev) => [...prev, { ...item, id: Date.now().toString() }]);
  };

  const handleRemoveMenuItem = (id) => {
    setMenuItems((prev) => prev.filter((i) => i.id !== id));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!form.title.trim())                               return setError('Title is required.');
    if (!form.latitude || !form.longitude)                return setError('Location is required. Use "Detect" or enter manually.');
    if (isNaN(form.latitude) || isNaN(form.longitude))   return setError('Latitude and longitude must be numbers.');
    if (!form.quantity || parseInt(form.quantity) <= 0)   return setError('Quantity must be a positive number.');
    if (!form.expiry_time)                                return setError('Expiry time is required.');
    if (new Date(form.expiry_time) <= new Date())         return setError('Expiry time must be in the future.');

    // Convert datetime-local value (local time, no tz) to full ISO with offset
    // so Postgres stores the correct UTC time regardless of server timezone
    const expiryWithTZ = new Date(form.expiry_time).toISOString();

    setLoading(true);
    try {
      const res = await eventsAPI.create({ ...form, expiry_time: expiryWithTZ });
      const newId = res.data.event?.id;

      // Post any queued menu items to the new event
      if (newId && menuItems.length > 0) {
        const results = await Promise.allSettled(
          menuItems.map((item) =>
            menuAPI.addItem(newId, {
              name:               item.name,
              quantity:           item.quantity,
              quantity_unit:      item.quantity_unit || 'kg',
              waste_time_minutes: item.waste_time_minutes,
            })
          )
        );

        const failed = results.filter((r) => r.status === 'rejected');
        if (failed.length > 0) {
          console.error('[CreateEvent] Some menu items failed to save:', failed.map((f) => f.reason));
          // Don't block navigation — event was created, show partial warning
          setError(`Event created, but ${failed.length} menu item(s) failed to save. You can add them from the event page.`);
          setLoading(false);
          navigate(`/events/${newId}`);
          return;
        }
      }

      navigate(newId ? `/events/${newId}` : '/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create event. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageLayout title="Create Event" subtitle="Share surplus food with nearby NGOs and shelters.">
      <div className="max-w-lg mx-auto">
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3">
              ⚠️ {error}
            </div>
          )}

          {/* ── Event Details Card ── */}
          <div className="card p-6 flex flex-col gap-5">
            <h3 className="font-display font-semibold text-stone-800 text-base">Event Details</h3>

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

            {/* Quantity + Unit */}
            <div className="grid grid-cols-2 gap-3">
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
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold text-stone-700">Unit *</label>
                <select
                  name="quantity_unit"
                  value={form.quantity_unit}
                  onChange={handleChange}
                  className="input-field"
                >
                  {UNIT_OPTIONS.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
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
              <p className="text-xs text-stone-400">Food must be picked up before this time.</p>
            </div>
          </div>

          {/* ── Location Card ── */}
          <div className="card p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-semibold text-stone-800 text-base">📍 Location</h3>
              <button
                type="button"
                onClick={detectLocation}
                disabled={locLoading}
                className="flex items-center gap-1.5 text-xs font-semibold text-brand-600 border border-brand-200 bg-brand-50 hover:bg-brand-100 px-3 py-1.5 rounded-lg transition-all disabled:opacity-50"
              >
                {locLoading ? (
                  <>
                    <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                    Detecting…
                  </>
                ) : (
                  <>🎯 Auto-detect</>
                )}
              </button>
            </div>

            {locError && (
              <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{locError}</p>
            )}

            {form.latitude && form.longitude && !locLoading && (
              <div className="text-xs text-forest-700 bg-forest-50 border border-forest-100 rounded-lg px-3 py-2 flex items-center gap-1.5">
                ✅ Location set: {parseFloat(form.latitude).toFixed(4)}, {parseFloat(form.longitude).toFixed(4)}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
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
            <p className="text-xs text-stone-400 -mt-1">
              Tip: right-click any location on Google Maps → "What's here?" to get coordinates.
            </p>
          </div>

          {/* ── Menu Items Card ── */}
          <div className="card p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-semibold text-stone-800 text-base">🍽️ Menu Items</h3>
              {menuItems.length > 0 && (
                <span className="text-xs bg-brand-100 text-brand-700 px-2 py-0.5 rounded-full">
                  {menuItems.length} added
                </span>
              )}
            </div>

            <MenuList
              items={menuItems}
              onRemove={handleRemoveMenuItem}
              showRemove={true}
            />

            <div className="border-t border-stone-100 pt-4">
              <MenuForm onAdd={handleAddMenuItem} />
            </div>
          </div>

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                Creating event…
              </span>
            ) : '🎉 Create Event'}
          </button>

        </form>
      </div>
    </PageLayout>
  );
}