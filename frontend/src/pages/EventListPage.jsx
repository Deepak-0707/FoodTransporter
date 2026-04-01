// src/pages/EventListPage.jsx — Phase 3: sorted by urgency, urgency legend
import React, { useEffect, useState } from 'react';
import { eventsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import PageLayout from '../components/PageLayout';
import EventCard from '../components/EventCard';

const URGENCY_ORDER = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3, EXPIRED: 4 };

export default function EventListPage() {
  const { user } = useAuth();
  const [events, setEvents]     = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [search, setSearch]     = useState('');
  const [showMine, setShowMine] = useState(false);
  const [urgencyFilter, setUrgencyFilter] = useState('ALL');

  const isOrganizer = user?.role === 'ORGANIZER';

  const fetchEvents = async (mine = false) => {
    setLoading(true);
    setError('');
    try {
      const res = await eventsAPI.getAll(mine);
      setEvents(res.data.events);
    } catch {
      setError('Failed to load events');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchEvents(showMine); }, [showMine]);

  useEffect(() => {
    let result = [...events];

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (e) => e.title.toLowerCase().includes(q) || e.description?.toLowerCase().includes(q)
      );
    }

    if (urgencyFilter !== 'ALL') {
      result = result.filter((e) => e.label === urgencyFilter);
    }

    // Events already arrive sorted by urgency from API, preserve that order
    setFiltered(result);
  }, [search, events, urgencyFilter]);

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this event?')) return;
    try {
      await eventsAPI.remove(id);
      setEvents((prev) => prev.filter((e) => e.id !== id));
    } catch {
      alert('Failed to delete event');
    }
  };

  const criticalCount = events.filter((e) => e.label === 'CRITICAL').length;
  const highCount     = events.filter((e) => e.label === 'HIGH').length;

  return (
    <PageLayout title="Events" subtitle="Sorted by urgency — most critical food first">

      {/* Urgency alert */}
      {(criticalCount > 0 || highCount > 0) && (
        <div className="mb-5 flex flex-wrap gap-3">
          {criticalCount > 0 && (
            <button
              onClick={() => setUrgencyFilter(urgencyFilter === 'CRITICAL' ? 'ALL' : 'CRITICAL')}
              className={`flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-xl border transition-all ${
                urgencyFilter === 'CRITICAL' ? 'bg-red-600 text-white border-red-600' : 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
              }`}
            >
              🚨 {criticalCount} URGENT (under 1h)
            </button>
          )}
          {highCount > 0 && (
            <button
              onClick={() => setUrgencyFilter(urgencyFilter === 'HIGH' ? 'ALL' : 'HIGH')}
              className={`flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-xl border transition-all ${
                urgencyFilter === 'HIGH' ? 'bg-orange-600 text-white border-orange-600' : 'bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100'
              }`}
            >
              ⚠️ {highCount} High Priority (under 6h)
            </button>
          )}
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6 flex-wrap">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search events…"
          className="input-field max-w-sm"
        />

        {/* Urgency filter pills */}
        <div className="flex gap-2 flex-wrap">
          {['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((u) => (
            <button
              key={u}
              onClick={() => setUrgencyFilter(u)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-all ${
                urgencyFilter === u
                  ? 'bg-stone-800 text-white border-stone-800'
                  : 'bg-white text-stone-600 border-stone-200 hover:border-stone-400'
              }`}
            >
              {u}
            </button>
          ))}
        </div>

        {isOrganizer && (
          <label className="flex items-center gap-2 cursor-pointer select-none text-sm font-medium text-stone-600 ml-auto">
            <input
              type="checkbox"
              checked={showMine}
              onChange={(e) => setShowMine(e.target.checked)}
              className="w-4 h-4 accent-brand-500 rounded"
            />
            My events only
          </label>
        )}

        <span className="text-sm text-stone-400 self-center sm:ml-auto">
          {filtered.length} event{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {loading && <div className="text-center py-16 text-stone-400 animate-pulse-soft">Loading events…</div>}
      {error   && <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl px-4 py-3">{error}</div>}

      {!loading && !error && filtered.length === 0 && (
        <div className="card p-12 text-center text-stone-400">
          <p className="text-4xl mb-3">🔍</p>
          <p className="font-medium">No events found.</p>
          {urgencyFilter !== 'ALL' && (
            <button onClick={() => setUrgencyFilter('ALL')} className="text-sm text-brand-600 hover:underline mt-2">
              Clear urgency filter
            </button>
          )}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((event) => (
          <EventCard key={event.id} event={event} onDelete={handleDelete} />
        ))}
      </div>
    </PageLayout>
  );
}
