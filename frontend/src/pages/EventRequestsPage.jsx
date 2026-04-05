// src/pages/EventRequestsPage.jsx — Manual Allocation by Organizer (with per-item support)
import React, { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { eventsAPI, menuAPI } from '../services/api';
import PageLayout from '../components/PageLayout';

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

  const [data, setData]           = useState(null);
  const [menuItems, setMenuItems] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [saving, setSaving]       = useState({});
  const [saveMsg, setSaveMsg]     = useState({});
  // Local edits: { [requestId]: { allocated_quantity, status, allocated_items: { [menuItemId]: number } } }
  const [edits, setEdits]         = useState({});
  const [toast, setToast]         = useState('');

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3500);
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch requests and menu items in parallel
      const [reqRes, menuRes] = await Promise.all([
        eventsAPI.getRequests(id),
        menuAPI.getByEvent(id).catch((e) => {
          console.warn('Menu fetch failed:', e?.response?.status, e?.message);
          return { data: { menuItems: [] } };
        }),
      ]);

      const fetchedMenuItems = menuRes.data?.menuItems || [];
      console.log('[fetchData] menuItems loaded:', fetchedMenuItems.length, fetchedMenuItems.map(m => m.name));

      const reqData = reqRes.data;

      // Build summary if not returned by backend
      if (!reqData.summary) {
        const reqs = reqData.requests || [];
        reqData.summary = {
          total_requests: reqs.length,
          pending:  reqs.filter(r => r.status === 'PENDING').length,
          approved: reqs.filter(r => r.status === 'APPROVED').length,
          rejected: reqs.filter(r => r.status === 'REJECTED').length,
          total_requested: reqs.reduce((s, r) => s + (r.quantity_requested || 0), 0),
          total_allocated: reqs.filter(r => r.status === 'APPROVED').reduce((s, r) => s + (r.allocated_quantity || 0), 0),
          food_remaining: reqData.event?.remaining_quantity || 0,
        };
      }

      // Build edits map — must use fetchedMenuItems captured above
      const initial = {};
      (reqData.requests || []).forEach((r) => {
        const allocMap = {};
        if (r.allocated_items && r.allocated_items.length > 0) {
          r.allocated_items.forEach(ai => { allocMap[String(ai.menu_item_id)] = ai.quantity; });
        } else if (r.selected_items && r.selected_items.length > 0) {
          r.selected_items.forEach(si => { allocMap[String(si.menu_item_id)] = si.quantity; });
        } else {
          // Seed from all event menu items with 0
          fetchedMenuItems.forEach(mi => { allocMap[String(mi.id)] = 0; });
        }
        initial[r.id] = {
          allocated_quantity: r.allocated_quantity ?? 0,
          status: r.status,
          allocated_items: allocMap,
        };
      });

      // Set all state together to avoid race conditions
      setMenuItems(fetchedMenuItems);
      setData(reqData);
      setEdits(initial);
    } catch (err) {
      console.error('fetchData error:', err);
      setError(err.response?.data?.error || 'Failed to load requests');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleEditChange = (requestId, field, value) => {
    setEdits((prev) => ({
      ...prev,
      [requestId]: { ...prev[requestId], [field]: value },
    }));
  };

  // Update a specific menu item's allocated quantity within a request
  const handleItemAllocChange = (requestId, menuItemId, value) => {
    const newVal = Math.max(0, parseInt(value, 10) || 0);
    const key = String(menuItemId); // always string keys for consistency
    setEdits((prev) => {
      const cur = prev[requestId] || {};
      const newAllocItems = { ...(cur.allocated_items || {}), [key]: newVal };
      // Auto-sum total from item qtys
      const total = Object.values(newAllocItems).reduce((a, b) => a + b, 0);
      return {
        ...prev,
        [requestId]: {
          ...cur,
          allocated_items: newAllocItems,
          allocated_quantity: total,
        },
      };
    });
  };

  // Save a single request's allocation
  const handleSave = async (requestId) => {
    const edit = edits[requestId];
    if (!edit) return;
    setSaving((p) => ({ ...p, [requestId]: true }));
    setSaveMsg((p) => ({ ...p, [requestId]: null }));
    try {
      // Build allocated_items array for API
      const allocated_items = Object.entries(edit.allocated_items || {})
        .filter(([, qty]) => qty > 0)
        .map(([menuItemId, qty]) => {
          const menuItem = menuItems.find(m => String(m.id) === String(menuItemId));
          return {
            menu_item_id: menuItemId,
            name: menuItem?.name || '',
            quantity: qty,
            quantity_unit: menuItem?.quantity_unit || '',
          };
        });

      await eventsAPI.updateRequestAllocation(id, requestId, {
        allocated_quantity: parseInt(edit.allocated_quantity, 10) || 0,
        status: edit.status,
        allocated_items: allocated_items.length > 0 ? allocated_items : undefined,
      });
      setSaveMsg((p) => ({ ...p, [requestId]: { ok: true, msg: 'Saved!' } }));
      fetchData();
    } catch (err) {
      setSaveMsg((p) => ({
        ...p,
        [requestId]: { ok: false, msg: err.response?.data?.error || 'Save failed' },
      }));
    } finally {
      setSaving((p) => ({ ...p, [requestId]: false }));
    }
  };

  // Distribute evenly across all pending requests
  const handleDistributeEvenly = () => {
    if (!data) return;
    const pending = data.requests.filter((r) => r.status === 'PENDING');
    if (!pending.length) return;
    const perNGO = Math.floor(data.event.remaining_quantity / pending.length);
    const newEdits = { ...edits };
    pending.forEach((r) => {
      newEdits[r.id] = { ...newEdits[r.id], allocated_quantity: perNGO, status: 'APPROVED' };
    });
    setEdits(newEdits);
    showToast(`Distributed ${perNGO} ${data.event.quantity_unit} to each of ${pending.length} NGO(s). Click Save on each to confirm.`);
  };

  // Save all edited requests at once
  const handleSaveAll = async () => {
    if (!data) return;
    const toSave = data.requests.filter((r) => {
      const e = edits[r.id];
      return e && (String(e.allocated_quantity) !== String(r.allocated_quantity) || e.status !== r.status);
    });
    if (!toSave.length) { showToast('No changes to save.'); return; }
    for (const r of toSave) { await handleSave(r.id); }
    showToast(`✅ Saved allocation for ${toSave.length} request(s).`);
  };

  if (loading) return <PageLayout><div className="text-center py-16 text-stone-400 animate-pulse-soft">Loading requests…</div></PageLayout>;
  if (error)   return <PageLayout><div className="bg-red-50 border border-red-200 text-red-600 rounded-xl px-4 py-3">{error}</div><Link to="/dashboard" className="text-sm text-stone-500 hover:underline mt-4 inline-block">← Back to Dashboard</Link></PageLayout>;
  if (!data)   return <PageLayout><div className="text-center py-16 text-stone-400">No data available.</div></PageLayout>;

  const event    = data.event    || {};
  const requests = data.requests || [];
  const summary  = data.summary  || { total_requests: 0, pending: 0, approved: 0, rejected: 0, total_requested: 0, total_allocated: 0, food_remaining: 0 };
  const allocated_pct = event.quantity
    ? Math.round(((event.quantity - event.remaining_quantity) / event.quantity) * 100)
    : 0;
  const pendingCount = requests.filter((r) => r.status === 'PENDING').length;

  const editedApprovedTotal = requests.reduce((sum, r) => {
    const e = edits[r.id];
    return sum + (e?.status === 'APPROVED' ? (parseInt(e.allocated_quantity, 10) || 0) : 0);
  }, 0);
  const liveRemaining = event.quantity - editedApprovedTotal;

  return (
    <PageLayout title="Allocation Dashboard" subtitle={`Manually allocate food for: ${event?.title}`}>
      <Link to={`/events/${id}`} className="text-sm text-stone-500 hover:text-stone-700 flex items-center gap-1 mb-6">
        ← Back to Event
      </Link>

      {/* Toast */}
      {toast && (
        <div className="mb-4 bg-blue-50 border border-blue-200 text-blue-700 rounded-xl px-4 py-3 text-sm font-medium">
          {toast}
        </div>
      )}

      {/* Summary Card */}
      <div className="card p-5 mb-6">
        <div className="flex flex-wrap gap-4 items-start justify-between mb-4">
          <div>
            <h2 className="font-display font-bold text-lg text-stone-900">{event?.title}</h2>
            <p className="text-sm text-stone-500 mt-0.5">Expires: {formatDateTime(event?.expiry_time)}</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {pendingCount > 0 && (
              <button
                onClick={handleDistributeEvenly}
                className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 hover:bg-amber-100 transition-all"
              >
                ⚖️ Split Evenly
              </button>
            )}
            <button
              onClick={handleSaveAll}
              className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white transition-all shadow-sm"
            >
              💾 Save All Changes
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <SummaryCard icon="🍽️" label={`${event?.quantity_unit} total`}     value={event?.quantity} />
          <SummaryCard icon="✅" label={`${event?.quantity_unit} allocated`}  value={editedApprovedTotal} highlight />
          <SummaryCard icon="📦" label={`${event?.quantity_unit} remaining`} value={liveRemaining} />
          <SummaryCard icon="📋" label="total requests"                       value={summary.total_requests} />
        </div>

        <div>
          <div className="flex justify-between text-xs text-stone-500 mb-1">
            <span>{summary.approved} approved · {summary.pending} pending · {summary.rejected} rejected</span>
            <span>{allocated_pct}% distributed (saved)</span>
          </div>
          <div className="w-full bg-stone-100 rounded-full h-2.5">
            <div className="bg-brand-500 h-2.5 rounded-full transition-all duration-500" style={{ width: `${allocated_pct}%` }} />
          </div>
        </div>

        {liveRemaining < 0 && (
          <div className="mt-3 bg-red-50 border border-red-200 text-red-700 rounded-xl px-3 py-2 text-xs font-medium">
            ⚠️ Total allocated ({editedApprovedTotal}) exceeds available ({event.quantity}). Reduce some allocations before saving.
          </div>
        )}
      </div>

      {/* How it works */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-6 text-xs text-blue-800">
        <p className="font-semibold text-sm mb-1">📋 How to allocate</p>
        <p>Set the quantity for each NGO's request — either by menu item or as a total. Then set status to APPROVED or REJECTED. Use <strong>Split Evenly</strong> to auto-fill equal amounts. Click <strong>Save</strong> on each row or <strong>Save All Changes</strong> at once.</p>
      </div>

      {/* Requests */}
      {requests.length === 0 ? (
        <div className="card p-10 text-center text-stone-400">
          <p className="text-3xl mb-2">📭</p>
          <p className="font-medium">No requests yet for this event.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map((r) => {
            const edit = edits[r.id] || { allocated_quantity: r.allocated_quantity, status: r.status, allocated_items: {} };
            const isSaving = saving[r.id];
            const msg = saveMsg[r.id];
            const isDirty = String(edit.allocated_quantity) !== String(r.allocated_quantity) || edit.status !== r.status;
            const hasSelectedItems = r.selected_items && r.selected_items.length > 0;

            return (
              <div key={r.id} className={`card p-5 border-l-4 transition-all ${
                edit.status === 'APPROVED' ? 'border-l-green-400' :
                edit.status === 'REJECTED' ? 'border-l-red-400' : 'border-l-amber-400'
              }`}>
                {/* NGO Info */}
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div>
                    <p className="font-semibold text-stone-900">{r.ngo_name}</p>
                    <p className="text-xs text-stone-500">{r.ngo_email}</p>
                    <p className="text-xs text-stone-400 mt-0.5">Submitted: {formatDateTime(r.created_at)}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-stone-500">Requested</p>
                    <p className="font-bold text-stone-900 text-lg">{r.quantity_requested} <span className="text-sm font-normal text-stone-500">{event?.quantity_unit}</span></p>
                  </div>
                </div>

                {/* Per-menu-item allocation — always shown, with prompt to add items if none exist */}
                {menuItems.length === 0 && (
                  <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2">
                    <span className="text-lg">⚠️</span>
                    <div>
                      <p className="text-xs font-semibold text-amber-800">No menu items on this event yet.</p>
                      <p className="text-xs text-amber-700 mt-0.5">
                        Add menu items to the event to enable per-item allocation.{' '}
                        <a href={`/events/${id}`} className="underline font-semibold hover:text-amber-900">
                          Go to event → Add Menu Items
                        </a>
                      </p>
                    </div>
                  </div>
                )}
                {menuItems.length > 0 && (() => {
                  // Build the display list:
                  // Priority: NGO's selected_items > organizer's previously saved allocated_items > all event menu items
                  const displayItems = hasSelectedItems
                    ? r.selected_items.map(si => ({
                        menu_item_id: String(si.menu_item_id),
                        name: si.name,
                        requested: si.quantity,
                        quantity_unit: si.quantity_unit,
                        max: si.quantity,
                      }))
                    : menuItems.map(mi => ({
                        menu_item_id: String(mi.id),
                        name: mi.name,
                        requested: null,
                        quantity_unit: mi.quantity_unit,
                        max: mi.quantity,
                      }));

                  return (
                    <div className="mb-4 bg-stone-50 rounded-xl p-3 border border-stone-100">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-semibold text-stone-600">🍽️ Allocate by menu item:</p>
                        {!hasSelectedItems && (
                          <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
                            NGO requested total only — set per-item below
                          </span>
                        )}
                      </div>
                      <div className="space-y-2">
                        {displayItems.map((item) => (
                          <div key={item.menu_item_id} className="flex items-center justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-stone-700 truncate">{item.name}</p>
                              {item.requested != null
                                ? <p className="text-xs text-stone-400">NGO requested: {item.requested} {item.quantity_unit}</p>
                                : <p className="text-xs text-stone-400">Available: {item.max} {item.quantity_unit}</p>
                              }
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                disabled={edit.status === 'REJECTED'}
                                onClick={() => handleItemAllocChange(r.id, String(item.menu_item_id), (edit.allocated_items?.[String(item.menu_item_id)] || 0) - 1)}
                                className="w-7 h-7 rounded-lg bg-stone-200 hover:bg-stone-300 disabled:opacity-40 text-stone-700 font-bold text-sm flex items-center justify-center transition-colors"
                              >−</button>
                              <input
                                type="number"
                                min="0"
                                max={item.max}
                                value={edit.allocated_items?.[item.menu_item_id] ?? 0}
                                onChange={(e) => handleItemAllocChange(r.id, item.menu_item_id, e.target.value)}
                                disabled={edit.status === 'REJECTED'}
                                className="w-16 text-center border border-stone-200 rounded-lg py-1 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-brand-300 disabled:opacity-40 disabled:bg-stone-100"
                              />
                              <button
                                type="button"
                                disabled={edit.status === 'REJECTED'}
                                onClick={() => handleItemAllocChange(r.id, String(item.menu_item_id), (edit.allocated_items?.[String(item.menu_item_id)] || 0) + 1)}
                                className="w-7 h-7 rounded-lg bg-brand-100 hover:bg-brand-200 disabled:opacity-40 text-brand-700 font-bold text-sm flex items-center justify-center transition-colors"
                              >+</button>
                              <span className="text-xs text-stone-400 w-8">{item.quantity_unit}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="mt-2 pt-2 border-t border-stone-200 flex justify-between items-center">
                        <p className="text-xs text-stone-500 font-medium">Total from items:</p>
                        <p className="text-sm font-bold text-brand-700">
                          {Object.values(edit.allocated_items || {}).reduce((a, b) => a + b, 0)} {event?.quantity_unit}
                        </p>
                      </div>
                    </div>
                  );
                })()}

                {/* Allocation controls */}
                <div className="flex flex-wrap items-end gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-stone-600">
                      Total allocated ({event?.quantity_unit})
                    </label>
                    <input
                      type="number"
                      min="0"
                      max={r.quantity_requested}
                      value={edit.allocated_quantity}
                      onChange={(e) => handleEditChange(r.id, 'allocated_quantity', e.target.value)}
                      className="w-28 input-field text-center font-bold text-lg py-2"
                      disabled={edit.status === 'REJECTED'}
                    />
                    {edit.status !== 'REJECTED' && (
                      <p className="text-xs text-stone-400">max: {r.quantity_requested}</p>
                    )}
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-stone-600">Status</label>
                    <div className="flex gap-2">
                      {['APPROVED', 'PENDING', 'REJECTED'].map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => {
                            handleEditChange(r.id, 'status', s);
                            if (s === 'REJECTED') {
                              handleEditChange(r.id, 'allocated_quantity', 0);
                              // Zero out all item allocations
                              setEdits(prev => ({
                                ...prev,
                                [r.id]: {
                                  ...prev[r.id],
                                  status: 'REJECTED',
                                  allocated_quantity: 0,
                                  allocated_items: Object.fromEntries(
                                    Object.keys(prev[r.id]?.allocated_items || {}).map(k => [k, 0])
                                  ),
                                },
                              }));
                            }
                          }}
                          className={`text-xs font-semibold px-3 py-2 rounded-xl border transition-all ${
                            edit.status === s
                              ? s === 'APPROVED' ? 'bg-green-500 text-white border-green-500'
                              : s === 'REJECTED' ? 'bg-red-500 text-white border-red-500'
                              : 'bg-amber-400 text-white border-amber-400'
                              : 'bg-white text-stone-600 border-stone-200 hover:border-stone-400'
                          }`}
                        >
                          {s === 'APPROVED' ? '✅' : s === 'REJECTED' ? '❌' : '⏳'} {s}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="ml-auto flex items-center gap-2">
                    {msg && (
                      <p className={`text-xs font-medium ${msg.ok ? 'text-green-600' : 'text-red-600'}`}>
                        {msg.msg}
                      </p>
                    )}
                    <button
                      onClick={() => handleSave(r.id)}
                      disabled={isSaving || !isDirty || liveRemaining < 0}
                      className={`text-sm font-semibold px-4 py-2 rounded-xl transition-all ${
                        isDirty && !isSaving && liveRemaining >= 0
                          ? 'bg-brand-600 hover:bg-brand-700 text-white shadow-sm'
                          : 'bg-stone-100 text-stone-400 cursor-not-allowed'
                      }`}
                    >
                      {isSaving ? '⏳ Saving…' : isDirty ? '💾 Save' : '✓ Saved'}
                    </button>
                  </div>
                </div>

                {/* Progress bar */}
                {edit.status === 'APPROVED' && edit.allocated_quantity > 0 && (
                  <div className="mt-3">
                    <div className="flex justify-between text-xs text-stone-400 mb-1">
                      <span>Allocated vs requested</span>
                      <span>{Math.round((edit.allocated_quantity / r.quantity_requested) * 100)}%</span>
                    </div>
                    <div className="w-full bg-stone-100 rounded-full h-1.5">
                      <div
                        className="bg-green-500 h-1.5 rounded-full transition-all duration-300"
                        style={{ width: `${Math.min(100, (edit.allocated_quantity / r.quantity_requested) * 100)}%` }}
                      />
                    </div>
                  </div>
                )}

                {r.note && (
                  <p className="mt-3 text-xs text-stone-500 italic bg-stone-50 rounded-lg px-3 py-2">
                    📝 Note: {r.note}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Totals footer */}
      {requests.length > 0 && (
        <div className="mt-6 card p-4 flex flex-wrap justify-between gap-3 text-sm">
          <span className="text-stone-600">Total requested: <strong>{summary.total_requested} {event?.quantity_unit}</strong></span>
          <span className="text-green-700">Total allocated (saved): <strong>{summary.total_allocated} {event?.quantity_unit}</strong></span>
          <span className="text-stone-500">Remaining: <strong>{summary.food_remaining} {event?.quantity_unit}</strong></span>
        </div>
      )}
    </PageLayout>
  );
}
