"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  limit,
  onSnapshot,
  query,
  where,
  type DocumentData,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { EmergencyCase } from "@/lib/firestore/types";

const ACTIVE = [
  "broadcasted",
  "new",
  "assigned",
  "acknowledged",
  "dispatched",
  "in_progress",
  "escalated",
];

/**
 * Normalize a Firestore emergencyCase document so the UI can rely on a
 * canonical shape. Historic / legacy docs may have:
 *   - location: { latitude, longitude } instead of { lat, lng }
 *   - flat latitude/longitude fields
 *   - missing priority / status / nearbyStationIds (pre-broadcast era)
 */
function normalizeCase(id: string, data: DocumentData): EmergencyCase {
  const loc =
    data.location && typeof data.location === "object" ? data.location : null;
  const lat =
    loc?.lat ?? loc?.latitude ?? data.latitude ?? null;
  const lng =
    loc?.lng ?? loc?.longitude ?? data.longitude ?? null;

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

function dedupeAndSort(rows: EmergencyCase[]): EmergencyCase[] {
  const map = new Map<string, EmergencyCase>();
  for (const r of rows) map.set(r.id, r);
  const list = Array.from(map.values());
  list.sort((a, b) => {
    const ta = (a.createdAt as any)?.toMillis?.() || 0;
    const tb = (b.createdAt as any)?.toMillis?.() || 0;
    return tb - ta;
  });
  return list;
}

/**
 * Realtime emergency cases (multi-station broadcast model).
 *
 *  - `stationId`     — when provided, listens to cases whose
 *                      `nearbyStationIds` array contains that station.
 *                      Covers BOTH still-broadcasting cases and cases the
 *                      station has already won — once a case is locked to
 *                      another station, the listener still receives it so
 *                      the UI can render an "Already assigned" state.
 *  - `activeOnly`    — default true; pass false to load full history.
 *  - `max`           — page size (default 50).
 *
 * For super_admin (no stationId) we listen to the whole collection.
 */
export function useEmergencyCases(scope?: {
  stationId?: string;
  activeOnly?: boolean;
  max?: number;
}) {
  const stationId = scope?.stationId;
  const activeOnly = scope?.activeOnly !== false;
  const max = scope?.max ?? 50;

  const [nearby, setNearby] = useState<EmergencyCase[]>([]);
  const [global, setGlobal] = useState<EmergencyCase[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);

    if (stationId) {
      // Multi-station broadcast: array-contains is a single, indexed query
      // that scales linearly with the size of nearbyStationIds (capped by
      // Firestore at ~10 elements per array-contains; we expect 1–5).
      const qN = query(
        collection(db, "emergencyCases"),
        where("nearbyStationIds", "array-contains", stationId),
        limit(max),
      );
      const unsub = onSnapshot(
        qN,
        (snap) => {
          const list = snap.docs.map((d) => normalizeCase(d.id, d.data()));
          setNearby(list);
          setLoading(false);
          console.log(`[useEmergencyCases] station=${stationId} → ${list.length} broadcasted case(s)`);
        },
        (err) => {
          console.warn("[useEmergencyCases] nearby listener error", err);
          setLoading(false);
        },
      );
      setGlobal(null);
      return () => unsub();
    }

    // Global (super_admin)
    const qG = query(collection(db, "emergencyCases"), limit(max));
    const unsub = onSnapshot(
      qG,
      (snap) => {
        setGlobal(snap.docs.map((d) => normalizeCase(d.id, d.data())));
        setLoading(false);
      },
      (err) => {
        console.warn("[useEmergencyCases] global listener error", err);
        setLoading(false);
      },
    );
    setNearby([]);
    return () => unsub();
  }, [stationId, max]);

  const cases = useMemo(() => {
    const raw = !stationId ? (global ?? []) : nearby;
    const filtered = activeOnly ? raw.filter((c) => ACTIVE.includes(c.status)) : raw;
    return dedupeAndSort(filtered);
  }, [stationId, nearby, global, activeOnly]);

  return { cases, loading };
}

/**
 * Fallback realtime hook — listens to the legacy `sos_events` collection
 * (written by the mobile app) so we always show live SOS even if no
 * `emergencyCases` doc has been created yet.
 */
export function useSosEvents(max = 30) {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, "sos_events"), limit(max));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        list.sort((a: any, b: any) => {
          const ta = a.created_at || a.timestamp || "";
          const tb = b.created_at || b.timestamp || "";
          return String(tb).localeCompare(String(ta));
        });
        setEvents(list.slice(0, max));
        setLoading(false);
      },
      (err) => {
        console.warn("[useSosEvents] listener error", err);
        setLoading(false);
      },
    );
    return () => unsub();
  }, [max]);

  return { events, loading };
}
