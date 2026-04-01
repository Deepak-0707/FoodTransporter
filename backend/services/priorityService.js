// services/priorityService.js
// ============================================================
// FoodBridge Phase 3 — Priority Engine
//
// Computes urgency scores for events based on proximity to expiry.
// Events closest to expiry get the highest urgency score.
// ============================================================

/**
 * URGENCY SCORE DEFINITION
 * ------------------------
 * urgency_score = seconds until expiry
 *   → Lower score = MORE urgent (expires sooner)
 *   → Negative score = already expired
 *
 * Urgency labels:
 *   CRITICAL : expires in < 1 hour
 *   HIGH     : expires in < 6 hours
 *   MEDIUM   : expires in < 24 hours
 *   LOW      : expires in ≥ 24 hours
 *   EXPIRED  : already past expiry_time
 *
 * @param {string|Date} expiryTime
 * @returns {{ score: number, label: string, hoursLeft: number }}
 */
function computeUrgency(expiryTime) {
  const now        = Date.now();
  const expiry     = new Date(expiryTime).getTime();
  const msLeft     = expiry - now;
  const secondsLeft = msLeft / 1000;
  const hoursLeft   = msLeft / 3_600_000;

  let label;
  if (msLeft <= 0)              label = 'EXPIRED';
  else if (hoursLeft < 1)       label = 'CRITICAL';
  else if (hoursLeft < 6)       label = 'HIGH';
  else if (hoursLeft < 24)      label = 'MEDIUM';
  else                          label = 'LOW';

  return {
    score:     secondsLeft,   // lower = more urgent
    label,
    hoursLeft: parseFloat(hoursLeft.toFixed(2)),
  };
}

/**
 * sortByUrgency
 * -------------
 * Sorts an array of event objects by urgency (most urgent first).
 * Events with the same expiry are sub-sorted by remaining_quantity ASC
 * (less food = more critical to distribute quickly).
 *
 * @param {Array} events
 * @returns {Array} sorted events with urgency fields attached
 */
function sortByUrgency(events) {
  return events
    .map((e) => ({
      ...e,
      ...computeUrgency(e.expiry_time),
    }))
    .sort((a, b) => {
      // Primary: urgency score ascending (closer to expiry first)
      if (a.score !== b.score) return a.score - b.score;
      // Secondary: less remaining food first
      return (a.remaining_quantity || 0) - (b.remaining_quantity || 0);
    });
}

module.exports = { computeUrgency, sortByUrgency };
