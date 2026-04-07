// src/components/MapView.jsx — Phase 4: enhanced Leaflet map
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getPriorityInfo } from './MenuList';
import { useAuth } from '../context/AuthContext';

// Leaflet must be imported dynamically in React to avoid SSR issues
let L;

const URGENCY_COLORS = {
  CRITICAL: '#dc2626', // red-600
  HIGH:     '#ea580c', // orange-600
  MEDIUM:   '#d97706', // amber-600
  LOW:      '#16a34a', // green-600
  EXPIRED:  '#78716c', // stone-500
};

function createEventIcon(label, L) {
  const color = URGENCY_COLORS[label] || URGENCY_COLORS.LOW;
  const isPulsing = label === 'CRITICAL';

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="36" height="44" viewBox="0 0 36 44">
      ${isPulsing ? `<circle cx="18" cy="18" r="16" fill="${color}" opacity="0.2">
        <animate attributeName="r" values="14;20;14" dur="1.5s" repeatCount="indefinite"/>
        <animate attributeName="opacity" values="0.3;0;0.3" dur="1.5s" repeatCount="indefinite"/>
      </circle>` : ''}
      <path d="M18 0C8.06 0 0 8.06 0 18c0 12 18 26 18 26S36 30 36 18C36 8.06 27.94 0 18 0z" fill="${color}"/>
      <circle cx="18" cy="18" r="9" fill="white"/>
      <text x="18" y="22" text-anchor="middle" font-size="11" fill="${color}" font-weight="bold" font-family="sans-serif">
        ${label === 'CRITICAL' ? '!!!' : label === 'HIGH' ? '!!' : label === 'MEDIUM' ? '!' : '✓'}
      </text>
    </svg>
  `;

  return L.divIcon({
    html: svg,
    className: '',
    iconSize: [36, 44],
    iconAnchor: [18, 44],
    popupAnchor: [0, -44],
  });
}

function createUserIcon(L) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28">
      <circle cx="14" cy="14" r="12" fill="#6366f1" stroke="white" stroke-width="3"/>
      <circle cx="14" cy="14" r="5" fill="white"/>
    </svg>
  `;
  return L.divIcon({
    html: svg,
    className: '',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14],
  });
}

