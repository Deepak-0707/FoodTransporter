// src/pages/NGODashboard.jsx — Phase 4
import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { eventsAPI, menuAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { useNotifications } from '../context/NotificationContext';
import { SOCKET_EVENTS, getSocket } from '../services/socket';
import PageLayout from '../components/PageLayout';
import MenuList from '../components/MenuList';
import RequestForm from '../components/RequestForm';
import MapView from '../components/MapView';

const URGENCY_STYLES = {
  CRITICAL: { cls: 'bg-red-100 text-red-700 border-red-200',         icon: '🔴', bar: 'bg-red-500'    },
  HIGH:     { cls: 'bg-orange-100 text-orange-700 border-orange-200', icon: '🟠', bar: 'bg-orange-500' },
  MEDIUM:   { cls: 'bg-amber-100 text-amber-700 border-amber-200',    icon: '🟡', bar: 'bg-amber-400'  },
  LOW:      { cls: 'bg-green-100 text-green-700 border-green-200',    icon: '🟢', bar: 'bg-green-500'  },
  EXPIRED:  { cls: 'bg-stone-100 text-stone-500 border-stone-200',    icon: '⚫', bar: 'bg-stone-300'  },
};

function EventCard({ event, onRequest }) {
  const [menuItems, setMenuItems]   = useState([]);
  const [menuLoading, setMenuLoading] = useState(false);
  const [showMenu, setShowMenu]      = useState(false);
  const [showRequest, setShowRequest] = useState(false);
  const urg = URGENCY_STYLES[event.label] || URGENCY_STYLES.LOW;
  const isExpired = event.label === 'EXPIRED' || new Date(event.expiry_time) < new Date();
  const pct = Math.max(0, Math.min(100, Math.round(((event.remaining_quantity || 0) / (event.quantity || 1)) * 100)));

  const toggleMenu = async () => {
    if (!showMenu && menuItems.length === 0) {
      setMenuLoading(true);
      try {
        const res = await menuAPI.getByEvent(event.id);
        setMenuItems(res.data.menuItems || []);
      } catch { setMenuItems([]); }
      finally { setMenuLoading(false); }
    }
    setShowMenu((s) => !s);
  };

  return (
    <div className={`card overflow-hidden ${event.label === 'CRITICAL' ? 'ring-2 ring-red-400' : ''}`}>
      {/* Urgency bar at top */}
      <div className={`h-1.5 w-full ${urg.bar}`} />

      <div className="p-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-display font-bold text-stone-900 truncate">{event.title}</h3>
            <p className="text-xs text-stone-500 mt-0.5">By {event.organizer_name}</p>
          </div>
          <span className={`shrink-0 text-xs font-bold px-2 py-1 rounded-full border flex items-center gap-1 ${urg.cls} ${event.label === 'CRITICAL' ? 'animate-pulse' : ''}`}>
            {urg.icon} {event.label}
          </span>
        </div>

        {/* Quantities */}
        <div className="flex items-center gap-3 mb-3">
          <div className="flex-1">
            <div className="flex justify-between text-xs text-stone-500 mb-1">
              <span>{event.remaining_quantity} {event.quantity_unit} left</span>
              <span>{pct}%</span>
            </div>
            <div className="w-full bg-stone-100 rounded-full h-1.5">
              <div className={`h-1.5 rounded-full ${urg.bar}`} style={{ width: `${pct}%` }} />
            </div>
          </div>
          {event.hoursLeft != null && (
            <div className="text-right shrink-0">
              <p className="text-xs text-stone-400">expires</p>
              <p className={`text-sm font-bold ${event.hoursLeft < 2 ? 'text-red-600' : 'text-stone-700'}`}>
                {event.hoursLeft < 1 ? '<1h' : `${Math.round(event.hoursLeft)}h`}
              </p>
            </div>
          )}
        </div>

        {/* Actions row */}
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={toggleMenu}
            className="text-xs btn-secondary py-1.5 px-3 flex items-center gap-1"
          >
            🍽️ {showMenu ? 'Hide' : 'View'} Menu
          </button>
          {!isExpired && event.remaining_quantity > 0 && (
            <button
              onClick={() => setShowRequest((s) => !s)}
              className={`text-xs py-1.5 px-3 rounded-xl font-semibold transition-all ${
                event.label === 'CRITICAL'
                  ? 'bg-red-600 hover:bg-red-700 text-white'
                  : 'btn-primary'
              }`}
            >
              {showRequest ? '✕ Cancel' : (event.label === 'CRITICAL' ? '🚨 Request' : '📋 Request')}
            </button>
          )}
          <Link
            to={`/events/${event.id}`}
            className="text-xs text-brand-600 hover:underline font-medium self-center ml-auto"
          >
            Details →
          </Link>
        </div>

        {/* Menu panel */}
        {showMenu && (
          <div className="mt-4 pt-4 border-t border-stone-100 animate-fade-up">
            <MenuList items={menuItems} loading={menuLoading} />
          </div>
        )}

        {/* Request panel */}
        {showRequest && !isExpired && (
          <div className="mt-4 pt-4 border-t border-stone-100 animate-fade-up">
            <h4 className="font-semibold text-stone-800 text-sm mb-3">Submit Food Request</h4>
            <RequestForm
              event={event}
              onSuccess={() => {
                setShowRequest(false);
                if (onRequest) onRequest(event.id);
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default function NGODashboard() {
  const { user }                  = useAuth();
  const { lastEvent }             = useSocket();
  const { addNotification }       = useNotifications();
  const [events, setEvents]       = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [userLocation, setUserLocation] = useState(null);
  const [viewMode, setViewMode]   = useState('list'); // 'list' | 'map'
  const [liveAlert, setLiveAlert] = useState('');
  const [filter, setFilter]       = useState('ALL');

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      if (userLocation) {
        const res = await eventsAPI.getNearby(userLocation.lat, userLocation.lng, 25);
        setEvents(res.data.events || []);
      } else {
        const res = await eventsAPI.getAll();
        setEvents(res.data.events || []);
      }
    } catch {
      setError('Failed to load events');
    } finally {
      setLoading(false);
    }
  }, [userLocation]);

  // Get user location
  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => {} // silently fail
      );
    }
  }, []);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  // Real-time: new event arrives
  useEffect(() => {
    if (!lastEvent) return;
    if (lastEvent.type === SOCKET_EVENTS.NEW_EVENT) {
      const ev = lastEvent.data;
      setLiveAlert(`🆕 New event: "${ev?.title || 'Untitled'}" just posted!`);
      setTimeout(() => setLiveAlert(''), 6000);
      addNotification({ message: `New food event available: "${ev?.title}"`, type: 'INFO' });
      fetchEvents();
    }
    if (lastEvent.type === SOCKET_EVENTS.ALLOCATION_UPDATE) {
      addNotification({ message: 'Your food request allocation has been updated.', type: 'ALLOCATION' });
      fetchEvents();
    }
  }, [lastEvent, fetchEvents, addNotification]);

  const filteredEvents = filter === 'ALL'
    ? events
    : events.filter((e) => e.label === filter);

  const urgentCount = events.filter((e) => e.label === 'CRITICAL' || e.label === 'HIGH').length;

  return (
    <PageLayout
      title="Find Food Near You"
      subtitle={`Hello ${user?.name}! Browse and request available food.`}
    >
      {/* Urgent alert */}
      {urgentCount > 0 && (
        <div className="mb-4 flex items-center gap-3 bg-red-600 text-white rounded-2xl px-5 py-4 shadow-lg">
          <span className="text-3xl animate-bounce">🚨</span>
          <div className="flex-1">
            <p className="font-bold">{urgentCount} urgent event{urgentCount > 1 ? 's' : ''} need immediate action!</p>
            <p className="text-red-100 text-sm">Act before these items expire.</p>
          </div>
        </div>
      )}

      {/* Live socket alert */}
      {liveAlert && (
        <div className="mb-4 bg-blue-50 border border-blue-200 text-blue-700 rounded-xl px-4 py-3 text-sm font-medium flex items-center gap-2 animate-fade-up">
          <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse inline-block" />
          {liveAlert}
        </div>
      )}

      {/* Controls: filter + view toggle */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        {/* Filter pills */}
        <div className="flex gap-2 flex-wrap">
          {['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-all ${
                filter === f
                  ? 'bg-brand-500 text-white border-brand-500'
                  : 'bg-white text-stone-600 border-stone-200 hover:border-brand-300'
              }`}
            >
              {f === 'CRITICAL' ? '🔴 ' : f === 'HIGH' ? '🟠 ' : f === 'MEDIUM' ? '🟡 ' : f === 'LOW' ? '🟢 ' : ''}
              {f}
            </button>
          ))}
        </div>

        {/* View toggle */}
        <div className="flex gap-1 bg-stone-100 rounded-xl p-1">
          <button
            onClick={() => setViewMode('list')}
            className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white shadow-sm text-stone-900' : 'text-stone-500'}`}
          >
            ☰ List
          </button>
          <button
            onClick={() => setViewMode('map')}
            className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-all ${viewMode === 'map' ? 'bg-white shadow-sm text-stone-900' : 'text-stone-500'}`}
          >
            🗺️ Map
          </button>
        </div>
      </div>

      {loading && <div className="text-center py-12 text-stone-400 animate-pulse-soft">Loading nearby events…</div>}
      {error   && <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl px-4 py-3">{error}</div>}

      {/* Map view */}
      {viewMode === 'map' && (
        <div className="mb-6">
          <MapView events={filteredEvents} userLocation={userLocation} height="420px" />
          {userLocation && (
            <p className="text-xs text-stone-400 mt-2 text-center">📍 Showing events near your location</p>
          )}
        </div>
      )}

      {/* List view */}
      {viewMode === 'list' && (
        <>
          {!loading && filteredEvents.length === 0 && (
            <div className="card p-10 text-center text-stone-400">
              <p className="text-4xl mb-3">🔍</p>
              <p className="font-medium">No events found.</p>
              <p className="text-sm mt-1">Try a different filter or check back soon.</p>
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredEvents.map((event) => (
              <EventCard key={event.id} event={event} onRequest={fetchEvents} />
            ))}
          </div>
        </>
      )}
    </PageLayout>
  );
}
