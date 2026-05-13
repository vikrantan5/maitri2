"use client";

/**
 * Convenience wrapper around `useEmergencyCases` that locks the scope to a
 * specific police station. Returns realtime cases assigned to that station
 * (including brand-new / unassigned cases routed via the Haversine nearest-
 * station dispatch in `lib/firestore/cases.ts`).
 *
 * Example:
 *   const { cases, loading } = useStationCases("MH-MUM-9X3KL");
 *
 * Underneath it spins up two `onSnapshot` listeners (cases-for-my-station +
 * cases-with-null-station) and merges them — see `useEmergencyCases` for
 * the full implementation.
 */

import { useEmergencyCases } from "./useEmergencyCases";

export function useStationCases(
  stationId: string | undefined,
  options: { activeOnly?: boolean; max?: number } = {},
) {
  return useEmergencyCases({
    stationId,
    activeOnly: options.activeOnly,
    max: options.max,
  });
}
