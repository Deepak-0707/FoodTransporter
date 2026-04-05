// services/allocationService.js
// ============================================================
// FoodBridge Phase 4 — Smart Allocation Engine (upgraded)
//
// Phase 4 upgrade: allocation weight now factors in:
//   - NGO distance to event (closer NGOs weighted higher)
//   - Food priority_score from menu_items (higher urgency = weight more)
//
// ALLOCATION WEIGHT per NGO:
//   weight_i = (1 / distance_km) * max_priority_score
//
// Proportional share:
//   allocated_i = floor( (weight_i / total_weight) * available )
//
// Remainder distributed via Largest Remainder Method (unchanged).
// Falls back to proportional-by-requested-qty if no location data.
// ============================================================

const pool                    = require('../config/db');
const { haversineDistance }   = require('./distanceService');
const { emitAllocationUpdate } = require('../realtime/socket');

/**
 * computeSmartAllocations
 * -----------------------
 * Phase 4 weight-based allocation.
 *
 * @param {Array}  pendingRequests - [{ id, ngo_id, quantity_requested, lat, lng }]
 * @param {number} available       - event remaining_quantity
 * @param {number} eventLat        - event latitude
 * @param {number} eventLng        - event longitude
 * @param {number} maxPriority     - max priority_score across all menu items
 * @returns {Array}                - [{ request_id, ngo_id, allocated_quantity, status }]
 */
function computeSmartAllocations(pendingRequests, available, eventLat, eventLng, maxPriority) {
  if (!pendingRequests.length || available <= 0) return [];

  const totalRequested = pendingRequests.reduce((s, r) => s + r.quantity_requested, 0);

  // ── Case 1: Enough food for everyone ─────────────────────────
  if (totalRequested <= available) {
    return pendingRequests.map((r) => ({
      request_id: r.id, ngo_id: r.ngo_id,
      allocated_quantity: r.quantity_requested, status: 'APPROVED',
    }));
  }

  // ── Case 2: Scarcity — distance + priority weighted allocation ─
  const safePriority = maxPriority > 0 ? maxPriority : 0.001;

  const shares = pendingRequests.map((r) => {
    // Use distance-based weight if NGO has location, else fall back to request size
    let weight;
    if (r.lat && r.lng && eventLat && eventLng) {
      const dist = haversineDistance(parseFloat(r.lat), parseFloat(r.lng), eventLat, eventLng);
      // Avoid division by zero for co-located NGO
      const safeDist = dist < 0.01 ? 0.01 : dist;
      // weight = (1/distance) * priority_score — closer + higher priority = larger share
      weight = (1 / safeDist) * safePriority;
    } else {
      // Fallback: weight proportional to quantity_requested
      weight = r.quantity_requested;
    }

    return { ...r, weight };
  });

  const totalWeight = shares.reduce((s, r) => s + r.weight, 0);

  // Compute exact floating-point share proportional to weight
  const withShares = shares.map((r) => {
    const exact = (r.weight / totalWeight) * available;
    return { ...r, exact, floor: Math.floor(exact), fractional: exact - Math.floor(exact) };
  });

  // Largest Remainder Method for integer remainder units
  const totalFloor = withShares.reduce((s, r) => s + r.floor, 0);
  let remainder    = available - totalFloor;

  withShares.sort((a, b) => b.fractional - a.fractional);

  return withShares.map((r, idx) => {
    const bonus     = idx < remainder ? 1 : 0;
    const allocated = r.floor + bonus;
    return {
      request_id: r.id, ngo_id: r.ngo_id,
      allocated_quantity: allocated,
      status: allocated > 0 ? 'APPROVED' : 'REJECTED',
    };
  });
}

/**
 * runAllocationForEvent
 * ---------------------
 * Fetches pending requests with NGO location, runs smart allocation,
 * persists results inside a PostgreSQL transaction, emits Socket.io event.
 *
 * Uses FOR UPDATE on the event row to prevent race conditions.
 *
 * @param {string} eventId
 * @param {object} [pgClient] - optional existing client for nested transactions
 */
