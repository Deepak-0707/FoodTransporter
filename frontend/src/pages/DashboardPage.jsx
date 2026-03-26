// src/pages/DashboardPage.jsx
// Role-aware dashboard: Organizer sees their stats & events; NGO sees available events
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { eventsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import PageLayout from '../components/PageLayout';
import EventCard from '../components/EventCard';

function StatCard({ icon, label, value, accent }) {
  return (
    <div className={`card p-5 flex items-center gap-4 ${accent}`}>
      <span className="text-3xl">{icon}</span>
      <div>
        <p className="text-2xl font-display font-bold text-stone-900">{value}</p>
        <p className="text-sm text-stone-500">{label}</p>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [events, setEvents]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  const isOrganizer = user?.role === 'ORGANIZER';

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const res = await eventsAPI.getAll(isOrganizer); // mine=true for organizer
      setEvents(res.data.events);
    } catch {
      setError('Failed to load events');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchEvents(); }, []);

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this event? This cannot be undone.')) return;
    try {
      await eventsAPI.remove(id);
      setEvents((prev) => prev.filter((e) => e.id !== id));
    } catch {
      alert('Failed to delete event');
    }
  };

  // Stats
  const now = new Date();
  const activeEvents  = events.filter((e) => new Date(e.expiry_time) > now);
  const expiredEvents = events.filter((e) => new Date(e.expiry_time) <= now);

  return (
    <PageLayout
      title={`Welcome back, ${user?.name} 👋`}
      subtitle={isOrganizer
        ? 'Manage your food surplus events below.'
        : 'Find available food events in your area.'}
    >
      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
        <StatCard icon="📋" label="Total Events"  value={events.length} />
        <StatCard icon="✅" label="Active"         value={activeEvents.length} />
        <StatCard icon="⏳" label="Expired"        value={expiredEvents.length} />
      </div>

      {/* Organizer CTA */}
      {isOrganizer && (
        <div className="bg-gradient-to-r from-brand-500 to-brand-600 rounded-2xl p-6 mb-8 flex items-center justify-between gap-4">
          <div>
            <h2 className="font-display font-bold text-white text-lg">Have food to share?</h2>
            <p className="text-brand-100 text-sm mt-0.5">Post a new event so NGOs can collect it.</p>
          </div>
          <Link to="/events/new" className="btn-secondary shrink-0 text-sm">
            + New Event
          </Link>
        </div>
      )}

      {/* NGO CTA */}
      {!isOrganizer && (
        <div className="bg-gradient-to-r from-forest-600 to-forest-700 rounded-2xl p-6 mb-8 flex items-center justify-between gap-4">
          <div>
            <h2 className="font-display font-bold text-white text-lg">Looking for food?</h2>
            <p className="text-forest-100 text-sm mt-0.5">Browse events on the map to find pickups near you.</p>
          </div>
          <Link to="/map" className="btn-secondary shrink-0 text-sm">
            Open Map
          </Link>
        </div>
      )}

      {/* Events section */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display font-semibold text-xl text-stone-900">
          {isOrganizer ? 'Your Events' : 'Available Events'}
        </h2>
        <Link to="/events" className="text-sm text-brand-600 hover:underline font-medium">
          View all →
        </Link>
      </div>

      {loading && (
        <div className="text-center py-12 text-stone-400 animate-pulse-soft">Loading events…</div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl px-4 py-3">{error}</div>
      )}
      {!loading && !error && events.length === 0 && (
        <div className="card p-10 text-center text-stone-400">
          <p className="text-4xl mb-3">🍽️</p>
          <p className="font-medium">No events yet.</p>
          {isOrganizer && (
            <Link to="/events/new" className="btn-primary mt-4 inline-block text-sm">
              Create your first event
            </Link>
          )}
        </div>
      )}

      {/* Show only first 3 on dashboard */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {events.slice(0, 3).map((event) => (
          <EventCard key={event.id} event={event} onDelete={handleDelete} />
        ))}
      </div>
    </PageLayout>
  );
}
