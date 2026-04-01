// src/pages/MapViewPage.jsx — Phase 2
// Enhanced map: user location, nearby highlighting, booking from popup
import React, { useEffect, useState, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import { Link } from 'react-router-dom';
import L from 'leaflet';
import { eventsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import PageLayout from '../components/PageLayout';
import BookingForm from '../components/BookingForm';

// Fix Leaflet default icon in Vite
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

/** Re-center map to new center imperatively */
function MapRecenter({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (center) map.setView(center, zoom || map.getZoom());
  }, [center, zoom, map]);
  return null;
}

/** Build SVG marker icon based on status + whether it's nearby */
function getMarkerIcon(expiryTime, isNearby = false) {
  const diffMin = (new Date(expiryTime) - new Date()) / 60000;
  let color;
  if (diffMin < 0)   color = '#9ca3af';       // grey — expired
  else if (diffMin < 60) color = '#ef4444';   // red — expiring soon
  else if (isNearby) color = '#16a34a';        // green — nearby
  else               color = '#f79522';        // orange — normal

  const size = isNearby ? 36 : 30;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 44" width="${size}" height="${Math.round(size*1.375)}">
      <path d="M16 0C7.163 0 0 7.163 0 16c0 10 16 28 16 28s16-18 16-28C32 7.163 24.837 0 16 0z"
            fill="${color}" stroke="white" stroke-width="2"/>
      <circle cx="16" cy="16" r="7" fill="white" opacity="0.9"/>
      <text x="16" y="20" text-anchor="middle" font-size="10" fill="${color}" font-family="sans-serif">🍱</text>
    </svg>`;

  return L.divIcon({
    html: svg,
    className: '',
    iconSize:    [size, Math.round(size * 1.375)],
    iconAnchor:  [size / 2, Math.round(size * 1.375)],
    popupAnchor: [0, -Math.round(size * 1.375)],
  });
}

/** Blue pulsing marker for user's current location */
const userLocationIcon = L.divIcon({
  html: `
    <div style="position:relative;width:20px;height:20px;">
      <div style="position:absolute;inset:0;background:#3b82f6;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(59,130,246,0.5);z-index:2;"></div>
      <div style="position:absolute;inset:-6px;background:rgba(59,130,246,0.2);border-radius:50%;animation:pulse 2s infinite;"></div>
    </div>`,
  className: '',
  iconSize:    [20, 20],
  iconAnchor:  [10, 10],
  popupAnchor: [0, -15],
});

function formatExpiry(dt) {
  return new Date(dt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

const DEFAULT_CENTER = [20.5937, 78.9629];
const DEFAULT_ZOOM   = 5;
const DEFAULT_RADIUS = 10; // km

export default function MapViewPage() {
  const { user }  = useAuth();
  const isNGO     = user?.role === 'NGO';

  const [events, setEvents]         = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [userLocation, setUserLocation] = useState(null);
  const [locationError, setLocationError] = useState('');
  const [gettingLocation, setGettingLocation] = useState(false);
  const [radius, setRadius]         = useState(DEFAULT_RADIUS);
  const [filterNearby, setFilterNearby] = useState(false);
  const [nearbyIds, setNearbyIds]   = useState(new Set());
  const [mapCenter, setMapCenter]   = useState(DEFAULT_CENTER);
  const [mapZoom, setMapZoom]       = useState(DEFAULT_ZOOM);

  // Load all events on mount
  useEffect(() => {
    eventsAPI.getAll()
      .then((res) => {
        setEvents(res.data.events);
        if (res.data.events.length > 0) {
          const lats = res.data.events.map((e) => parseFloat(e.latitude));
          const lngs = res.data.events.map((e) => parseFloat(e.longitude));
          setMapCenter([
            lats.reduce((a, b) => a + b, 0) / lats.length,
            lngs.reduce((a, b) => a + b, 0) / lngs.length,
          ]);
          setMapZoom(10);
        }
      })
      .catch(() => setError('Failed to load events'))
      .finally(() => setLoading(false));
  }, []);

  /** Request browser geolocation */
  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      return setLocationError('Geolocation is not supported by your browser.');
    }
    setGettingLocation(true);
    setLocationError('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setUserLocation({ lat: latitude, lng: longitude });
        setMapCenter([latitude, longitude]);
        setMapZoom(13);
        setGettingLocation(false);
      },
      (err) => {
        setLocationError('Location access denied. Please allow location in your browser settings.');
        setGettingLocation(false);
      },
      { timeout: 10000 }
    );
  }, []);

  /** Fetch nearby events from API and highlight them */
  const loadNearbyEvents = useCallback(async () => {
    if (!userLocation) return;
    try {
      const res = await eventsAPI.getNearby(userLocation.lat, userLocation.lng, radius);
      const ids = new Set(res.data.events.map((e) => e.id));
      setNearbyIds(ids);
      setFilterNearby(true);
    } catch {
      setError('Failed to load nearby events');
    }
  }, [userLocation, radius]);

  const displayedEvents = filterNearby
    ? events.filter((e) => nearbyIds.has(e.id))
    : events;

  /** After a booking, refresh remaining_quantity on the event */
  const handleBookingSuccess = (eventId) => (booking) => {
    setEvents((prev) =>
      prev.map((e) =>
        e.id === eventId
          ? { ...e, remaining_quantity: e.remaining_quantity - booking.quantity_requested }
          : e
      )
    );
  };

  return (
    <PageLayout title="Map View" subtitle="Browse food events on the map.">
      {/* Controls bar */}
      <div className="flex flex-wrap gap-3 items-center mb-4">
        {/* Location button */}
        {!userLocation ? (
          <button
            onClick={requestLocation}
            disabled={gettingLocation}
            className="btn-primary text-sm flex items-center gap-2"
          >
            {gettingLocation ? '⏳ Getting location…' : '📍 Use My Location'}
          </button>
        ) : (
          <span className="text-sm text-forest-700 bg-forest-50 border border-forest-200 px-3 py-2 rounded-xl flex items-center gap-1.5">
            ✅ Location found
          </span>
        )}

        {/* Radius + nearby filter — only when location is available */}
        {userLocation && (
          <>
            <div className="flex items-center gap-2">
              <label className="text-sm text-stone-600 font-medium">Radius:</label>
              <select
                value={radius}
                onChange={(e) => setRadius(Number(e.target.value))}
                className="input-field text-sm py-2 w-24"
              >
                {[2, 5, 10, 20, 50].map((r) => (
                  <option key={r} value={r}>{r} km</option>
                ))}
              </select>
            </div>
            <button onClick={loadNearbyEvents} className="btn-primary text-sm">
              🔍 Find Nearby
            </button>
            {filterNearby && (
              <button
                onClick={() => { setFilterNearby(false); setNearbyIds(new Set()); }}
                className="btn-secondary text-sm"
              >
                Show All
              </button>
            )}
          </>
        )}

        <span className="ml-auto text-stone-400 text-sm">
          {displayedEvents.length} event{displayedEvents.length !== 1 ? 's' : ''}
          {filterNearby ? ` within ${radius} km` : ' total'}
        </span>
      </div>

      {locationError && (
        <div className="bg-amber-50 border border-amber-200 text-amber-700 rounded-xl px-4 py-3 text-sm mb-4">
          ⚠️ {locationError}
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl px-4 py-3 mb-4">{error}</div>
      )}

      {/* Legend */}
      {!loading && (
        <div className="flex flex-wrap gap-4 mb-3 text-xs text-stone-600">
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-[#f79522] inline-block" /> Active</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-red-500 inline-block" /> Expiring &lt;1h</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-forest-600 inline-block" /> Nearby</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-stone-400 inline-block" /> Expired</span>
          {userLocation && <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-blue-500 inline-block" /> You</span>}
        </div>
      )}

      {loading && <div className="text-center py-16 text-stone-400 animate-pulse-soft">Loading map…</div>}

      {!loading && (
        <div className="rounded-2xl overflow-hidden border border-stone-200 shadow-sm" style={{ height: '65vh' }}>
          {/* Inject pulse animation for user location marker */}
          <style>{`@keyframes pulse { 0%,100%{transform:scale(1);opacity:.6} 50%{transform:scale(1.6);opacity:.1} }`}</style>

          <MapContainer
            center={mapCenter}
            zoom={mapZoom}
            style={{ height: '100%', width: '100%' }}
          >
            <MapRecenter center={mapCenter} zoom={mapZoom} />

            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {/* User location marker + radius circle */}
            {userLocation && (
              <>
                <Marker position={[userLocation.lat, userLocation.lng]} icon={userLocationIcon}>
                  <Popup>
                    <div className="text-sm font-semibold text-blue-700">📍 Your Location</div>
                  </Popup>
                </Marker>
                <Circle
                  center={[userLocation.lat, userLocation.lng]}
                  radius={radius * 1000}
                  pathOptions={{ color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.05, weight: 1.5, dashArray: '6 4' }}
                />
              </>
            )}

            {/* Event markers */}
            {displayedEvents.map((event) => {
              const isNearby = nearbyIds.has(event.id);
              return (
                <Marker
                  key={event.id}
                  position={[parseFloat(event.latitude), parseFloat(event.longitude)]}
                  icon={getMarkerIcon(event.expiry_time, isNearby)}
                >
                  <Popup maxWidth={300} minWidth={260}>
                    <div className="p-1 font-body">
                      {/* Header */}
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h3 className="font-semibold text-stone-900 text-sm leading-tight">{event.title}</h3>
                        {isNearby && (
                          <span className="shrink-0 text-xs bg-forest-100 text-forest-700 font-semibold px-1.5 py-0.5 rounded-full">nearby</span>
                        )}
                      </div>

                      {/* Details */}
                      <div className="space-y-1 text-xs text-stone-600 mb-3">
                        <div className="flex justify-between">
                          <span>🍽️ Total</span>
                          <strong>{event.quantity} {event.quantity_unit}</strong>
                        </div>
                        <div className="flex justify-between">
                          <span>📦 Remaining</span>
                          <strong className={event.remaining_quantity === 0 ? 'text-red-500' : 'text-forest-700'}>
                            {event.remaining_quantity} {event.quantity_unit}
                          </strong>
                        </div>
                        <div className="flex justify-between">
                          <span>⏰ Expires</span>
                          <span>{formatExpiry(event.expiry_time)}</span>
                        </div>
                        {event.organizer_name && (
                          <div className="flex justify-between">
                            <span>👤 By</span>
                            <span>{event.organizer_name}</span>
                          </div>
                        )}
                        {event.distance_km != null && (
                          <div className="flex justify-between">
                            <span>📍 Distance</span>
                            <strong>{event.distance_km} km</strong>
                          </div>
                        )}
                      </div>

                      {/* Availability bar */}
                      <div className="mb-3">
                        <div className="w-full bg-stone-100 rounded-full h-1.5">
                          <div
                            className="bg-forest-500 h-1.5 rounded-full"
                            style={{ width: `${Math.max(0, (event.remaining_quantity / event.quantity) * 100)}%` }}
                          />
                        </div>
                      </div>

                      {/* NGO booking inline */}
                      {isNGO && new Date(event.expiry_time) > new Date() && event.remaining_quantity > 0 && (
                        <BookingForm
                          eventId={event.id}
                          remainingQty={event.remaining_quantity}
                          unit={event.quantity_unit}
                          onSuccess={handleBookingSuccess(event.id)}
                        />
                      )}

                      <div className="mt-2 flex gap-2">
                        <Link
                          to={`/events/${event.id}`}
                          className="text-xs font-semibold text-brand-600 hover:underline"
                        >
                          View Details →
                        </Link>
                        {isNGO && (
                          <Link
                            to={`/events/${event.id}/request`}
                            className="text-xs font-semibold text-forest-600 hover:underline"
                          >
                            Book Page →
                          </Link>
                        )}
                      </div>
                    </div>
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>
        </div>
      )}

      {!loading && displayedEvents.length === 0 && !error && (
        <div className="card p-10 text-center text-stone-400 mt-4">
          <p className="text-4xl mb-3">{filterNearby ? '📍' : '🗺️'}</p>
          <p className="font-medium">
            {filterNearby
              ? `No active events within ${radius} km of your location.`
              : 'No events to display on the map.'}
          </p>
          {filterNearby && (
            <button onClick={() => setRadius((r) => Math.min(r * 2, 100))} className="btn-secondary text-sm mt-3">
              Expand radius to {Math.min(radius * 2, 100)} km
            </button>
          )}
        </div>
      )}
    </PageLayout>
  );
}
