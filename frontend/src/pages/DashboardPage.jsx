// src/pages/DashboardPage.jsx — Phase 3
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { eventsAPI, requestsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import PageLayout from '../components/PageLayout';
import EventCard from '../components/EventCard';

function StatCard({ icon, label, value }) {
  return (
    <div className="card p-5 flex items-center gap-4">
      <span className="text-3xl">{icon}</span>
      <div>
        <p className="text-2xl font-display font-bold text-stone-900">{value}</p>
        <p className="text-sm text-stone-500">{label}</p>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { user }    = useAuth();
  const isOrganizer = user?.role === 'ORGANIZER';

  const [events, setEvents]     = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const evRes = await eventsAPI.getAll(isOrganizer);
      setEvents(evRes.data.events);

      if (!isOrganizer) {
        const rqRes = await requestsAPI.getMine();
        setRequests(rqRes.data.requests);
      }
    } catch {
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this event? This cannot be undone.')) return;
    try {
      await eventsAPI.remove(id);
      setEvents((prev) => prev.filter((e) => e.id !== id));
    } catch {
      alert('Failed to delete event');
    }
  };

  const now           = new Date();
  const activeEvents  = events.filter((e) => new Date(e.expiry_time) > now);
  const urgentEvents  = activeEvents.filter((e) => e.label === 'CRITICAL' || e.label === 'HIGH');
  const myApproved    = requests.filter((r) => r.status === 'APPROVED');
  const myPending     = requests.filter((r) => r.status === 'PENDING');

  // For organizers: count total pending requests across their events
  const totalPendingRequests = isOrganizer
    ? events.reduce((s, e) => s + parseInt(e.pending_requests || 0), 0)
    : 0;

  return (
    <PageLayout
      title={`Welcome back, ${user?.name} 👋`}
      subtitle={isOrganizer ? 'Manage your food surplus events below.' : 'Find and request available food near you.'}
    >

      {/* Urgent alert for NGOs */}
      {!isOrganizer && urgentEvents.length > 0 && (
        <div className="mb-6 flex items-center gap-3 bg-red-600 text-white rounded-2xl px-5 py-4 shadow-lg">
          <span className="text-3xl animate-bounce">🚨</span>
          <div className="flex-1">
            <p className="font-bold">
              {urgentEvents.length} urgent event{urgentEvents.length > 1 ? 's' : ''} expiring soon!
            </p>
            <p className="text-red-100 text-sm">Act now before these food items expire.</p>
          </div>
          <Link to="/events" className="shrink-0 bg-white text-red-600 font-semibold text-sm px-4 py-2 rounded-xl hover:bg-red-50 transition-colors">
            View →
          </Link>
        </div>
      )}

      {/* Organizer: pending allocation alert */}
      {isOrganizer && totalPendingRequests > 0 && (
        <div className="mb-6 flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4">
          <span className="text-2xl">⏳</span>
          <div className="flex-1">
            <p className="font-semibold text-amber-800">
              {totalPendingRequests} request{totalPendingRequests > 1 ? 's' : ''} awaiting allocation
            </p>
            <p className="text-amber-700 text-sm">Go to an event's dashboard to run allocation.</p>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
        <StatCard icon="📋" label="Total Events"     value={events.length} />
        <StatCard icon="✅" label="Active"            value={activeEvents.length} />
        {isOrganizer
          ? <StatCard icon="📩" label="Pending Requests" value={totalPendingRequests} />
          : <StatCard icon="🎁" label="Approved Requests" value={myApproved.length} />
        }
      </div>

      {/* CTAs */}
      {isOrganizer && (
        <div className="bg-gradient-to-r from-brand-500 to-brand-600 rounded-2xl p-6 mb-8 flex items-center justify-between gap-4">
          <div>
            <h2 className="font-display font-bold text-white text-lg">Have food to share?</h2>
            <p className="text-brand-100 text-sm mt-0.5">Post a new event so NGOs can request it.</p>
          </div>
          <Link to="/events/new" className="btn-secondary shrink-0 text-sm">+ New Event</Link>
        </div>
      )}

      {!isOrganizer && (
        <div className="grid sm:grid-cols-2 gap-4 mb-8">
          <div className="bg-gradient-to-r from-forest-600 to-forest-700 rounded-2xl p-5 flex items-center justify-between gap-4">
            <div>
              <h2 className="font-display font-bold text-white">Find Nearby Food</h2>
              <p className="text-forest-100 text-sm mt-0.5">Use the map to find pickups near you.</p>
            </div>
            <Link to="/map" className="btn-secondary shrink-0 text-sm">Open Map</Link>
          </div>
          <div className="bg-gradient-to-r from-brand-500 to-brand-600 rounded-2xl p-5 flex items-center justify-between gap-4">
            <div>
              <h2 className="font-display font-bold text-white">My Requests</h2>
              <p className="text-brand-100 text-sm mt-0.5">
                {myPending.length > 0 ? `${myPending.length} pending allocation` : 'Track all your food requests.'}
              </p>
            </div>
            <Link to="/requests" className="btn-secondary shrink-0 text-sm">View All</Link>
          </div>
        </div>
      )}

      {/* Events section — sorted by urgency (from API) */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display font-semibold text-xl text-stone-900">
          {isOrganizer ? 'Your Events' : 'Events by Urgency'}
        </h2>
        <Link to="/events" className="text-sm text-brand-600 hover:underline font-medium">
          View all →
        </Link>
      </div>

      {loading && <div className="text-center py-12 text-stone-400 animate-pulse-soft">Loading…</div>}
      {error   && <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl px-4 py-3">{error}</div>}

      {!loading && !error && events.length === 0 && (
        <div className="card p-10 text-center text-stone-400">
          <p className="text-4xl mb-3">🍽️</p>
          <p className="font-medium">No events yet.</p>
          {isOrganizer && (
            <Link to="/events/new" className="btn-primary mt-4 inline-block text-sm">Create your first event</Link>
          )}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Events already come sorted by urgency from the API */}
        {events.slice(0, 6).map((event) => (
          <EventCard key={event.id} event={event} onDelete={handleDelete} />
        ))}
      </div>
    </PageLayout>
  );
}
