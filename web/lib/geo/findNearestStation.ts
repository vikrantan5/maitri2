/**
 * Nearest station finder (Saheli SOS dispatch).
 *
 * Pure function — given a user location and a list of approved police
 * stations (each with a `geo: { lat, lng }`), returns the closest one
 * by Haversine great-circle distance. Returns null if the input is
 * empty or no station has a valid geo.
 *
 * Used by:
 *   - web/lib/firestore/cases.ts   → ensureCaseFromSosEvent (server-side promote)
 *   - mobile src/services/emergencyDispatchService.js (re-implemented in JS)
 */

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface StationLike {
  id?: string;
  stationId?: string;
  name?: string;
  status?: string;
  geo?: GeoPoint | null;
}

export interface NearestResult<T extends StationLike> {
  station: T;
  distanceKm: number;
}

const EARTH_RADIUS_KM = 6371;

export function haversineKm(a: GeoPoint, b: GeoPoint): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
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
 * Returns the closest *approved* station to the given user location.
 * If `restrictApproved` is true (default), stations whose status is not
 * "approved" are filtered out.
 */
export function findNearestStation<T extends StationLike>(
  userLat: number,
  userLng: number,
  stations: T[],
  options: { restrictApproved?: boolean } = {},
): NearestResult<T> | null {
  if (
    typeof userLat !== "number" ||
    typeof userLng !== "number" ||
    Number.isNaN(userLat) ||
    Number.isNaN(userLng)
  ) {
    return null;
  }
  const restrictApproved = options.restrictApproved !== false;
  const user: GeoPoint = { lat: userLat, lng: userLng };

  let best: T | null = null;
  let minDist = Infinity;

  for (const s of stations) {
    if (!s?.geo) continue;
    if (
      typeof s.geo.lat !== "number" ||
      typeof s.geo.lng !== "number" ||
      Number.isNaN(s.geo.lat) ||
      Number.isNaN(s.geo.lng)
    ) {
      continue;
    }
    if (restrictApproved && s.status && s.status !== "approved") continue;

    const d = haversineKm(user, { lat: s.geo.lat, lng: s.geo.lng });
    if (d < minDist) {
      minDist = d;
      best = s;
    }
  }

  if (!best) return null;
  return { station: best, distanceKm: minDist };
}

export function formatDistance(km: number): string {
  if (!isFinite(km)) return "—";
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}
