import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { eventsAPI, bookingsAPI } from '../services/api';
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
  const { user } = useAuth();
  const isOrganizer = user?.role === 'ORGANIZER';

  const [events, setEvents] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const evRes = await eventsAPI.getAll(isOrganizer);

      console.log("EVENT RESPONSE:", evRes?.data);

      // Safe extraction for events
      const eventsData =
        evRes?.data?.events ||
        evRes?.data ||
        [];

      setEvents(Array.isArray(eventsData) ? eventsData : []);

      if (!isOrganizer) {
        const bkRes = await bookingsAPI.getMine();

        console.log("BOOKING RESPONSE:", bkRes?.data);

        // Safe extraction for bookings
        const bookingsData =
          bkRes?.data?.bookings ||
          bkRes?.data ||
          [];

        setBookings(Array.isArray(bookingsData) ? bookingsData : []);
      }
    } catch (err) {
      console.error(err);
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this event? This cannot be undone.')) return;
    try {
      await eventsAPI.remove(id);
      setEvents((prev) => prev.filter((e) => e.id !== id));
    } catch {
      alert('Failed to delete event');
    }
  };

  if (loading) return <PageLayout><div>Loading...</div></PageLayout>;
  if (error) return <PageLayout><div>{error}</div></PageLayout>;

  const now = new Date();

  // Hard safety layer
  const safeEvents = Array.isArray(events) ? events : [];
  const safeBookings = Array.isArray(bookings) ? bookings : [];

  const activeEvents = safeEvents.filter(
    (e) => new Date(e.expiry_time) > now
  );

  const expiredEvents = safeEvents.filter(
    (e) => new Date(e.expiry_time) <= now
  );

  const myBookings = safeBookings.filter(
    (b) =>
      b.status === 'confirmed' &&
      new Date(b.expiry_time) > now
  );

  return (
    <PageLayout
      title={`Welcome back, ${user?.name} 👋`}
      subtitle={
        isOrganizer
          ? 'Manage your food surplus events below.'
          : 'Find available food events near you.'
      }
    >
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
        <StatCard icon="📋" label="Total Events" value={safeEvents.length} />
        <StatCard icon="✅" label="Active" value={activeEvents.length} />
        {isOrganizer ? (
          <StatCard icon="⏳" label="Expired" value={expiredEvents.length} />
        ) : (
          <StatCard icon="🛒" label="My Bookings" value={myBookings.length} />
        )}
      </div>

      {/* Organizer CTA */}
      {isOrganizer && (
        <div className="bg-gradient-to-r from-brand-500 to-brand-600 rounded-2xl p-6 mb-8 flex items-center justify-between gap-4">
          <div>
            <h2 className="font-display font-bold text-white text-lg">
              Have food to share?
            </h2>
            <p className="text-brand-100 text-sm mt-0.5">
              Post a new event so NGOs can collect it.
            </p>
          </div>
          <Link to="/events/new" className="btn-secondary shrink-0 text-sm">
            + New Event
          </Link>
        </div>
      )}

      {/* NGO CTAs */}
      {!isOrganizer && (
        <div className="grid sm:grid-cols-2 gap-4 mb-8">
          <div className="bg-gradient-to-r from-forest-600 to-forest-700 rounded-2xl p-5 flex items-center justify-between gap-4">
            <div>
              <h2 className="font-display font-bold text-white">
                Find Nearby Food
              </h2>
              <p className="text-forest-100 text-sm mt-0.5">
                Use the map to find pickups near you.
              </p>
            </div>
            <Link to="/map" className="btn-secondary shrink-0 text-sm">
              Open Map
            </Link>
          </div>

          <div className="bg-gradient-to-r from-brand-500 to-brand-600 rounded-2xl p-5 flex items-center justify-between gap-4">
            <div>
              <h2 className="font-display font-bold text-white">
                My Bookings
              </h2>
              <p className="text-brand-100 text-sm mt-0.5">
                Track all your food reservations.
              </p>
            </div>
            <Link to="/bookings" className="btn-secondary shrink-0 text-sm">
              View All
            </Link>
          </div>
        </div>
      )}

      {/* Events section */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display font-semibold text-xl text-stone-900">
          {isOrganizer ? 'Your Events' : 'Available Events'}
        </h2>
        <Link
          to="/events"
          className="text-sm text-brand-600 hover:underline font-medium"
        >
          View all →
        </Link>
      </div>

      {!loading && !error && safeEvents.length === 0 && (
        <div className="card p-10 text-center text-stone-400">
          <p className="text-4xl mb-3">🍽️</p>
          <p className="font-medium">No events yet.</p>
          {isOrganizer && (
            <Link
              to="/events/new"
              className="btn-primary mt-4 inline-block text-sm"
            >
              Create your first event
            </Link>
          )}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {safeEvents.slice(0, 3).map((event) => (
          <EventCard
            key={event.id}
            event={event}
            onDelete={handleDelete}
          />
        ))}
      </div>
    </PageLayout>
  );
}