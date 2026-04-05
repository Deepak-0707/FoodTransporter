// src/pages/MyRequestsPage.jsx — Phase 3
// NGO dashboard: see all requests with status + allocated quantity
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { requestsAPI } from '../services/api';
import PageLayout from '../components/PageLayout';

const STATUS_STYLES = {
  PENDING:  { cls: 'bg-amber-100 text-amber-700',    icon: '⏳', label: 'Pending'  },
  APPROVED: { cls: 'bg-forest-100 text-forest-700',  icon: '✅', label: 'Approved' },
  REJECTED: { cls: 'bg-red-100 text-red-600',        icon: '❌', label: 'Rejected' },
};

const URGENCY_STYLES = {
  CRITICAL: 'text-red-600 font-bold',
  HIGH:     'text-orange-600 font-semibold',
  MEDIUM:   'text-amber-600',
  LOW:      'text-forest-600',
  EXPIRED:  'text-stone-400',
};

function computeUrgency(expiryTime) {
  const msLeft = new Date(expiryTime) - Date.now();
  const h = msLeft / 3_600_000;
  if (msLeft <= 0) return { label: 'EXPIRED', hoursLeft: 0 };
  if (h < 1)       return { label: 'CRITICAL', hoursLeft: h };
  if (h < 6)       return { label: 'HIGH',     hoursLeft: h };
  if (h < 24)      return { label: 'MEDIUM',   hoursLeft: h };
  return             { label: 'LOW',      hoursLeft: h };
}

function formatDate(dt) {
  return new Date(dt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function StatCard({ icon, label, value, sub }) {
  return (
    <div className="card p-5 flex items-center gap-4">
      <span className="text-3xl">{icon}</span>
      <div>
        <p className="text-2xl font-display font-bold text-stone-900">{value}</p>
        <p className="text-sm text-stone-500">{label}</p>
        {sub && <p className="text-xs text-stone-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

export default function MyRequestsPage() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [filter, setFilter]     = useState('ALL');

  useEffect(() => {
    requestsAPI.getMine()
      .then((res) => setRequests(res.data.requests))
      .catch(() => setError('Failed to load requests'))
      .finally(() => setLoading(false));
  }, []);

  const pending   = requests.filter((r) => r.status === 'PENDING');
  const approved  = requests.filter((r) => r.status === 'APPROVED');
  const rejected  = requests.filter((r) => r.status === 'REJECTED');
  const totalAllocated = approved.reduce((s, r) => s + parseInt(r.allocated_quantity), 0);

  const filtered = filter === 'ALL' ? requests : requests.filter((r) => r.status === filter);

  return (
    <PageLayout title="My Requests" subtitle="Track your food requests and allocations">

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <StatCard icon="📋" label="Total Requests"  value={requests.length} />
        <StatCard icon="⏳" label="Pending"          value={pending.length} />
        <StatCard icon="✅" label="Approved"         value={approved.length} />
        <StatCard icon="🍽️" label="Total Allocated" value={totalAllocated} sub="across all events" />
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {['ALL', 'PENDING', 'APPROVED', 'REJECTED'].map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`text-sm font-semibold px-4 py-1.5 rounded-full border transition-all ${
              filter === s
                ? 'bg-brand-600 text-white border-brand-600'
                : 'bg-white text-stone-600 border-stone-200 hover:border-brand-300'
            }`}
          >
            {s === 'ALL' ? `All (${requests.length})` : `${s.charAt(0) + s.slice(1).toLowerCase()} (${requests.filter(r => r.status === s).length})`}
          </button>
        ))}
      </div>

      {loading && <div className="text-center py-16 text-stone-400 animate-pulse-soft">Loading requests…</div>}
      {error   && <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl px-4 py-3">{error}</div>}

      {!loading && !error && filtered.length === 0 && (
        <div className="card p-12 text-center text-stone-400">
          <p className="text-4xl mb-3">📭</p>
          <p className="font-medium">No {filter === 'ALL' ? '' : filter.toLowerCase() + ' '}requests yet.</p>
          {filter === 'ALL' && (
            <Link to="/events" className="btn-primary mt-4 inline-block text-sm">Browse Events</Link>
          )}
        </div>
      )}

      <div className="space-y-4">
        {filtered.map((req) => {
          const st      = STATUS_STYLES[req.status] || STATUS_STYLES.PENDING;
          const urgency = computeUrgency(req.expiry_time);
          const urg     = URGENCY_STYLES[urgency.label] || URGENCY_STYLES.LOW;
          const isApproved = req.status === 'APPROVED';
          const pct = isApproved
            ? Math.round((req.allocated_quantity / req.quantity_requested) * 100)
            : 0;

          return (
            <div key={req.id} className={`card p-5 ${req.status === 'APPROVED' ? 'border-l-4 border-forest-500' : req.status === 'REJECTED' ? 'border-l-4 border-red-300' : 'border-l-4 border-amber-300'}`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <Link to={`/events/${req.event_id}`} className="font-display font-semibold text-stone-900 hover:text-brand-600 transition-colors">
                      {req.event_title}
                    </Link>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${st.cls}`}>
                      {st.icon} {st.label}
                    </span>
                    {urgency.label !== 'EXPIRED' && (
                      <span className={`text-xs ${urg}`}>{urgency.label}</span>
                    )}
                  </div>
                  <p className="text-xs text-stone-400">
                    By {req.organizer_name} · Requested {formatDate(req.created_at)}
                  </p>
                  <p className="text-xs text-stone-500 mt-1">
                    ⏰ Expires: {formatDate(req.expiry_time)}
                  </p>
                </div>

                {/* Quantity summary */}
                <div className="flex items-center gap-4 shrink-0">
                  <div className="text-center">
                    <p className="text-lg font-bold text-stone-900">{req.quantity_requested}</p>
                    <p className="text-xs text-stone-400">{req.event_quantity_unit || 'kg'} requested</p>
                  </div>
                  <div className="w-px h-10 bg-stone-200" />
                  <div className="text-center">
                    <p className={`text-lg font-bold ${isApproved ? 'text-forest-600' : 'text-stone-300'}`}>
                      {req.allocated_quantity}
                    </p>
                    <p className="text-xs text-stone-400">{req.quantity_unit || 'kg'} allocated</p>
                  </div>
                </div>
              </div>

              {/* Allocation progress bar (only for approved) */}
              {isApproved && (
                <div className="mt-3">
                  <div className="flex justify-between text-xs text-stone-500 mb-1">
                    <span>Allocation</span>
                    <span>{pct}% of requested</span>
                  </div>
                  <div className="w-full bg-stone-100 rounded-full h-1.5">
                    <div
                      className="bg-forest-500 h-1.5 rounded-full transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  {pct < 100 && (
                    <p className="text-xs text-stone-400 mt-1">
                      Proportional share — food was split fairly among all requesting NGOs.
                    </p>
                  )}
                </div>
              )}

              {req.status === 'REJECTED' && (
                <p className="text-xs text-red-500 mt-2">
                  Request could not be fulfilled — no food remaining after allocation.
                </p>
              )}

              {req.status === 'PENDING' && (
                <p className="text-xs text-amber-600 mt-2">
                  ⏳ Waiting for allocation. The organizer or system will allocate soon.
                </p>
              )}
            </div>
          );
        })}
      </div>
    </PageLayout>
  );
}
