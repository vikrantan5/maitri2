/**
 * Geo helpers — haversine + nearest station.
 */
export function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371; // km
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

export function nearestStation<T extends { geo?: { lat: number; lng: number } }>(
  point: { lat: number; lng: number },
  stations: T[],
): T | null {
  let best: T | null = null;
  let min = Infinity;
  for (const s of stations) {
    if (!s.geo) continue;
    const d = haversineKm(point, s.geo);
    if (d < min) {
      min = d;
      best = s;
    }
  }
  return best;
}

export function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}