export default function MapView({ events = [], userLocation = null, height = '500px' }) {
  const mapRef     = useRef(null);
  const mapObjRef  = useRef(null);
  const markersRef = useRef([]);
  const navigate   = useNavigate();
  const { user }   = useAuth();
  const [leafletReady, setLeafletReady] = useState(false);

  // Dynamically load Leaflet CSS
  useEffect(() => {
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id   = 'leaflet-css';
      link.rel  = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }
    import('leaflet').then((mod) => {
      L = mod.default;
      setLeafletReady(true);
    });
  }, []);

  // Init map
  useEffect(() => {
    if (!leafletReady || !mapRef.current || mapObjRef.current) return;

    const defaultCenter = userLocation
      ? [userLocation.lat, userLocation.lng]
      : [13.0827, 80.2707]; // Chennai default

    const map = L.map(mapRef.current, {
      center: defaultCenter,
      zoom: 12,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    mapObjRef.current = map;
    return () => {
      map.remove();
      mapObjRef.current = null;
    };
  }, [leafletReady]);

  // Add event markers
  useEffect(() => {
    if (!mapObjRef.current || !leafletReady) return;
    const map = mapObjRef.current;

    // Clear old markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    events.forEach((event) => {
      const lat = parseFloat(event.latitude);
      const lng = parseFloat(event.longitude);
      if (isNaN(lat) || isNaN(lng)) return;

      const icon = createEventIcon(event.label || 'LOW', L);
      const marker = L.marker([lat, lng], { icon }).addTo(map);

      // Build menu items HTML
      const menuHtml = (event.menuItems || []).length > 0
        ? `<div class="mt-2 pt-2 border-t border-gray-100">
            <p class="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Menu Items</p>
            ${(event.menuItems || []).slice(0, 3).map((item) => {
              const p = getPriorityInfo(item.waste_time_hours || 24);
              return `<div class="flex justify-between items-center text-xs py-0.5">
                <span>${item.name} — ${item.quantity} ${item.quantity_unit}</span>
                <span class="ml-2 font-bold ${
                  p.level === 'HIGH' ? 'text-red-600' : p.level === 'MEDIUM' ? 'text-amber-600' : 'text-green-600'
                }">${p.level === 'HIGH' ? '🔴' : p.level === 'MEDIUM' ? '🟡' : '🟢'}</span>
              </div>`;
            }).join('')}
            ${(event.menuItems || []).length > 3 ? `<p class="text-xs text-gray-400">+${(event.menuItems || []).length - 3} more items</p>` : ''}
          </div>`
        : '';

      const urgencyColor = URGENCY_COLORS[event.label] || URGENCY_COLORS.LOW;
      const popupHtml = `
        <div style="min-width:200px; max-width:260px; font-family: 'DM Sans', sans-serif;">
          <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:6px;">
            <h3 style="font-weight:700; font-size:14px; color:#1c1917; margin:0; flex:1;">${event.title}</h3>
            <span style="background:${urgencyColor}20; color:${urgencyColor}; font-size:10px; font-weight:700; padding:2px 7px; border-radius:20px; border:1px solid ${urgencyColor}40; margin-left:6px; white-space:nowrap;">
              ${event.label || 'LOW'}
            </span>
          </div>
          <p style="font-size:12px; color:#78716c; margin:0 0 6px;">
            By ${event.organizer_name || 'Organizer'}
          </p>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px; margin-bottom:8px;">
            <div style="background:#fdf4e7; border-radius:8px; padding:6px 8px;">
              <p style="font-size:10px; color:#c45f07; font-weight:600; margin:0;">Available</p>
              <p style="font-size:13px; font-weight:700; color:#1c1917; margin:0;">${event.remaining_quantity || 0} ${event.quantity_unit || ''}</p>
            </div>
            <div style="background:#f0fdf4; border-radius:8px; padding:6px 8px;">
              <p style="font-size:10px; color:#16a34a; font-weight:600; margin:0;">Expires</p>
              <p style="font-size:11px; font-weight:600; color:#1c1917; margin:0;">${event.hoursLeft != null ? (event.hoursLeft < 1 ? '<1h' : Math.round(event.hoursLeft) + 'h') : 'N/A'}</p>
            </div>
          </div>
          ${menuHtml}
          <button
            onclick="window._fbNavigate('/events/${event.id}')"
            style="width:100%; background:${urgencyColor}; color:white; border:none; border-radius:10px; padding:8px; font-weight:700; font-size:12px; cursor:pointer; margin-top:4px;"
          >
            ${user?.role === 'NGO' ? '📋 View & Request' : '👁️ View Details'}
          </button>
        </div>
      `;

      marker.bindPopup(popupHtml, { maxWidth: 280 });
      markersRef.current.push(marker);
    });

    // Fit bounds if we have markers
    if (markersRef.current.length > 0 && !userLocation) {
      const group = L.featureGroup(markersRef.current);
      map.fitBounds(group.getBounds().pad(0.2));
    }
  }, [events, leafletReady, user]);

  // User location marker
  useEffect(() => {
    if (!mapObjRef.current || !userLocation || !leafletReady) return;
    const icon = createUserIcon(L);
    const marker = L.marker([userLocation.lat, userLocation.lng], { icon })
      .addTo(mapObjRef.current)
      .bindPopup('<b>📍 Your Location</b>');
    return () => marker.remove();
  }, [userLocation, leafletReady]);

  // Expose navigation for popup buttons
  useEffect(() => {
    window._fbNavigate = (path) => navigate(path);
    return () => { delete window._fbNavigate; };
  }, [navigate]);

  return (
    <div
      ref={mapRef}
      style={{ height, width: '100%', borderRadius: '16px', overflow: 'hidden' }}
      className="border border-stone-200"
    />
  );
}
