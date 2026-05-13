import {
  addDoc,
  collection,
  getDocs,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../config/firebaseConfig';

/**
 * Mobile-side SOS dispatch service — MULTI-STATION BROADCAST.
 *
 * When the user presses SOS the mobile app:
 *   1) Captures evidence (already implemented in sosService.js)
 *   2) Writes /sos_events  (legacy feed)
 *   3) Calls this service to create /emergencyCases with broadcast
 *      metadata. ALL approved police stations within 2km (with fallback
 *      to 5km then 10km) get the case in their realtime feed. The first
 *      station to accept wins ownership and auto-dispatches its officers
 *      via the web `acceptCase` Firestore transaction.
 *
 * Why mobile-side and not server-only?
 *   - It works offline-friendly (Firestore SDK queues writes)
 *   - It avoids a backend hop for the critical-path emergency flow
 *   - Firestore rules let any user CREATE the doc (status=\\"broadcasted\\")
 *     but only stations/officers/admin can read/update it.
 */

const EARTH_RADIUS_KM = 6371;
const FALLBACK_RADII_KM = [2, 5, 10];

function toRad(d) {
  return (d * Math.PI) / 180;
}

export function haversineKm(a, b) {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(x));
}

/**
 * Find all approved stations within `radiusKm` of (userLat, userLng).
 * Returns [{ station, distanceKm }, ...] sorted by ascending distance.
 */
export function findStationsWithinRadius(userLat, userLng, stations, radiusKm) {
  if (typeof userLat !== 'number' || typeof userLng !== 'number') return [];
  const out = [];
  for (const s of stations) {
    if (!s?.geo || typeof s.geo.lat !== 'number' || typeof s.geo.lng !== 'number') continue;
    if (s.status && s.status !== 'approved') continue;
    const d = haversineKm({ lat: userLat, lng: userLng }, { lat: s.geo.lat, lng: s.geo.lng });
    if (d <= radiusKm) out.push({ station: s, distanceKm: d });
  }
  out.sort((a, b) => a.distanceKm - b.distanceKm);
  return out;
}

/**
 * Broadcast finder. Tries 2km → 5km → 10km in succession and returns the
 * FIRST non-empty bucket. If none found, returns the single nearest
 * station so the SOS is at least routable.
 */
export function findBroadcastStations(userLat, userLng, stations) {
  for (const r of FALLBACK_RADII_KM) {
    const hits = findStationsWithinRadius(userLat, userLng, stations, r);
    if (hits.length > 0) return { hits, radiusKmUsed: r };
  }
  const all = findStationsWithinRadius(userLat, userLng, stations, Number.POSITIVE_INFINITY);
  if (all.length > 0) return { hits: [all[0]], radiusKmUsed: all[0].distanceKm };
  return { hits: [], radiusKmUsed: null };
}

/**
 * Legacy single-station finder, kept exported for backward-compat.
 */
export function findNearestStation(userLat, userLng, stations) {
  const all = findStationsWithinRadius(userLat, userLng, stations, Number.POSITIVE_INFINITY);
  return all.length > 0 ? all[0] : null;
}

/**
 * Fetch all police stations the current user is allowed to read.
 */
async function fetchAllStations() {
  try {
    const snap = await getDocs(collection(db, 'policeStations'));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (e) {
    console.warn('[emergencyDispatch] station list failed:', e?.code, e?.message);
    return [];
  }
}

/**
 * Build & persist an /emergencyCases doc that fully describes a fresh SOS.
 * The doc is created with status=\"broadcasted\" and nearbyStationIds set —
 * every station in that array sees the case in realtime and may race to
 * Accept. The first acceptor wins (Firestore transaction in the web
 * `acceptCase`).
 *
 * @param {object} params
 * @param {string} params.sourceEventId
 * @param {string} params.userId
 * @param {string} params.userName
 * @param {string} [params.userPhone]
 * @param {{latitude:number,longitude:number}|null} params.location
 * @param {string|null} params.imageUrl
 * @param {string|null} params.audioUrl
 * @returns {Promise<{caseId:string, nearbyStationIds:string[], radiusKmUsed:number|null}>}
 */
export async function dispatchEmergencyCase({
  sourceEventId,
  userId,
  userName,
  userPhone,
  location,
  imageUrl,
  audioUrl,
}) {
  const lat = location?.latitude;
  const lng = location?.longitude;
  const hasLocation = typeof lat === 'number' && typeof lng === 'number';

  let nearbyStationIds = [];
  let radiusKmUsed = null;

  if (hasLocation) {
    const stations = await fetchAllStations();
    console.log(`[emergencyDispatch] ${stations.length} stations available`);
    const result = findBroadcastStations(lat, lng, stations);
    radiusKmUsed = result.radiusKmUsed;
    nearbyStationIds = result.hits
      .map((h) => h.station.stationId || h.station.id)
      .filter((s) => typeof s === 'string' && s.length > 0);

    console.log(
      `[emergencyDispatch] broadcasting to ${nearbyStationIds.length} station(s) within ${radiusKmUsed ?? '?'}km`,
      nearbyStationIds,
    );
  } else {
    console.warn('[emergencyDispatch] no location captured — case will be unrouted (admin-only)');
  }

  const now = serverTimestamp();
  const caseData = {
    sourceEventId: sourceEventId || null,
    userId: userId || 'unknown',
    userName: userName || 'Unknown',
    userPhone: userPhone || '',
    location: hasLocation ? { lat: Number(lat), lng: Number(lng) } : null,
    imageUrl: imageUrl || '',
    audioUrl: audioUrl || '',
    evidence: {
      image: imageUrl || '',
      audio: audioUrl || '',
      uploadedAt: now,
    },
    status: 'broadcasted',
    priority: 'critical',
    nearbyStationIds,
    radiusKmUsed,
    assignedStationId: null,
    assignedOfficers: [],
    acceptedByStation: false,
    notes: [],
    createdAt: now,
    dispatchedAt: null,
  };

  try {
    const ref = await addDoc(collection(db, 'emergencyCases'), caseData);
    console.log('[emergencyDispatch] emergencyCases doc created:', ref.id, {
      nearbyStationIds,
      radiusKmUsed,
    });
    return {
      caseId: ref.id,
      nearbyStationIds,
      radiusKmUsed,
    };
  } catch (e) {
    console.error('[emergencyDispatch] FAILED to create emergencyCases doc:', e?.code, e?.message);
    throw e;
  }
}
