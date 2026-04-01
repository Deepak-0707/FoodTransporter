// services/allocationService.js
// ============================================================
// FoodBridge Phase 3 — Smart Allocation Engine
//
// Implements fair proportional food splitting across NGOs.
// Called on new request, manual trigger, or scheduled interval.
// ============================================================

const pool = require('../config/db');

/**
 * ALLOCATION ALGORITHM
 * --------------------
 * Given N NGO requests for the same event:
 *
 * Case 1 — Total requested ≤ available food:
 *   → Every NGO gets exactly what they asked for. Status = APPROVED.
 *
 * Case 2 — Total requested > available food (scarcity):
 *   → Distribute proportionally:
 *       allocated_i = floor( (requested_i / total_requested) * available )
 *   → Distribute remainder 1-by-1 to NGOs sorted by largest fractional part
 *     (Largest Remainder Method) so no food unit is wasted.
 *   → Ensure minimum 1 unit per NGO if possible.
 *
 * Returns: array of { request_id, ngo_id, allocated_quantity, status }
 *
 * @param {Array} pendingRequests - [{ id, ngo_id, quantity_requested }]
 * @param {number} available      - remaining_quantity on the event
 * @returns {Array}               - allocation results
 */
function computeAllocations(pendingRequests, available) {
  if (!pendingRequests.length || available <= 0) return [];

  const totalRequested = pendingRequests.reduce(
    (sum, r) => sum + r.quantity_requested, 0
  );

  // ─── Case 1: Plenty of food for everyone ────────────────────
  if (totalRequested <= available) {
    return pendingRequests.map((r) => ({
      request_id:         r.id,
      ngo_id:             r.ngo_id,
      allocated_quantity: r.quantity_requested,
      status:             'APPROVED',
    }));
  }

  // ─── Case 2: Scarcity — proportional distribution ───────────
  // Step 2a: Compute exact floating-point share for each request
  const shares = pendingRequests.map((r) => {
    const exact = (r.quantity_requested / totalRequested) * available;
    return {
      request_id:   r.id,
      ngo_id:       r.ngo_id,
      requested:    r.quantity_requested,
      exact,
      floor:        Math.floor(exact),
      fractional:   exact - Math.floor(exact),
    };
  });

  // Step 2b: Sum of floor values — the "leftover" units to distribute
  const totalFloor = shares.reduce((sum, s) => sum + s.floor, 0);
  let remainder     = available - totalFloor; // always 0 ≤ remainder < N

  // Step 2c: Largest Remainder Method — award leftover units to NGOs
  //          with the largest fractional parts (most "shortchanged")
  shares.sort((a, b) => b.fractional - a.fractional);

  const allocations = shares.map((s, idx) => {
    // Give one extra unit to the top `remainder` fractional holders
    const bonus     = idx < remainder ? 1 : 0;
    const allocated = s.floor + bonus;

    return {
      request_id:         s.request_id,
      ngo_id:             s.ngo_id,
      // An NGO gets APPROVED only if they receive at least 1 unit.
      // With extreme scarcity (e.g., 1 kg for 10 NGOs), lower-ranked
      // NGOs may get 0 — those are marked REJECTED instead of APPROVED.
      allocated_quantity: allocated,
      status:             allocated > 0 ? 'APPROVED' : 'REJECTED',
    };
  });

  return allocations;
}

/**
 * runAllocationForEvent
 * ---------------------
 * Fetches all PENDING requests for an event, runs the allocation
 * algorithm, and persists results inside a single PostgreSQL transaction.
 *
 * Uses FOR UPDATE on the event row to prevent concurrent allocation races.
 *
 * @param {string} eventId  - UUID of the event
 * @param {object} pgClient - optional existing pg client (for nested txns)
 * @returns {{ allocated: number, results: Array }}
 */
async function runAllocationForEvent(eventId, pgClient = null) {
  const ownClient = !pgClient;
  const client    = pgClient || (await pool.connect());

  try {
    if (ownClient) await client.query('BEGIN');

    // ── Lock the event row to serialise concurrent allocations ──
    const eventResult = await client.query(
      `SELECT id, title, remaining_quantity, expiry_time
       FROM events
       WHERE id = $1
       FOR UPDATE`,
      [eventId]
    );

    if (!eventResult.rows.length) {
      throw new Error(`Event ${eventId} not found`);
    }

    const event = eventResult.rows[0];

    // ── Fetch all PENDING requests for this event ──────────────
    const reqResult = await client.query(
      `SELECT id, ngo_id, quantity_requested
       FROM requests
       WHERE event_id = $1 AND status = 'PENDING'
       ORDER BY created_at ASC`,   // earlier requests get priority in tie-breaks
      [eventId]
    );

    const pendingRequests = reqResult.rows.map((r) => ({
      ...r,
      quantity_requested: parseInt(r.quantity_requested, 10),
    }));

    const available  = parseInt(event.remaining_quantity, 10);
    const allocations = computeAllocations(pendingRequests, available);

    if (!allocations.length) {
      if (ownClient) await client.query('COMMIT');
      return { allocated: 0, results: [] };
    }

    // ── Persist each allocation result ────────────────────────
    for (const a of allocations) {
      await client.query(
        `UPDATE requests
         SET status             = $1,
             allocated_quantity = $2
         WHERE id = $3`,
        [a.status, a.allocated_quantity, a.request_id]
      );
    }

    // ── Recalculate remaining_quantity on the event ────────────
    // Sum only the APPROVED allocations
    const totalAllocated = allocations
      .filter((a) => a.status === 'APPROVED')
      .reduce((sum, a) => sum + a.allocated_quantity, 0);

    await client.query(
      `UPDATE events
       SET remaining_quantity = remaining_quantity - $1
       WHERE id = $2`,
      [totalAllocated, eventId]
    );

    if (ownClient) await client.query('COMMIT');

    console.log(
      `[Allocation] Event ${eventId}: ${pendingRequests.length} requests, ` +
      `${available} available → ${totalAllocated} allocated`
    );

    return { allocated: totalAllocated, results: allocations };
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
 * Background job: runs allocation for every event that has
 * PENDING requests and hasn't expired yet.
 * Called by the scheduled cron simulation in server.js.
 */
async function runAllocationForAllEvents() {
  try {
    // Find all events with at least one PENDING request and food remaining
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
      try {
        await runAllocationForEvent(eventId);
      } catch (err) {
        // Don't let one failure block others
        console.error(`[CronJob] Allocation failed for event ${eventId}:`, err.message);
      }
    }
  } catch (err) {
    console.error('[CronJob] Error fetching pending events:', err.message);
  }
}

module.exports = { computeAllocations, runAllocationForEvent, runAllocationForAllEvents };
