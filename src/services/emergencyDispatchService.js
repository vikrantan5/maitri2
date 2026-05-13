import {
  addDoc,
  collection,
  getDocs,
  query,
  serverTimestamp,
  where,
} from 'firebase/firestore';
import { db } from '../config/firebaseConfig';

/**
 * Mobile-side SOS dispatch service.
 *
 * When the user presses SOS the mobile app:
 *   1) Captures evidence (already implemented in sosService.js)
 *   2) Writes /sos_events  (legacy feed)
 *   3) Calls this service to create /emergencyCases with full dispatch
 *      metadata so the nearest station, its verified officers, and the
 *      super-admin panel all receive the case in realtime — without
 *      depending on the web dashboard being open.
 *
 * Why mobile-side and not server-only?
 *   - It works offline-friendly (Firestore SDK queues writes)
 *   - It avoids a backend hop for the critical-path emergency flow
 *   - Firestore rules ensure regular users can only CREATE the
 *     emergencyCases doc (status=\"new\"); only stations/officers/admin
 *     can update or read them later.
 */

const EARTH_RADIUS_KM = 6371;

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
 * Find the nearest approved police station for given coordinates.
 *
 * @param {number} userLat
 * @param {number} userLng
 * @param {Array<{id:string, stationId?:string, status?:string, geo?:{lat:number,lng:number}}>} stations
 * @returns {{ station:object, distanceKm:number } | null}
 */
export function findNearestStation(userLat, userLng, stations) {
  if (typeof userLat !== 'number' || typeof userLng !== 'number') return null;
  let best = null;
  let min = Infinity;
  for (const s of stations) {
    if (!s?.geo || typeof s.geo.lat !== 'number' || typeof s.geo.lng !== 'number') continue;
    if (s.status && s.status !== 'approved') continue;
    const d = haversineKm({ lat: userLat, lng: userLng }, { lat: s.geo.lat, lng: s.geo.lng });
    if (d < min) {
      min = d;
      best = s;
    }
  }
  return best ? { station: best, distanceKm: min } : null;
}

/**
 * Look up the verified officers of the given station.
 * @param {string} stationId
 * @returns {Promise<string[]>} list of officer UIDs
 */
async function fetchApprovedOfficerUids(stationId) {
  try {
    const snap = await getDocs(
      query(
        collection(db, 'policeOfficers'),
        where('stationId', '==', stationId),
        where('status', '==', 'approved'),
      ),
    );
    return snap.docs
      .map((d) => d.data()?.uid)
      .filter((u) => typeof u === 'string' && u.length > 0);
  } catch (e) {
    console.warn('[emergencyDispatch] officer lookup failed (continuing):', e?.code, e?.message);
    return [];
  }
}

/**
 * Fetch all police stations the current user is allowed to read.
 * Falls back to empty if Firestore rejects (we still create the case with
 * `assignedStationId: null` and let an admin manually route it).
 * @returns {Promise<Array<object>>}
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
 *
 * @param {object} params
 * @param {string} params.sourceEventId   /sos_events doc id
 * @param {string} params.userId
 * @param {string} params.userName
 * @param {string} [params.userPhone]
 * @param {{latitude:number,longitude:number}|null} params.location
 * @param {string|null} params.imageUrl
 * @param {string|null} params.audioUrl
 * @returns {Promise<{caseId:string, assignedStationId:string|null, officerCount:number}>}
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

  let assignedStationId = null;
  let assignedOfficers = [];

  if (hasLocation) {
    const stations = await fetchAllStations();
    console.log(`[emergencyDispatch] ${stations.length} stations available`);
    const nearest = findNearestStation(lat, lng, stations);
    if (nearest) {
      assignedStationId = nearest.station.stationId || nearest.station.id;
      console.log(
        `[emergencyDispatch] nearest station ${assignedStationId} @ ${nearest.distanceKm.toFixed(2)}km`,
      );
      if (assignedStationId) {
        assignedOfficers = await fetchApprovedOfficerUids(assignedStationId);
        console.log(
          `[emergencyDispatch] auto-assigning ${assignedOfficers.length} verified officer(s)`,
        );
      }
    } else {
      console.warn('[emergencyDispatch] no approved station found in range');
    }
  } else {
    console.warn('[emergencyDispatch] no location captured — cannot route');
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
    status: 'new',
    priority: 'critical',
    assignedStationId,
    assignedOfficers,
    notes: [],
    createdAt: now,
    dispatchedAt: assignedStationId ? now : null,
  };

  try {
    const ref = await addDoc(collection(db, 'emergencyCases'), caseData);
    console.log('[emergencyDispatch] emergencyCases doc created:', ref.id, {
      assignedStationId,
      officerCount: assignedOfficers.length,
    });
    return {
      caseId: ref.id,
      assignedStationId,
      officerCount: assignedOfficers.length,
    };
  } catch (e) {
    console.error('[emergencyDispatch] FAILED to create emergencyCases doc:', e?.code, e?.message);
    throw e;
  }
}
