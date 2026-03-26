import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { eventsAPI } from '../services/api';
import PageLayout from '../components/PageLayout';

const UNIT_OPTIONS = ['kg', 'meals', 'portions', 'litres', 'boxes', 'bags', 'units'];

export default function CreateEventPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    title: '', description: '', latitude: '', longitude: '',
    quantity: '', quantity_unit: 'kg', expiry_time: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.title || !form.latitude || !form.longitude || !form.quantity || !form.expiry_time) {
      return setError('All required fields must be filled.');
    }
    if (isNaN(parseInt(form.quantity)) || parseInt(form.quantity) <= 0) {
      return setError('Quantity must be a positive whole number.');
    }
    setLoading(true);
    try {
      await eventsAPI.create(form);
      navigate('/events');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create event');
    } finally {
      setLoading(false);
    }
  };

  // Auto-fill location via browser geolocation
  const fillLocation = () => {
    if (!navigator.geolocation) return alert('Geolocation not supported');
    navigator.geolocation.getCurrentPosition(
      (pos) => setForm((f) => ({
        ...f,
        latitude:  pos.coords.latitude.toFixed(6),
        longitude: pos.coords.longitude.toFixed(6),
      })),
      () => alert('Could not get location. Please enter manually.')
    );
  };

  return (
    <PageLayout title="Create Event" subtitle="Post a new food surplus event for NGOs to book.">
      <div className="max-w-lg mx-auto card p-8">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl px-4 py-3 mb-6 text-sm">
            ⚠️ {error}
          </div>
        )}
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1.5">Title *</label>
            <input type="text" value={form.title} onChange={set('title')}
              placeholder="e.g. Wedding surplus — 80 meals" className="input-field" required />
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1.5">Description</label>
            <textarea value={form.description} onChange={set('description')} rows={3}
              placeholder="Details about the food, pickup instructions…" className="input-field resize-none" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1.5">Quantity *</label>
              <input type="number" min="1" value={form.quantity} onChange={set('quantity')}
                placeholder="e.g. 50" className="input-field" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1.5">Unit *</label>
              <select value={form.quantity_unit} onChange={set('quantity_unit')} className="input-field">
                {UNIT_OPTIONS.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-medium text-stone-700">Location *</label>
              <button type="button" onClick={fillLocation}
                className="text-xs text-brand-600 hover:underline font-medium">
                📍 Use my location
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input type="number" step="any" value={form.latitude} onChange={set('latitude')}
                placeholder="Latitude" className="input-field" required />
              <input type="number" step="any" value={form.longitude} onChange={set('longitude')}
                placeholder="Longitude" className="input-field" required />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1.5">Expiry Date & Time *</label>
            <input type="datetime-local" value={form.expiry_time} onChange={set('expiry_time')}
              className="input-field" required />
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full mt-2">
            {loading ? '⏳ Creating…' : '🍱 Create Event'}
          </button>
        </form>
      </div>
    </PageLayout>
  );
}
