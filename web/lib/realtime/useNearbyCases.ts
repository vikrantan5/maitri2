"use client";

/**
 * Realtime hook — emergency cases broadcast to a given police station.
 *
 * Listens to `emergencyCases` where `nearbyStationIds` array-contains the
 * station's stationId. This is the primary feed for the station dashboard
 * in the multi-station broadcast architecture:
 *
 *   - When the user fires an SOS, the case is created with `status="broadcasted"`
 *     and `nearbyStationIds=[every approved station within 2km/5km/10km]`.
 *   - Every station whose id is in that array sees the case INSTANTLY here.
 *   - First station to call `acceptCase` (Firestore transaction) wins,
 *     setting `assignedStationId` to itself and `status="assigned"` →
 *     `"dispatched"`.
 *   - Losing stations still see the case but with `assignedStationId !== myStation`
 *     so the UI shows "Already assigned" and disables Accept.
 *
 * Returns `{ cases, loading }` sorted by createdAt desc.
 */

import { useEffect, useState } from "react";
import {
  collection,
  onSnapshot,
  query,
  where,
  type DocumentData,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { EmergencyCase } from "@/lib/firestore/types";

function normalize(id: string, data: DocumentData): EmergencyCase {
  const loc =
    data.location && typeof data.location === "object" ? data.location : null;
  const lat = loc?.lat ?? loc?.latitude ?? data.latitude ?? null;
  const lng = loc?.lng ?? loc?.longitude ?? data.longitude ?? null;
  return {
    id,
    sourceEventId: data.sourceEventId,
    userId: data.userId || data.user_id || "unknown",
    userName: data.userName || data.user_name || "Unknown",
    userPhone: data.userPhone || data.user_phone || "",
    location:
      lat != null && lng != null
        ? { lat: Number(lat), lng: Number(lng) }
        : undefined,
    imageUrl: data.imageUrl || data.image_url || "",
    audioUrl: data.audioUrl || data.audio_url || "",
    status: data.status || "broadcasted",
    priority: data.priority || "high",
    nearbyStationIds: data.nearbyStationIds || [],
    assignedStationId: data.assignedStationId ?? null,
    acceptedByStation: !!data.acceptedByStation,
    assignedOfficers: data.assignedOfficers || [],
    acceptedAt: data.acceptedAt,
    dispatchedAt: data.dispatchedAt,
    resolvedAt: data.resolvedAt,
    notes: data.notes || [],
    createdAt: data.createdAt,
  } as EmergencyCase;
}

export function useNearbyCases(
  stationId: string | undefined,
  options: { activeOnly?: boolean } = {},
) {
  const activeOnly = options.activeOnly !== false;
  const [cases, setCases] = useState<EmergencyCase[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!stationId) {
      setCases([]);
      setLoading(false);
      return;
    }
    console.log(`[useNearbyCases] subscribing for station=${stationId}`);
    const q = query(
      collection(db, "emergencyCases"),
      where("nearbyStationIds", "array-contains", stationId),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => normalize(d.id, d.data()));
        list.sort((a: any, b: any) => {
          const ta = (a.createdAt as any)?.toMillis?.() || 0;
          const tb = (b.createdAt as any)?.toMillis?.() || 0;
          return tb - ta;
        });
        const filtered = activeOnly
          ? list.filter((c) =>
              ["broadcasted", "new", "assigned", "acknowledged", "dispatched", "in_progress", "escalated"].includes(
                c.status,
              ),
            )
          : list;
        setCases(filtered);
        setLoading(false);
        console.log(`[useNearbyCases] station=${stationId} received ${filtered.length} case(s)`);
      },
      (err) => {
        console.warn("[useNearbyCases] listener error", err);
        setLoading(false);
      },
    );
    return () => unsub();
  }, [stationId, activeOnly]);

  return { cases, loading };
}
