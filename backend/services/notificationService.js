// services/notificationService.js
// ============================================================
// FoodBridge Phase 4 — Intelligent Notification Service
//
// ALGORITHM:
//  1. Find all NGO/ASHRAM users who have saved location within radius
//  2. For each candidate compute composite score:
//       score = (DISTANCE_WEIGHT * distance_km) + (URGENCY_WEIGHT * (1/priority_score))
//     Lower score = higher priority to notify
//  3. Sort ascending by score
//  4. Insert notification rows + emit Socket.io event to user rooms
//
// Weights are tunable via env vars (defaults provided).
// ============================================================

const pool                   = require('../config/db');
const { haversineDistance }  = require('./distanceService');
const { emitNewNotification } = require('../realtime/socket');

// Tunable weights (lower score = notify first)
const DISTANCE_WEIGHT = parseFloat(process.env.NOTIFY_DISTANCE_WEIGHT) || 0.6;
const URGENCY_WEIGHT  = parseFloat(process.env.NOTIFY_URGENCY_WEIGHT)  || 0.4;

// Default search radius if not specified
const DEFAULT_RADIUS_KM = parseFloat(process.env.NOTIFY_RADIUS_KM) || 20;

/**
 * computeNotificationScore
 * ------------------------
 * Composite score used to rank which users to notify first.
 * Lower score = higher priority.
 *
 * @param {number} distanceKm     - haversine distance between user and event
 * @param {number} priorityScore  - menu item priority (1/waste_time_minutes)
 * @returns {number} composite score
 */
function computeNotificationScore(distanceKm, priorityScore) {
  // Invert priorityScore: high priority (high score) → low urgency penalty
  // Guard against zero priority_score edge case
  const urgencyPenalty = priorityScore > 0 ? 1 / priorityScore : 9999;
  return (DISTANCE_WEIGHT * distanceKm) + (URGENCY_WEIGHT * urgencyPenalty);
}

/**
 * sendNotificationsForEvent
 * -------------------------
 * Core notification dispatcher. Called when:
 *   - A new event is created
 *   - A menu item reaches CRITICAL priority
 *   - Manual trigger from POST /notifications/send
 *
 * @param {object} options
 * @param {string} options.eventId       - event UUID
 * @param {string} options.message       - notification text
 * @param {number} [options.radiusKm]    - search radius (default 20km)
 * @param {number} [options.topN]        - max users to notify (default all in radius)
 * @returns {Promise<{ notified: number, recipients: Array }>}
 */
async function sendNotificationsForEvent({ eventId, message, radiusKm = DEFAULT_RADIUS_KM, topN = null }) {
  // ── Fetch event location + highest priority menu item ────────
  const eventResult = await pool.query(
    `SELECT e.id, e.latitude, e.longitude, e.title,
            COALESCE(MIN(m.waste_time_minutes), 240) AS min_waste_minutes
     FROM events e
     LEFT JOIN menu_items m ON m.event_id = e.id
     WHERE e.id = $1
     GROUP BY e.id`,
    [eventId]
  );

  if (!eventResult.rows.length) {
    throw new Error(`Event ${eventId} not found`);
  }

  const event = eventResult.rows[0];
  const eventLat = parseFloat(event.latitude);
  const eventLng = parseFloat(event.longitude);
  const minWaste = parseFloat(event.min_waste_minutes) || 240;

  // ── Fetch all NGO + ASHRAM users who have set their location ─
  const usersResult = await pool.query(
    `SELECT id, name, email, latitude, longitude
     FROM users
     WHERE role IN ('NGO', 'ASHRAM')
       AND latitude IS NOT NULL
       AND longitude IS NOT NULL`
  );

  if (!usersResult.rows.length) {
    console.log(`[NotificationService] No location-aware NGO/ASHRAM users found`);
    return { notified: 0, recipients: [] };
  }

  // ── Score + filter by radius ─────────────────────────────────
  const maxPriority = minWaste > 0 ? 1 / minWaste : 0.001;

  const candidates = usersResult.rows
    .map((user) => {
      const distKm = haversineDistance(
        parseFloat(user.latitude),
        parseFloat(user.longitude),
        eventLat,
        eventLng
      );
      const score = computeNotificationScore(distKm, maxPriority);
      return { ...user, distance_km: parseFloat(distKm.toFixed(2)), score };
    })
    .filter((u) => u.distance_km <= radiusKm)
    // Sort ascending: lower score = notify first
    .sort((a, b) => a.score - b.score);

  // Optionally cap at topN
  const targets = topN ? candidates.slice(0, topN) : candidates;

  if (!targets.length) {
    console.log(`[NotificationService] No users within ${radiusKm}km of event ${eventId}`);
    return { notified: 0, recipients: [] };
  }

  // ── Bulk insert notifications + emit realtime events ─────────
  const insertedNotifications = [];

  for (const user of targets) {
    // Insert notification row
    const result = await pool.query(
      `INSERT INTO notifications (user_id, event_id, message, read_status)
       VALUES ($1, $2, $3, FALSE)
       RETURNING *`,
      [user.id, eventId, message]
    );
    const notification = result.rows[0];
    insertedNotifications.push({ ...notification, user_name: user.name, distance_km: user.distance_km });

    // Emit realtime event to user's private room
    try {
      emitNewNotification(user.id, notification);
    } catch (socketErr) {
      // Socket.io may not be initialised in test environments — non-fatal
      console.warn(`[NotificationService] Socket emit failed for user ${user.id}: ${socketErr.message}`);
    }
  }

  console.log(
    `[NotificationService] Event "${event.title}": notified ${targets.length} users ` +
    `within ${radiusKm}km (sorted by composite score)`
  );

  return { notified: targets.length, recipients: insertedNotifications };
}

/**
 * sendUrgentFoodAlert
 * -------------------
 * Called automatically when a menu item's waste_time_minutes
 * indicates CRITICAL urgency (< 60 min). Triggers notification
 * for the parent event with an urgency-aware message.
 *
 * @param {object} menuItem - full menu_item row
 * @param {string} eventTitle
 */
async function sendUrgentFoodAlert(menuItem, eventTitle) {
  const message =
    `URGENT: "${menuItem.name}" at event "${eventTitle}" expires in ` +
    `${menuItem.waste_time_minutes} minutes! Priority score: ${parseFloat(menuItem.priority_score).toFixed(4)}`;

  return sendNotificationsForEvent({
    eventId: menuItem.event_id,
    message,
    radiusKm: DEFAULT_RADIUS_KM,
  });
}

module.exports = { sendNotificationsForEvent, sendUrgentFoodAlert, computeNotificationScore };
