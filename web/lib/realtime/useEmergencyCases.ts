"use client";

import { useEffect, useState } from "react";
import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
  type QueryConstraint,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { EmergencyCase } from "@/lib/firestore/types";

const ACTIVE = ["new", "acknowledged", "dispatched", "in_progress", "escalated"];

export function useEmergencyCases(scope?: { stationId?: string; activeOnly?: boolean; max?: number }) {
  const [cases, setCases] = useState<EmergencyCase[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const constraints: QueryConstraint[] = [];

    if (scope?.activeOnly !== false) {
      constraints.push(where("status", "in", ACTIVE));
    }
    if (scope?.stationId) {
      constraints.push(where("assignedStationId", "==", scope.stationId));
    }
    constraints.push(orderBy("createdAt", "desc"));
    constraints.push(limit(scope?.max ?? 50));

    const q = query(collection(db, "emergencyCases"), ...constraints);
    const unsub = onSnapshot(
      q,
      (snap) => {
        setCases(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<EmergencyCase, "id">) })),
        );
        setLoading(false);
      },
      () => setLoading(false),
    );
    return () => unsub();
  }, [scope?.stationId, scope?.activeOnly, scope?.max]);

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
      () => setLoading(false),
    );
    return () => unsub();
  }, [max]);

  return { events, loading };
}