async function runAllocationForEvent(eventId, pgClient = null) {
  const ownClient = !pgClient;
  const client    = pgClient || (await pool.connect());

  try {
    if (ownClient) await client.query('BEGIN');

    // Lock event row to serialise concurrent allocations
    const eventResult = await client.query(
      `SELECT id, title, remaining_quantity, expiry_time, latitude, longitude
       FROM events WHERE id = $1 FOR UPDATE`,
      [eventId]
    );

    if (!eventResult.rows.length) throw new Error(`Event ${eventId} not found`);

    const event    = eventResult.rows[0];
    const eventLat = parseFloat(event.latitude);
    const eventLng = parseFloat(event.longitude);
    const available = parseInt(event.remaining_quantity, 10);

    // Fetch PENDING requests, JOIN users for location data
    const reqResult = await client.query(
      `SELECT r.id, r.ngo_id, r.quantity_requested,
              u.latitude AS lat, u.longitude AS lng
       FROM requests r
       JOIN users u ON u.id = r.ngo_id
       WHERE r.event_id = $1 AND r.status = 'PENDING'
       ORDER BY r.created_at ASC`,
      [eventId]
    );

    const pendingRequests = reqResult.rows.map((r) => ({
      ...r, quantity_requested: parseInt(r.quantity_requested, 10),
    }));

    // Compute max priority from waste_time_minutes (lower = higher priority)
    // priority = 1 / waste_time_minutes, guarded against null/zero
    const priorityResult = await client.query(
      `SELECT COALESCE(MIN(waste_time_minutes), 0) AS min_waste
       FROM menu_items WHERE event_id = $1`,
      [eventId]
    );
    const minWaste = parseFloat(priorityResult.rows[0]?.min_waste) || 240;
    const maxPriority = minWaste > 0 ? 1 / minWaste : 0.001;

    const allocations = computeSmartAllocations(pendingRequests, available, eventLat, eventLng, maxPriority);

    if (!allocations.length) {
      if (ownClient) await client.query('COMMIT');
      return { allocated: 0, results: [] };
    }

    // Persist allocation results
    for (const a of allocations) {
      await client.query(
        `UPDATE requests SET status = $1, allocated_quantity = $2 WHERE id = $3`,
        [a.status, a.allocated_quantity, a.request_id]
      );
    }

    // Deduct total allocated from event remaining_quantity
    const totalAllocated = allocations
      .filter((a) => a.status === 'APPROVED')
      .reduce((s, a) => s + a.allocated_quantity, 0);

    await client.query(
      `UPDATE events SET remaining_quantity = remaining_quantity - $1 WHERE id = $2`,
      [totalAllocated, eventId]
    );

    if (ownClient) await client.query('COMMIT');

    const result = { allocated: totalAllocated, results: allocations };

    console.log(
      `[Allocation] Event ${eventId}: ${pendingRequests.length} requests, ` +
      `${available} available → ${totalAllocated} allocated (smart weights)`
    );

    // Emit realtime update to event room (non-fatal if socket not ready)
    try { emitAllocationUpdate(eventId, result); }
    catch (e) { console.warn('[Allocation] Socket emit failed:', e.message); }

    return result;
  } catch (err) {
    if (ownClient) await client.query('ROLLBACK');
    throw err;
  } finally {
    if (ownClient) client.release();
  }
}

/**
 * runAllocationForAllEvents
 * -------------------------
 * Background cron: allocate all events with pending requests.
 */
async function runAllocationForAllEvents() {
  const result = await pool.query(
    `SELECT DISTINCT r.event_id
     FROM requests r
     JOIN events e ON e.id = r.event_id
     WHERE r.status = 'PENDING'
       AND e.remaining_quantity > 0
       AND e.expiry_time > NOW()`
  );

  const eventIds = result.rows.map((r) => r.event_id);
  console.log(`[CronJob] Running allocation for ${eventIds.length} event(s)`);

  for (const eventId of eventIds) {
    try { await runAllocationForEvent(eventId); }
    catch (err) { console.error(`[CronJob] Failed for event ${eventId}:`, err.message); }
  }
}

module.exports = { computeSmartAllocations, runAllocationForEvent, runAllocationForAllEvents };
