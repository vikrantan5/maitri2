/**
 * Multi-station nearby finder (Saheli SOS broadcast).
 *
 * Returns ALL approved police stations within a given radius of the user's
 * location — used by the first-accept dispatch flow. Falls back through
 * 2km → 5km → 10km radii so that an SOS in a sparse area still reaches at
 * least one station.
 *
 * Used by:
 *   - web/lib/firestore/cases.ts                     → ensureCaseFromSosEvent
 *   - mobile src/services/emergencyDispatchService.js (re-implemented in JS)
 */

import { haversineKm, type GeoPoint, type StationLike } from "./findNearestStation";

export const PRIMARY_RADIUS_KM = 2;
export const FALLBACK_RADII_KM = [2, 5, 10] as const;

export interface NearbyHit<T extends StationLike> {
  station: T;
  distanceKm: number;
}

/**
 * Return every approved station whose `geo` lies inside `radiusKm` of the
 * user. Stations missing `geo` or with status != "approved" are skipped.
 * Result is sorted by ascending distance.
 */
export function findStationsWithinRadius<T extends StationLike>(
  userLat: number,
  userLng: number,
  stations: T[],
  radiusKm: number,
  options: { restrictApproved?: boolean } = {},
): NearbyHit<T>[] {
  if (
    typeof userLat !== "number" ||
    typeof userLng !== "number" ||
    Number.isNaN(userLat) ||
    Number.isNaN(userLng)
  ) {
    return [];
  }
  const restrictApproved = options.restrictApproved !== false;
  const user: GeoPoint = { lat: userLat, lng: userLng };

  const hits: NearbyHit<T>[] = [];
  for (const s of stations) {
    if (!s?.geo) continue;
    if (
      typeof s.geo.lat !== "number" ||
      typeof s.geo.lng !== "number" ||
      Number.isNaN(s.geo.lat) ||
      Number.isNaN(s.geo.lng)
    ) continue;
    if (restrictApproved && s.status && s.status !== "approved") continue;

    const d = haversineKm(user, { lat: s.geo.lat, lng: s.geo.lng });
    if (d <= radiusKm) hits.push({ station: s, distanceKm: d });
  }
  hits.sort((a, b) => a.distanceKm - b.distanceKm);
  return hits;
}

/**
 * Broadcast finder. Tries successive radii (2 → 5 → 10 km) and returns the
 * FIRST non-empty bucket. If no station is found within 10km, returns the
 * single nearest station (so the case is at least routable) wrapped as a
 * one-element array — or an empty array if no stations have geo at all.
 */
export function findBroadcastStations<T extends StationLike>(
  userLat: number,
  userLng: number,
  stations: T[],
  options: { restrictApproved?: boolean; radii?: readonly number[] } = {},
): { hits: NearbyHit<T>[]; radiusKmUsed: number | null } {
  const radii = options.radii ?? FALLBACK_RADII_KM;
  for (const r of radii) {
    const hits = findStationsWithinRadius(userLat, userLng, stations, r, options);
    if (hits.length > 0) {
      return { hits, radiusKmUsed: r };
    }
  }
  // Last-resort: pick the single closest approved station — better than nothing.
  const all = findStationsWithinRadius(userLat, userLng, stations, Number.POSITIVE_INFINITY, options);
  if (all.length > 0) return { hits: [all[0]], radiusKmUsed: all[0].distanceKm };
  return { hits: [], radiusKmUsed: null };
}
