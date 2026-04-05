// src/pages/NGODashboard.jsx — FIXED (No infinite loop)
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { eventsAPI, menuAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { useNotifications } from '../context/NotificationContext';
import { SOCKET_EVENTS } from '../services/socket';
import PageLayout from '../components/PageLayout';
import MenuList from '../components/MenuList';
import RequestForm from '../components/RequestForm';
import MapView from '../components/MapView';

const URGENCY_STYLES = {
  CRITICAL: { cls: 'bg-red-100 text-red-700 border-red-200', icon: '🔴', bar: 'bg-red-500' },
  HIGH: { cls: 'bg-orange-100 text-orange-700 border-orange-200', icon: '🟠', bar: 'bg-orange-500' },
  MEDIUM: { cls: 'bg-amber-100 text-amber-700 border-amber-200', icon: '🟡', bar: 'bg-amber-400' },
  LOW: { cls: 'bg-green-100 text-green-700 border-green-200', icon: '🟢', bar: 'bg-green-500' },
  EXPIRED: { cls: 'bg-stone-100 text-stone-500 border-stone-200', icon: '⚫', bar: 'bg-stone-300' },
};

function EventCard({ event, onRequest }) {
  const [menuItems, setMenuItems] = useState([]);
  const [menuLoading, setMenuLoading] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showRequest, setShowRequest] = useState(false);

  const urg = URGENCY_STYLES[event.label] || URGENCY_STYLES.LOW;
  const isExpired =
    event.label === 'EXPIRED' || new Date(event.expiry_time) < new Date();

  const pct = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        ((event.remaining_quantity || 0) / (event.quantity || 1)) * 100
      )
    )
  );

  const toggleMenu = async () => {
    if (!showMenu && menuItems.length === 0) {
      setMenuLoading(true);
      try {
        const res = await menuAPI.getByEvent(event.id);
        setMenuItems(res.data.menuItems || []);
      } catch {
        setMenuItems([]);
      } finally {
        setMenuLoading(false);
      }
    }
    setShowMenu((s) => !s);
  };

  return (
    <div className={`card overflow-hidden ${event.label === 'CRITICAL' ? 'ring-2 ring-red-400' : ''}`}>
      <div className={`h-1.5 w-full ${urg.bar}`} />

      <div className="p-5">
        <h3 className="font-bold">{event.title}</h3>
        <p className="text-xs text-gray-500">By {event.organizer_name}</p>

        <div className="my-2 text-sm">
          {event.remaining_quantity} {event.quantity_unit} left ({pct}%)
        </div>

        <div className="flex gap-2 flex-wrap">
          <button onClick={toggleMenu} className="btn-secondary text-xs">
            {showMenu ? 'Hide' : 'View'} Menu
          </button>

          {!isExpired && event.remaining_quantity > 0 && (
            <button
              onClick={() => setShowRequest((s) => !s)}
              className="btn-primary text-xs"
            >
              {showRequest ? 'Cancel' : 'Request'}
            </button>
          )}

          <Link to={`/events/${event.id}`} className="text-blue-500 text-xs">
            Details →
          </Link>
        </div>

        {showMenu && <MenuList items={menuItems} loading={menuLoading} />}

        {showRequest && (
          <RequestForm
            event={event}
            onSuccess={() => {
              setShowRequest(false);
              onRequest();
            }}
          />
        )}
      </div>
    </div>
  );
}

export default function NGODashboard() {
  const { user } = useAuth();
  const { lastEvent } = useSocket();
  const { addNotification } = useNotifications();

  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState(null);
  const [viewMode, setViewMode] = useState('list');
  const [filter, setFilter] = useState('ALL');
  const [liveAlert, setLiveAlert] = useState('');

  // ✅ Get location once
  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition((pos) => {
        setUserLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
      });
    }
  }, []);

  // ✅ Fetch events safely (NO LOOP)
  useEffect(() => {
    const fetchEvents = async () => {
      setLoading(true);
      try {
        let res;
        if (userLocation) {
          res = await eventsAPI.getNearby(
            userLocation.lat,
            userLocation.lng,
            25
          );
        } else {
          res = await eventsAPI.getAll();
        }
        setEvents(res.data.events || []);
      } catch {
        console.error('Failed to load events');
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, [userLocation]);

  // ✅ Socket updates (NO LOOP)
  useEffect(() => {
    if (!lastEvent) return;

    if (lastEvent.type === SOCKET_EVENTS.NEW_EVENT) {
      // data is { event: { title, ... } } — not flat
      const ev = lastEvent.data?.event ?? lastEvent.data;
      const title = ev?.title || 'Untitled';

      setLiveAlert(`New event: "${title}" just posted!`);
      setTimeout(() => setLiveAlert(''), 4000);

      addNotification({
        message: `New food event available: "${title}"`,
        type: 'INFO',
      });
    }

    if (lastEvent.type === SOCKET_EVENTS.ALLOCATION_UPDATE) {
      addNotification({
        message: 'Allocation updated for an event near you.',
        type: 'ALLOCATION',
      });
    }

    // trigger refresh
    setUserLocation((loc) => (loc ? { ...loc } : loc));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastEvent]); // ✅ addNotification intentionally omitted — it has no stable ref

  const filteredEvents =
    filter === 'ALL'
      ? events
      : events.filter((e) => e.label === filter);

  return (
    <PageLayout
      title="Find Food"
      subtitle={`Hello ${user?.name}`}
    >
      {liveAlert && (
        <div className="bg-blue-100 p-2 mb-3 rounded">{liveAlert}</div>
      )}

      <div className="flex gap-2 mb-4">
        {['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className="text-xs border px-2 py-1"
          >
            {f}
          </button>
        ))}
      </div>

      <div className="flex gap-2 mb-4">
        <button onClick={() => setViewMode('list')}>List</button>
        <button onClick={() => setViewMode('map')}>Map</button>
      </div>

      {loading && <p>Loading...</p>}

      {viewMode === 'map' && (
        <MapView events={filteredEvents} userLocation={userLocation} />
      )}

      {viewMode === 'list' && (
        <div className="grid gap-3">
          {filteredEvents.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              onRequest={() => {
                // refresh
                setUserLocation((loc) => (loc ? { ...loc } : loc));
              }}
            />
          ))}
        </div>
      )}
    </PageLayout>
  );
}