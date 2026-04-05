// src/pages/EventDetails.jsx — Phase 4: full detail with menu + request inline
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { eventsAPI, menuAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { SOCKET_EVENTS } from '../services/socket';
import PageLayout from '../components/PageLayout';
import MenuList from '../components/MenuList';
import MenuForm from '../components/MenuForm';
import RequestForm from '../components/RequestForm';

const URGENCY_COLORS = {
  CRITICAL: '#dc2626', HIGH: '#ea580c', MEDIUM: '#d97706', LOW: '#16a34a', EXPIRED: '#78716c',
};

// Lightweight inline Leaflet map — no extra dependencies
function EventMiniMap({ lat, lng, label, title }) {
  const mapRef = useRef(null);
  const instanceRef = useRef(null);

  useEffect(() => {
    if (!mapRef.current || instanceRef.current) return;
    if (isNaN(lat) || isNaN(lng)) return;

    // Dynamically load Leaflet CSS if not already present
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    import('leaflet').then((L) => {
      if (instanceRef.current) return;
      const map = L.map(mapRef.current, { zoomControl: true, scrollWheelZoom: false }).setView([lat, lng], 15);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
      }).addTo(map);

      const color = URGENCY_COLORS[label] || URGENCY_COLORS.LOW;
      const icon = L.divIcon({
        html: `<div style="background:${color};width:16px;height:16px;border-radius:50%;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.4)"></div>`,
        className: '',
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      });

      L.marker([lat, lng], { icon })
        .addTo(map)
        .bindPopup(`<strong>${title}</strong><br/>${lat.toFixed(4)}, ${lng.toFixed(4)}`)
        .openPopup();

      instanceRef.current = map;
    });

    return () => {
      if (instanceRef.current) {
        instanceRef.current.remove();
        instanceRef.current = null;
      }
    };
  }, [lat, lng, label, title]);

  if (isNaN(lat) || isNaN(lng)) return null;

  return (
    <div className="mt-4 rounded-xl overflow-hidden border border-stone-200">
      <div className="flex items-center justify-between px-3 py-2 bg-stone-50 border-b border-stone-200">
        <span className="text-xs font-semibold text-stone-600">📍 Event Location</span>
        <a
          href={`https://www.google.com/maps?q=${lat},${lng}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-brand-600 hover:underline font-medium"
        >
          Open in Google Maps ↗
        </a>
      </div>
      <div ref={mapRef} style={{ height: '220px', width: '100%' }} />
    </div>
  );
}

const URGENCY_STYLES = {
  CRITICAL: { cls: 'bg-red-100 text-red-700 border-red-200',           icon: '🔴', pulse: true  },
  HIGH:     { cls: 'bg-orange-100 text-orange-700 border-orange-200',   icon: '🟠', pulse: false },
  MEDIUM:   { cls: 'bg-amber-100 text-amber-700 border-amber-200',      icon: '🟡', pulse: false },
  LOW:      { cls: 'bg-green-100 text-green-700 border-green-200',      icon: '🟢', pulse: false },
  EXPIRED:  { cls: 'bg-stone-100 text-stone-500 border-stone-200',      icon: '⚫', pulse: false },
};

function formatDateTime(dt) {
  return new Date(dt).toLocaleString(undefined, {
    weekday: 'short', year: 'numeric', month: 'short',
    day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export default function EventDetails() {
  const { id }     = useParams();
  const { user }   = useAuth();
  const { lastEvent } = useSocket();
  const navigate   = useNavigate();

  const [event, setEvent]         = useState(null);
  const [menuItems, setMenuItems] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [menuLoading, setMenuLoading] = useState(false);
  const [addLoading, setAddLoading]   = useState(false);
  const [error, setError]         = useState('');
  const [toast, setToast]         = useState({ msg: '', type: '' });
  const [showRequest, setShowRequest] = useState(false);
  const [liveUpdate, setLiveUpdate]   = useState('');
  const [alreadyRequested, setAlreadyRequested] = useState(false);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast({ msg: '', type: '' }), 3500);
  };

  const fetchEvent = useCallback(async () => {
    try {
      const res = await eventsAPI.getById(id);
      setEvent(res.data.event);
    } catch {
      setError('Event not found');
    }
  }, [id]);

  const fetchMenu = useCallback(async () => {
    setMenuLoading(true);
    try {
      const res = await menuAPI.getByEvent(id);
      setMenuItems(res.data.menuItems || []);
    } catch {
      setMenuItems([]);
    } finally {
      setMenuLoading(false);
    }
  }, [id]);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([fetchEvent(), fetchMenu()]);
      // Check if this NGO already has a request for this event
      if (user?.role === 'NGO' || user?.role === 'ASHRAM') {
        try {
          const { requestsAPI } = await import('../services/api');
          const res = await requestsAPI.getMine();
          const mine = res.data.requests || [];
          setAlreadyRequested(mine.some((r) => r.event_id === id));
        } catch { /* non-fatal */ }
      }
      setLoading(false);
    };
    init();
  }, [fetchEvent, fetchMenu, id, user?.role]);

  // Real-time updates
  useEffect(() => {
    if (!lastEvent) return;
    if (
      lastEvent.type === SOCKET_EVENTS.ALLOCATION_UPDATE &&
      lastEvent.data?.event_id === id
    ) {
      setLiveUpdate('⚡ Allocation just updated for this event!');
      setTimeout(() => setLiveUpdate(''), 5000);
      fetchEvent();
    }
    if (lastEvent.type === SOCKET_EVENTS.EVENT_UPDATED && lastEvent.data?.id === id) {
      setLiveUpdate('📝 This event was just updated.');
      setTimeout(() => setLiveUpdate(''), 5000);
      fetchEvent();
    }
  }, [lastEvent, id, fetchEvent]);

  const handleAddMenuItem = async (itemData) => {
    setAddLoading(true);
    try {
      const res = await menuAPI.addItem(id, itemData);
      const saved = res.data.menuItem || res.data.menuItems?.[0];
      if (saved) {
        setMenuItems((prev) => [...prev, saved]);
      } else {
        // fallback: use local data with a temp id
        setMenuItems((prev) => [...prev, { id: `temp-${Date.now()}`, ...itemData }]);
      }
      showToast('Menu item added successfully!');
    } catch {
      setMenuItems((prev) => [...prev, { id: Date.now().toString(), ...itemData }]);
      showToast('Menu item added (local preview)!');
    } finally {
      setAddLoading(false);
    }
  };

  const handleRemoveMenuItem = async (itemId) => {
    setMenuItems((prev) => prev.filter((i) => i.id !== itemId));
    try { await menuAPI.removeItem(id, itemId); } catch { /* optimistic */ }
  };

  const handleDelete = async () => {
    if (!window.confirm('Delete this event? This cannot be undone.')) return;
    try {
      await eventsAPI.remove(id);
      navigate('/dashboard');
    } catch {
      showToast('Failed to delete event.', 'error');
    }
  };

  if (loading) {
    return (
      <PageLayout>
        <div className="max-w-2xl mx-auto space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-stone-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      </PageLayout>
    );
  }

  if (error || !event) {
    return (
      <PageLayout>
        <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl px-4 py-3">
          {error || 'Event not found'}
        </div>
        <Link to="/events" className="text-sm text-stone-500 hover:underline mt-4 inline-block">
          ← Back to Events
        </Link>
      </PageLayout>
    );
  }

  const isOwner   = user?.id === event.organizer_id;
  const isNGO     = user?.role === 'NGO';
  const isExpired = event.label === 'EXPIRED' || new Date(event.expiry_time) < new Date();
  const urg       = URGENCY_STYLES[event.label] || URGENCY_STYLES.LOW;
  const pct       = Math.max(0, Math.min(100, Math.round(
    ((event.remaining_quantity || 0) / (event.quantity || 1)) * 100
  )));

  return (
    <PageLayout title={event.title} subtitle={`By ${event.organizer_name}`}>
      <div className="max-w-2xl mx-auto">
        <Link to="/events" className="text-sm text-stone-500 hover:text-stone-700 flex items-center gap-1 mb-6">
          ← Back to Events
        </Link>

        {/* Live update banner */}
        {liveUpdate && (
          <div className="mb-4 bg-blue-50 border border-blue-200 text-blue-700 rounded-xl px-4 py-3 text-sm font-medium flex items-center gap-2 animate-fade-up">
            <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse inline-block" />
            {liveUpdate}
          </div>
        )}

        {/* Toast */}
        {toast.msg && (
          <div className={`mb-4 rounded-xl px-4 py-3 text-sm font-medium animate-fade-up ${
            toast.type === 'error'
              ? 'bg-red-50 border border-red-200 text-red-700'
              : 'bg-green-50 border border-green-200 text-green-700'
          }`}>
            {toast.msg}
          </div>
        )}

        {/* CRITICAL banner */}
        {event.label === 'CRITICAL' && (
          <div className="mb-5 flex items-center gap-3 bg-red-600 text-white rounded-2xl px-5 py-3 shadow-md animate-pulse">
            <span className="text-2xl">🚨</span>
            <div>
              <p className="font-bold text-sm">URGENT — Expires in under 1 hour!</p>
              <p className="text-red-100 text-xs">Immediate action needed to avoid food waste.</p>
            </div>
          </div>
        )}

        {/* ── Main Card ── */}
        <div className="card p-6 mb-4">
          <div className="flex items-start justify-between gap-3 mb-5">
            <h2 className="font-display font-bold text-2xl text-stone-900">{event.title}</h2>
            <span className={`shrink-0 text-xs font-bold px-3 py-1.5 rounded-full border flex items-center gap-1.5 ${urg.cls} ${urg.pulse ? 'animate-pulse' : ''}`}>
              {urg.icon} {event.label}
            </span>
          </div>

          {event.description && (
            <p className="text-stone-600 mb-5 leading-relaxed">{event.description}</p>
          )}

          <div className="grid grid-cols-2 gap-3 mb-5">
            <div className="bg-brand-50 border border-brand-100 rounded-xl p-4">
              <p className="text-xs text-brand-600 font-semibold uppercase tracking-wide mb-1">Total</p>
              <p className="text-stone-900 font-bold text-xl">
                {event.quantity} <span className="text-sm font-normal text-stone-500">{event.quantity_unit}</span>
              </p>
            </div>
            <div className={`border rounded-xl p-4 ${event.remaining_quantity > 0 ? 'bg-forest-50 border-forest-100' : 'bg-stone-50 border-stone-200'}`}>
              <p className={`text-xs font-semibold uppercase tracking-wide mb-1 ${event.remaining_quantity > 0 ? 'text-forest-600' : 'text-stone-400'}`}>Remaining</p>
              <p className="text-stone-900 font-bold text-xl">
                {event.remaining_quantity} <span className="text-sm font-normal text-stone-500">{event.quantity_unit}</span>
              </p>
            </div>
          </div>

          {/* Availability bar */}
          <div className="mb-5">
            <div className="flex justify-between text-xs text-stone-500 mb-1.5">
              <span>Availability</span>
              <span>{pct}% remaining</span>
            </div>
            <div className="w-full bg-stone-100 rounded-full h-2.5">
              <div
                className={`h-2.5 rounded-full transition-all duration-500 ${event.label === 'CRITICAL' ? 'bg-red-500' : 'bg-forest-500'}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          <div className="space-y-2 text-sm text-stone-600 border-t border-stone-100 pt-4">
            <p>⏰ <strong>Expires:</strong> {formatDateTime(event.expiry_time)}</p>
            <p>📍 <strong>Location:</strong> {parseFloat(event.latitude).toFixed(4)}, {parseFloat(event.longitude).toFixed(4)}</p>
            <p>👤 <strong>Organizer:</strong> {event.organizer_name} ({event.organizer_email})</p>
            {event.request_count != null && (
              <p>📋 <strong>Total Requests:</strong> {event.request_count}</p>
            )}
          </div>

          {/* ── Inline Map ── */}
          <EventMiniMap
            lat={parseFloat(event.latitude)}
            lng={parseFloat(event.longitude)}
            label={event.label}
            title={event.title}
          />
        </div>

        {/* ── Menu Items Card ── */}
        <div className="card p-6 mb-4">
          <h3 className="font-display font-semibold text-stone-900 mb-4 flex items-center gap-2">
            🍽️ Menu Items
            {menuItems.length > 0 && (
              <span className="text-xs bg-brand-100 text-brand-700 px-2 py-0.5 rounded-full">
                {menuItems.length} items
              </span>
            )}
          </h3>

          <MenuList
            items={menuItems}
            loading={menuLoading}
            onRemove={isOwner ? handleRemoveMenuItem : undefined}
            showRemove={isOwner}
          />

          {isOwner && (
            <div className="mt-5 pt-5 border-t border-stone-100">
              <h4 className="text-sm font-semibold text-stone-700 mb-3">Add New Menu Item</h4>
              <MenuForm onAdd={handleAddMenuItem} loading={addLoading} />
            </div>
          )}
        </div>

        {/* ── Request Food Card (NGO only) ── */}
        {isNGO && !isExpired && event.remaining_quantity > 0 && (
          <div className="card p-6 mb-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-semibold text-stone-900">📋 Request Food</h3>
              {!alreadyRequested && (
                <button
                  onClick={() => setShowRequest((s) => !s)}
                  className="text-xs text-brand-600 hover:underline font-medium"
                >
                  {showRequest ? 'Hide' : 'Show form'}
                </button>
              )}
            </div>

            {alreadyRequested ? (
              <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                <span className="text-xl">✅</span>
                <div>
                  <p className="text-sm font-semibold text-green-800">Request already submitted</p>
                  <p className="text-xs text-green-600 mt-0.5">You have already requested food from this event. Check <a href="/requests" className="underline font-medium">My Requests</a> for status.</p>
                </div>
              </div>
            ) : showRequest ? (
              <div className="animate-fade-up">
                <RequestForm
                  event={event}
                  onSuccess={() => {
                    setShowRequest(false);
                    setAlreadyRequested(true);
                    fetchEvent();
                  }}
                />
              </div>
            ) : (
              <button
                onClick={() => setShowRequest(true)}
                className={`btn-primary w-full ${event.label === 'CRITICAL' ? 'bg-red-600 hover:bg-red-700' : ''}`}
              >
                {event.label === 'CRITICAL' ? '🚨 Request Urgently' : '📋 Request Food'}
              </button>
            )}
          </div>
        )}

        {/* ── Organizer Actions ── */}
        {isOwner && (
          <div className="flex flex-wrap gap-3">
            <Link to={`/events/${event.id}/requests`} className="btn-primary text-sm py-2.5 px-5">
              ⚡ Allocation Dashboard
            </Link>
            <Link to={`/events/${event.id}/edit`} className="btn-secondary text-sm py-2.5 px-5">
              ✏️ Edit Event
            </Link>
            <button onClick={handleDelete} className="btn-danger text-sm py-2.5 px-5">
              🗑️ Delete
            </button>
          </div>
        )}

        {isNGO && isExpired && (
          <div className="text-sm text-stone-500 bg-stone-50 border border-stone-200 rounded-xl px-4 py-3">
            This event has expired and is no longer accepting requests.
          </div>
        )}
      </div>
    </PageLayout>
  );
}
