// services/priorityService.js — FoodBridge Phase 4

function computeUrgency(expiryTime) {
  const msLeft    = new Date(expiryTime).getTime() - Date.now();
  const hoursLeft = msLeft / 3_600_000;
  let label;
  if (msLeft <= 0)              label = 'EXPIRED';
  else if (hoursLeft < 1)       label = 'CRITICAL';
  else if (hoursLeft < 6)       label = 'HIGH';
  else if (hoursLeft < 24)      label = 'MEDIUM';
  else                          label = 'LOW';
  return { score: msLeft / 1000, label, hoursLeft: parseFloat(hoursLeft.toFixed(2)) };
}

function sortByUrgency(events) {
  return events
    .map((e) => ({ ...e, ...computeUrgency(e.expiry_time) }))
    .sort((a, b) => {
      if (a.score !== b.score) return a.score - b.score;
      return (a.remaining_quantity || 0) - (b.remaining_quantity || 0);
    });
}

// Phase 4: priority_score = 1 / waste_time_minutes
function computeMenuItemPriority(wasteTimeMinutes) {
  if (!wasteTimeMinutes || wasteTimeMinutes <= 0)
    return { priorityScore: 0, urgencyLabel: 'UNKNOWN' };
  const priorityScore = 1 / wasteTimeMinutes;
  let urgencyLabel;
  if (wasteTimeMinutes <= 30)       urgencyLabel = 'CRITICAL';
  else if (wasteTimeMinutes <= 120) urgencyLabel = 'HIGH';
  else if (wasteTimeMinutes <= 360) urgencyLabel = 'MEDIUM';
  else                              urgencyLabel = 'LOW';
  return { priorityScore: parseFloat(priorityScore.toFixed(6)), urgencyLabel };
}

function sortMenuItemsByPriority(items) {
  return [...items].sort((a, b) => parseFloat(b.priority_score) - parseFloat(a.priority_score));
}

function getEventMaxPriority(menuItems) {
  if (!menuItems || !menuItems.length) return 0;
  return Math.max(...menuItems.map((m) => parseFloat(m.priority_score) || 0));
}

module.exports = { computeUrgency, sortByUrgency, computeMenuItemPriority, sortMenuItemsByPriority, getEventMaxPriority };
