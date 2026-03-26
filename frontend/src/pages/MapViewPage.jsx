// src/pages/MapViewPage.jsx
// Leaflet map showing all events as markers
import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { Link } from 'react-router-dom';
import L from 'leaflet';
import { eventsAPI } from '../services/api';
import PageLayout from '../components/PageLayout';

// Fix Leaflet default marker icon missing in Vite build
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

/** Custom icon for events expiring soon (red) vs normal (orange) */
function getMarkerIcon(expiryTime) {
  const diffMin = (new Date(expiryTime) - new Date()) / 60000;
  const color   = diffMin < 0 ? '#9ca3af' : diffMin < 60 ? '#ef4444' : '#f79522';

  // SVG marker icon
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 44" width="32" height="44">
      <path d="M16 0C7.163 0 0 7.163 0 16c0 10 16 28 16 28s16-18 16-28C32 7.163 24.837 0 16 0z"
            fill="${color}" stroke="white" stroke-width="2"/>
      <circle cx="16" cy="16" r="7" fill="white" opacity="0.9"/>
      <text x="16" y="20" text-anchor="middle" font-size="10" fill="${color}" font-family="sans-serif">🍱</text>
    </svg>
  `;

  return L.divIcon({
    html: svg,
    className: '',
    iconSize:   [32, 44],
    iconAnchor: [16, 44],
    popupAnchor:[0, -44],
  });
}

function formatExpiry(dt) {
  return new Date(dt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export default function MapViewPage() {
  const [events, setEvents]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  useEffect(() => {
    eventsAPI.getAll()
      .then((res) => setEvents(res.data.events))
      .catch(() => setError('Failed to load events'))
      .finally(() => setLoading(false));
  }, []);

  // Default center: India (central) — adjust as needed
  const defaultCenter = [20.5937, 78.9629];
  const defaultZoom   = 5;

  // If events exist, compute a centre from them
  const mapCenter = events.length > 0
    ? [
        events.reduce((sum, e) => sum + parseFloat(e.latitude),  0) / events.length,
        events.reduce((sum, e) => sum + parseFloat(e.longitude), 0) / events.length,
      ]
    : defaultCenter;

  return (
    <PageLayout title="Map View" subtitle="All food surplus events plotted on the map.">
      {loading && (
        <div className="text-center py-16 text-stone-400 animate-pulse-soft">Loading map…</div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl px-4 py-3 mb-4">{error}</div>
      )}

      {/* Legend */}
      {!loading && (
        <div className="flex flex-wrap gap-4 mb-4 text-sm">
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-brand-500 inline-block" /> Active</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-red-500 inline-block" /> Expiring soon (&lt;1h)</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-stone-400 inline-block" /> Expired</span>
          <span className="ml-auto text-stone-400">{events.length} event{events.length !== 1 ? 's' : ''} on map</span>
        </div>
      )}

      {!loading && (
        <div className="rounded-2xl overflow-hidden border border-stone-200 shadow-sm" style={{ height: '60vh' }}>
          <MapContainer
            center={mapCenter}
            zoom={events.length > 0 ? 10 : defaultZoom}
            style={{ height: '100%', width: '100%' }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {events.map((event) => (
              <Marker
                key={event.id}
                position={[parseFloat(event.latitude), parseFloat(event.longitude)]}
                icon={getMarkerIcon(event.expiry_time)}
              >
                <Popup maxWidth={280}>
                  <div className="p-1">
                    <h3 className="font-semibold text-stone-900 text-sm mb-2">{event.title}</h3>
                    <div className="flex flex-col gap-1 text-xs text-stone-600">
                      <span>🍽️ <strong>Quantity:</strong> {event.quantity}</span>
                      <span>⏰ <strong>Expires:</strong> {formatExpiry(event.expiry_time)}</span>
                      {event.organizer_name && (
                        <span>👤 <strong>By:</strong> {event.organizer_name}</span>
                      )}
                    </div>
                    <Link
                      to={`/events/${event.id}`}
                      className="inline-block mt-3 text-xs font-semibold text-brand-600 hover:underline"
                    >
                      View Details →
                    </Link>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
      )}

      {!loading && events.length === 0 && !error && (
        <div className="card p-10 text-center text-stone-400 mt-4">
          <p className="text-4xl mb-3">🗺️</p>
          <p className="font-medium">No events to display on the map.</p>
        </div>
      )}
    </PageLayout>
  );
}
