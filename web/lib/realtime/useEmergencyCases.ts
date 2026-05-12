"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
  type QueryConstraint,
  type DocumentData,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { EmergencyCase } from "@/lib/firestore/types";

const ACTIVE = ["new", "acknowledged", "dispatched", "in_progress", "escalated"];

/**
 * Normalize a Firestore emergencyCase document so the UI can rely on a
 * canonical shape. Historic / legacy docs may have:
 *   - location: { latitude, longitude } instead of { lat, lng }
 *   - flat latitude/longitude fields
 *   - missing priority / status
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
    status: data.status || "new",
    priority: data.priority || "high",
    assignedStationId: data.assignedStationId ?? undefined,
    assignedOfficers: data.assignedOfficers || [],
    acceptedAt: data.acceptedAt,
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
 * Realtime emergency cases.
 *
 *  - `stationId`     — limit to that station + unassigned (null) cases so the
 *                      station OIC sees brand-new SOS that hasn't been routed yet
 *  - `activeOnly`    — default true; pass false to load history (all statuses)
 *  - `max`           — page size per shard (default 50)
 *
 * The hook spins up TWO snapshot listeners when a stationId is provided
 * (assigned-to-me + unassigned) and merges + dedupes them, because Firestore
 * does not support an `OR` of equality filters in a single query without
 * composite indexes on a synthetic field.
 */
export function useEmergencyCases(scope?: {
  stationId?: string;
  activeOnly?: boolean;
  max?: number;
}) {
  const stationId = scope?.stationId;
  const activeOnly = scope?.activeOnly !== false;
  const max = scope?.max ?? 50;

  const [byStation, setByStation] = useState<EmergencyCase[]>([]);
  const [unassigned, setUnassigned] = useState<EmergencyCase[]>([]);
  const [global, setGlobal] = useState<EmergencyCase[] | null>(null);
  const [loading, setLoading] = useState(true);

  // Listener: assigned to my station (or global when no stationId given)
  useEffect(() => {
    setLoading(true);

    const baseConstraints: QueryConstraint[] = [];
    if (activeOnly) baseConstraints.push(where("status", "in", ACTIVE));

    if (stationId) {
      // -- Listener A: cases assigned to MY station
      const qA = query(
        collection(db, "emergencyCases"),
        ...baseConstraints,
        where("assignedStationId", "==", stationId),
        orderBy("createdAt", "desc"),
        limit(max),
      );
      const unsubA = onSnapshot(
        qA,
        (snap) => {
          setByStation(snap.docs.map((d) => normalizeCase(d.id, d.data())));
          setLoading(false);
        },
        (err) => {
          console.warn("[useEmergencyCases] station listener error", err);
          setLoading(false);
        },
      );

      // -- Listener B: brand-new / unassigned cases (null assignedStationId)
      const qB = query(
        collection(db, "emergencyCases"),
        ...baseConstraints,
        where("assignedStationId", "==", null),
        orderBy("createdAt", "desc"),
        limit(max),
      );
      const unsubB = onSnapshot(
        qB,
        (snap) => {
          setUnassigned(snap.docs.map((d) => normalizeCase(d.id, d.data())));
        },
        (err) => {
          console.warn("[useEmergencyCases] unassigned listener error", err);
        },
      );

      setGlobal(null);
      return () => {
        unsubA();
        unsubB();
      };
    }

    // -- Global listener (super_admin, no station filter)
    const qG = query(
      collection(db, "emergencyCases"),
      ...baseConstraints,
      orderBy("createdAt", "desc"),
      limit(max),
    );
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
    setByStation([]);
    setUnassigned([]);
    return () => unsub();
  }, [stationId, activeOnly, max]);

  const cases = useMemo(() => {
    if (!stationId) return global ?? [];
    return dedupeAndSort([...byStation, ...unassigned]);
  }, [stationId, byStation, unassigned, global]);

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
    // sos_events have `created_at` (ISO string) — order client-side after fetch
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
