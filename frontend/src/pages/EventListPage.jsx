import React, { useEffect, useState } from 'react';
import { eventsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import PageLayout from '../components/PageLayout';
import EventCard from '../components/EventCard';

export default function EventListPage() {
  const { user } = useAuth();
  const [events, setEvents]     = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [search, setSearch]     = useState('');
  const [showMine, setShowMine] = useState(false);

  const isOrganizer = user?.role === 'ORGANIZER';

  const fetchEvents = async (mine = false) => {
    setLoading(true);
    setError('');
    try {
      const res = await eventsAPI.getAll(mine);
      setEvents(res.data.events);
      setFiltered(res.data.events);
    } catch {
      setError('Failed to load events');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchEvents(showMine); }, [showMine]);

  // Filter by search query
  useEffect(() => {
    if (!search.trim()) {
      setFiltered(events);
    } else {
      const q = search.toLowerCase();
      setFiltered(events.filter(
        (e) =>
          e.title.toLowerCase().includes(q) ||
          e.description?.toLowerCase().includes(q) ||
          e.quantity?.toLowerCase().includes(q)
      ));
    }
  }, [search, events]);

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this event?')) return;
    try {
      await eventsAPI.remove(id);
      setEvents((prev) => prev.filter((e) => e.id !== id));
    } catch {
      alert('Failed to delete event');
    }
  };

  return (
    <PageLayout
      title="Events"
      subtitle="All available food surplus events"
    >
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search events…"
          className="input-field max-w-sm"
        />
        {isOrganizer && (
          <label className="flex items-center gap-2 cursor-pointer select-none text-sm font-medium text-stone-600">
            <input
              type="checkbox"
              checked={showMine}
              onChange={(e) => setShowMine(e.target.checked)}
              className="w-4 h-4 accent-brand-500 rounded"
            />
            Show only my events
          </label>
        )}
        <span className="text-sm text-stone-400 self-center ml-auto">
          {filtered.length} event{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {loading && (
        <div className="text-center py-16 text-stone-400 animate-pulse-soft">Loading events…</div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl px-4 py-3">{error}</div>
      )}
      {!loading && !error && filtered.length === 0 && (
        <div className="card p-12 text-center text-stone-400">
          <p className="text-4xl mb-3">🔍</p>
          <p className="font-medium">No events found.</p>
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
