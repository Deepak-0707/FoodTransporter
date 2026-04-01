// src/pages/EventRequestsPage.jsx — Phase 3
// Organizer dashboard: see all requests, allocations, and trigger allocation manually
import React, { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { eventsAPI } from '../services/api';
import PageLayout from '../components/PageLayout';

const STATUS_STYLES = {
  PENDING:  { cls: 'bg-amber-100 text-amber-700',   icon: '⏳' },
  APPROVED: { cls: 'bg-forest-100 text-forest-700', icon: '✅' },
  REJECTED: { cls: 'bg-red-100 text-red-600',       icon: '❌' },
};

function formatDateTime(dt) {
  return new Date(dt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function SummaryCard({ icon, label, value, highlight }) {
  return (
    <div className={`rounded-2xl p-4 text-center ${highlight ? 'bg-brand-50 border border-brand-100' : 'bg-stone-50 border border-stone-100'}`}>
      <p className="text-2xl mb-0.5">{icon}</p>
      <p className={`text-xl font-bold ${highlight ? 'text-brand-700' : 'text-stone-900'}`}>{value}</p>
      <p className="text-xs text-stone-500">{label}</p>
    </div>
  );
}

export default function EventRequestsPage() {
  const { id } = useParams();

  const [data, setData]             = useState(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [allocating, setAllocating] = useState(false);
  const [allocResult, setAllocResult] = useState(null);

  const fetchData = useCallback(() => {
    setLoading(true);
    eventsAPI.getRequests(id)
      .then((res) => setData(res.data))
      .catch((err) => setError(err.response?.data?.error || 'Failed to load requests'))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleAllocate = async () => {
    setAllocating(true);
    setAllocResult(null);
    try {
      const res = await eventsAPI.allocate(id);
      setAllocResult({ success: true, ...res.data });
      // Refresh data to show updated statuses
      fetchData();
    } catch (err) {
      setAllocResult({ success: false, error: err.response?.data?.error || 'Allocation failed' });
    } finally {
      setAllocating(false);
    }
  };

  if (loading) return (
    <PageLayout>
      <div className="text-center py-16 text-stone-400 animate-pulse-soft">Loading requests…</div>
    </PageLayout>
  );

  if (error) return (
    <PageLayout>
      <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl px-4 py-3">{error}</div>
      <Link to="/dashboard" className="text-sm text-stone-500 hover:underline mt-4 inline-block">← Back to Dashboard</Link>
    </PageLayout>
  );

  const { event, requests, summary } = data;
  const allocated_pct = event
    ? Math.round(((event.quantity - event.remaining_quantity) / event.quantity) * 100)
    : 0;

  const hasPending = summary.pending > 0;

  return (
    <PageLayout title="Allocation Dashboard" subtitle={`Smart distribution for: ${event?.title}`}>
      <Link to={`/events/${id}`} className="text-sm text-stone-500 hover:text-stone-700 flex items-center gap-1 mb-6">
        ← Back to Event
      </Link>

      {/* Event Summary Card */}
      <div className="card p-5 mb-6">
        <div className="flex flex-wrap gap-4 items-center justify-between mb-4">
          <div>
            <h2 className="font-display font-bold text-lg text-stone-900">{event?.title}</h2>
            <p className="text-sm text-stone-500 mt-0.5">Expires: {formatDateTime(event?.expiry_time)}</p>
          </div>
          {/* Run Allocation Button */}
          <button
            onClick={handleAllocate}
            disabled={allocating || !hasPending}
            className={`flex items-center gap-2 font-semibold px-5 py-2.5 rounded-xl transition-all text-sm shadow-sm ${
              hasPending && !allocating
                ? 'bg-brand-600 hover:bg-brand-700 text-white'
                : 'bg-stone-100 text-stone-400 cursor-not-allowed'
            }`}
          >
            {allocating ? (
              <><span className="animate-spin inline-block">⚙️</span> Allocating…</>
            ) : (
              <>⚡ Run Allocation{hasPending ? ` (${summary.pending} pending)` : ''}</>
            )}
          </button>
        </div>

        {/* Distribution summary stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <SummaryCard icon="🍽️" label={`${event?.quantity_unit} total`}     value={event?.quantity}            />
          <SummaryCard icon="✅" label={`${event?.quantity_unit} allocated`}  value={event?.quantity - event?.remaining_quantity} highlight />
          <SummaryCard icon="📦" label={`${event?.quantity_unit} remaining`} value={event?.remaining_quantity}  />
          <SummaryCard icon="📋" label="total requests"                       value={summary.total_requests}     />
        </div>

        {/* Fill bar */}
        <div>
          <div className="flex justify-between text-xs text-stone-500 mb-1">
            <span>{summary.approved} approved · {summary.pending} pending · {summary.rejected} rejected</span>
            <span>{allocated_pct}% distributed</span>
          </div>
          <div className="w-full bg-stone-100 rounded-full h-2.5">
            <div
              className="bg-brand-500 h-2.5 rounded-full transition-all duration-500"
              style={{ width: `${allocated_pct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Allocation result banner */}
      {allocResult && (
        <div className={`rounded-xl px-5 py-4 mb-5 flex items-start gap-3 ${
          allocResult.success ? 'bg-forest-50 border border-forest-200 text-forest-800' : 'bg-red-50 border border-red-200 text-red-700'
        }`}>
          <span className="text-xl shrink-0">{allocResult.success ? '✅' : '❌'}</span>
          <div>
            {allocResult.success ? (
              <>
                <p className="font-semibold text-sm">Allocation complete!</p>
                <p className="text-xs mt-0.5">
                  {allocResult.allocated} {event?.quantity_unit} distributed across {allocResult.results?.length || 0} NGO(s).
                </p>
              </>
            ) : (
              <p className="text-sm font-medium">{allocResult.error}</p>
            )}
          </div>
        </div>
      )}

      {/* Algorithm explanation */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-6 text-xs text-blue-800">
        <p className="font-semibold text-sm mb-1">⚙️ How allocation works</p>
        <p>If total requested ≤ available food → every NGO gets their full request. Otherwise,
        food is split proportionally using the Largest Remainder Method — no NGO gets zero
        if food is available, and no food unit is wasted.</p>
      </div>

      {/* Requests table */}
      {requests.length === 0 ? (
        <div className="card p-10 text-center text-stone-400">
          <p className="text-3xl mb-2">📭</p>
          <p className="font-medium">No requests yet for this event.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-stone-100 shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 border-b border-stone-100">
              <tr>
                <th className="text-left px-5 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wider">NGO</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wider">Email</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wider">Requested</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wider">Allocated</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wider">Status</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wider">Submitted</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-50 bg-white">
              {requests.map((r) => {
                const st  = STATUS_STYLES[r.status] || STATUS_STYLES.PENDING;
                const pct = r.status === 'APPROVED' && r.quantity_requested > 0
                  ? Math.round((r.allocated_quantity / r.quantity_requested) * 100)
                  : null;

                return (
                  <tr key={r.id} className="hover:bg-stone-50 transition-colors">
                    <td className="px-5 py-3.5 font-medium text-stone-900">{r.ngo_name}</td>
                    <td className="px-5 py-3.5 text-stone-500 text-xs">{r.ngo_email}</td>
                    <td className="px-5 py-3.5 text-right font-semibold text-stone-700">
                      {r.quantity_requested} <span className="text-stone-400 font-normal text-xs">{event?.quantity_unit}</span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <span className={`font-bold ${r.status === 'APPROVED' ? 'text-forest-600' : 'text-stone-300'}`}>
                        {r.allocated_quantity}
                      </span>
                      {pct !== null && (
                        <span className="text-xs text-stone-400 ml-1">({pct}%)</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${st.cls}`}>
                        {st.icon} {r.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-stone-500 text-xs">{formatDateTime(r.created_at)}</td>
                  </tr>
                );
              })}
            </tbody>
            {/* Summary footer row */}
            <tfoot className="bg-stone-50 border-t-2 border-stone-200">
              <tr>
                <td colSpan={2} className="px-5 py-3 text-xs font-semibold text-stone-500 uppercase">Totals</td>
                <td className="px-5 py-3 text-right font-bold text-stone-700">{summary.total_requested} {event?.quantity_unit}</td>
                <td className="px-5 py-3 text-right font-bold text-forest-600">{summary.total_allocated} {event?.quantity_unit}</td>
                <td colSpan={2} className="px-5 py-3 text-xs text-stone-400">{summary.food_remaining} {event?.quantity_unit} remaining</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </PageLayout>
  );
}
