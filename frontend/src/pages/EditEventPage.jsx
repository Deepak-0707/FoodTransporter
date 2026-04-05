// src/pages/EditEventPage.jsx — Phase 2: numeric quantity + unit
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { eventsAPI } from '../services/api';
import PageLayout from '../components/PageLayout';

const UNIT_OPTIONS = ['kg', 'meals', 'portions', 'litres', 'boxes', 'bags', 'units'];

export default function EditEventPage() {
  const { id }   = useParams();
  const navigate = useNavigate();
  const [form, setForm]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  useEffect(() => {
    eventsAPI.getById(id).then((res) => {
      const e = res.data.event;
      setForm({
        title:         e.title,
        description:   e.description || '',
        latitude:      e.latitude,
        longitude:     e.longitude,
        quantity:      e.quantity,
        quantity_unit: e.quantity_unit || 'kg',
        expiry_time:   (() => {
          const d = new Date(e.expiry_time);
          const offset = d.getTimezoneOffset() * 60000;
          return new Date(d - offset).toISOString().slice(0, 16);
        })(),
      });
    }).catch(() => setError('Event not found')).finally(() => setLoading(false));
  }, [id]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.quantity || !String(form.quantity).trim()) {
      return setError('Quantity is required.');
    }
    setSaving(true);
    try {
      await eventsAPI.update(id, { ...form, expiry_time: new Date(form.expiry_time).toISOString() });
      navigate(`/events/${id}`);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update event');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <PageLayout><div className="text-stone-400 py-16 text-center animate-pulse-soft">Loading…</div></PageLayout>;
  if (error && !form) return <PageLayout><div className="bg-red-50 border border-red-200 text-red-600 rounded-xl px-4 py-3">{error}</div></PageLayout>;

  return (
    <PageLayout title="Edit Event" subtitle="Update the details of your food event.">
      <div className="max-w-lg mx-auto card p-8">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl px-4 py-3 mb-6 text-sm">⚠️ {error}</div>
        )}
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1.5">Title *</label>
            <input type="text" value={form.title} onChange={set('title')} className="input-field" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1.5">Description</label>
            <textarea value={form.description} onChange={set('description')} rows={3} className="input-field resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1.5">Quantity *</label>
              <input type="text" value={form.quantity} onChange={set('quantity')} className="input-field" placeholder="e.g. 50" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1.5">Unit *</label>
              <select value={form.quantity_unit} onChange={set('quantity_unit')} className="input-field">
                {UNIT_OPTIONS.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1.5">Latitude *</label>
              <input type="number" step="any" value={form.latitude} onChange={set('latitude')} className="input-field" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1.5">Longitude *</label>
              <input type="number" step="any" value={form.longitude} onChange={set('longitude')} className="input-field" required />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1.5">Expiry Date & Time *</label>
            <input type="datetime-local" value={form.expiry_time} onChange={set('expiry_time')} className="input-field" required />
          </div>
          <div className="flex gap-3 mt-2">
            <button type="submit" disabled={saving} className="btn-primary flex-1">
              {saving ? '⏳ Saving…' : '✅ Save Changes'}
            </button>
            <button type="button" onClick={() => navigate(`/events/${id}`)} className="btn-secondary">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </PageLayout>
  );
}
