// src/components/MenuList.jsx — Phase 4: waste priority visualization
import React from 'react';

// Helper: get waste time in hours from an item, regardless of which field the server sent.
// Backend stores `waste_time_minutes`; MenuForm also passes `waste_time_hours` for local preview.
function getWasteHours(item) {
  if (!item) return 24; // guard against null/undefined entries
  if (item.waste_time_hours != null)   return Number(item.waste_time_hours);
  if (item.waste_time_minutes != null) return Number(item.waste_time_minutes) / 60;
  return 24; // safe default
}

// Priority scoring: lower waste_time = higher risk
export function getPriorityInfo(wasteTimeHours) {
  if (wasteTimeHours <= 2)  return { level: 'HIGH',   label: 'HIGH WASTE RISK',    badge: 'bg-red-100 text-red-700 border-red-300',    bar: 'bg-red-500',   score: 100 };
  if (wasteTimeHours <= 6)  return { level: 'MEDIUM', label: 'MEDIUM WASTE RISK',  badge: 'bg-amber-100 text-amber-700 border-amber-300',  bar: 'bg-amber-400', score: 60  };
  return                           { level: 'LOW',    label: 'LOW WASTE RISK',     badge: 'bg-green-100 text-green-700 border-green-300', bar: 'bg-green-500', score: 20  };
}

function MenuItemRow({ item, onRemove, showRemove }) {
  const wasteHours = getWasteHours(item);
  const priority = getPriorityInfo(wasteHours);

  return (
    <div className={`flex items-center gap-3 p-3 rounded-xl border ${
      priority.level === 'HIGH'
        ? 'bg-red-50/50 border-red-100'
        : priority.level === 'MEDIUM'
        ? 'bg-amber-50/50 border-amber-100'
        : 'bg-green-50/50 border-green-100'
    } transition-all`}>
      {/* Priority indicator bar */}
      <div className={`w-1 self-stretch rounded-full ${priority.bar} flex-shrink-0`} />

      {/* Item info */}
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-stone-900 text-sm truncate">{item.name}</p>
        <p className="text-xs text-stone-500 mt-0.5">
          {item.quantity} {item.quantity_unit}
          <span className="ml-2">· spoils in {wasteHours}h</span>
        </p>
      </div>

      {/* Priority badge */}
      <span className={`shrink-0 text-[10px] font-bold px-2 py-1 rounded-full border ${priority.badge} hidden sm:inline-flex items-center`}>
        {priority.level === 'HIGH'   && '🔴 '}
        {priority.level === 'MEDIUM' && '🟡 '}
        {priority.level === 'LOW'    && '🟢 '}
        {priority.label}
      </span>

      {/* Mobile badge (icon only) */}
      <span className={`shrink-0 text-xs font-bold px-1.5 py-1 rounded-full border sm:hidden ${priority.badge}`}>
        {priority.level === 'HIGH' ? '🔴' : priority.level === 'MEDIUM' ? '🟡' : '🟢'}
      </span>

      {showRemove && onRemove && (
        <button
          onClick={() => onRemove(item.id)}
          className="shrink-0 text-stone-400 hover:text-red-500 transition-colors p-1 rounded-lg hover:bg-red-50"
          title="Remove item"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      )}
    </div>
  );
}

export default function MenuList({ items = [], onRemove, showRemove = false, loading = false }) {
  // Filter out any null/undefined entries that can slip in from optimistic updates
  const sorted = [...items].filter(Boolean).sort((a, b) => {
    const pa = getPriorityInfo(getWasteHours(a));
    const pb = getPriorityInfo(getWasteHours(b));
    return pb.score - pa.score;
  });

  const highCount = sorted.filter((i) => getPriorityInfo(getWasteHours(i)).level === 'HIGH').length;
  const medCount  = sorted.filter((i) => getPriorityInfo(getWasteHours(i)).level === 'MEDIUM').length;

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-14 bg-stone-100 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-6 text-stone-400">
        <p className="text-2xl mb-2">🍽️</p>
        <p className="text-sm">No menu items added yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Priority summary */}
      {(highCount > 0 || medCount > 0) && (
        <div className="flex gap-2 mb-3 flex-wrap">
          {highCount > 0 && (
            <span className="text-xs bg-red-100 text-red-700 border border-red-200 px-2.5 py-1 rounded-full font-medium">
              🔴 {highCount} high risk
            </span>
          )}
          {medCount > 0 && (
            <span className="text-xs bg-amber-100 text-amber-700 border border-amber-200 px-2.5 py-1 rounded-full font-medium">
              🟡 {medCount} medium risk
            </span>
          )}
        </div>
      )}

      {sorted.map((item) => (
        <MenuItemRow
          key={item.id || item.name}
          item={item}
          onRemove={onRemove}
          showRemove={showRemove}
        />
      ))}
    </div>
  );
}

