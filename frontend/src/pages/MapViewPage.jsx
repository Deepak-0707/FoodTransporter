// src/pages/MapViewPage.jsx — Phase 4: enhanced full-screen map
import React, { useEffect, useState, useCallback } from 'react';
import { eventsAPI, menuAPI } from '../services/api';
import { useSocket } from '../context/SocketContext';
import { SOCKET_EVENTS } from '../services/socket';
import PageLayout from '../components/PageLayout';
import MapView from '../components/MapView';

export default function MapViewPage() {
  const { lastEvent }               = useSocket();
  const [events, setEvents]         = useState([]);
  const [loading, setLoading]       = useState(true);
  const [userLocation, setUserLocation] = useState(null);
  const [radius, setRadius]         = useState(25);
  const [filter, setFilter]         = useState('ALL');
  const [liveAlert, setLiveAlert]   = useState('');

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      let res;
      if (userLocation) {
        res = await eventsAPI.getNearby(userLocation.lat, userLocation.lng, radius);
      } else {
        res = await eventsAPI.getAll();
      }
      const evs = res.data.events || [];
      const eventsWithMenu = await Promise.all(
        evs.map(async (ev) => {
          try {
            const mRes = await menuAPI.getByEvent(ev.id);
            return { ...ev, menuItems: mRes.data.menuItems || [] };
          } catch {
            return { ...ev, menuItems: [] };
          }
        })
      );
      setEvents(eventsWithMenu);
    } catch {
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [userLocation, radius]);

  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => {}
      );
    }
  }, []);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  useEffect(() => {
    if (!lastEvent) return;
    if (lastEvent.type === SOCKET_EVENTS.NEW_EVENT) {
      setLiveAlert('New event posted nearby!');
      setTimeout(() => setLiveAlert(''), 5000);
      fetchEvents();
    }
  }, [lastEvent, fetchEvents]);

  const filtered = filter === 'ALL' ? events : events.filter((e) => e.label === filter);
  const counts = {
    CRITICAL: events.filter((e) => e.label === 'CRITICAL').length,
    HIGH:     events.filter((e) => e.label === 'HIGH').length,
    MEDIUM:   events.filter((e) => e.label === 'MEDIUM').length,
    LOW:      events.filter((e) => e.label === 'LOW').length,
  };

  return (
    <PageLayout title="Food Map" subtitle="Find available food events near you">
      {liveAlert && (
        <div className="mb-4 bg-blue-50 border border-blue-200 text-blue-700 rounded-xl px-4 py-3 text-sm font-medium flex items-center gap-2 animate-fade-up">
          <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse inline-block" />
          {liveAlert}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex flex-wrap gap-2">
          {[
            { label: 'CRITICAL', color: '#dc2626', count: counts.CRITICAL },
            { label: 'HIGH',     color: '#ea580c', count: counts.HIGH     },
            { label: 'MEDIUM',   color: '#d97706', count: counts.MEDIUM   },
            { label: 'LOW',      color: '#16a34a', count: counts.LOW      },
          ].map(({ label, color, count }) => (
            <button
              key={label}
              onClick={() => setFilter(filter === label ? 'ALL' : label)}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border transition-all"
              style={{ borderColor: color + '60', backgroundColor: color + '15', color }}
            >
              <span className="w-2 h-2 rounded-full" style={{ background: color }} />
              {label} ({count})
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-stone-500 font-medium">Radius:</label>
          <select value={radius} onChange={(e) => setRadius(Number(e.target.value))} className="input-field text-xs py-1.5 w-28">
            {[5, 10, 25, 50, 100].map((r) => <option key={r} value={r}>{r} km</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="h-[500px] bg-stone-100 rounded-2xl flex items-center justify-center">
          <p className="text-stone-400 animate-pulse-soft">Loading map…</p>
        </div>
      ) : (
        <MapView events={filtered} userLocation={userLocation} height="520px" />
      )}

      <div className="mt-4 flex flex-wrap gap-3 text-sm text-stone-600">
        <span className="bg-white border border-stone-200 rounded-xl px-3 py-1.5">
          📍 {filtered.length} event{filtered.length !== 1 ? 's' : ''} shown
        </span>
        {userLocation
          ? <span className="bg-white border border-stone-200 rounded-xl px-3 py-1.5">🧭 Your location detected</span>
          : <span className="bg-amber-50 border border-amber-200 text-amber-700 rounded-xl px-3 py-1.5">⚠️ Location not detected — showing all events</span>
        }
      </div>

      <div className="mt-4 bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 text-xs text-stone-500">
        <strong>Tips:</strong> Click a marker to see event details and menu items.
        Red pulsing markers are <strong>CRITICAL</strong> urgency. Your location is shown as a blue dot.
      </div>
    </PageLayout>
  );
}
