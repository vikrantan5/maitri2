"use client";

/**
 * Realtime hook — emergency cases assigned to a specific officer (by uid).
 *
 * Listens to `emergencyCases` documents whose `assignedOfficers` array
 * contains the given officer uid. Used by the /officer dashboard so an
 * officer instantly sees any new SOS dispatched to them by their station.
 *
 * Returns `{ cases, loading }` where `cases` is normalized & sorted by
 * createdAt desc.
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

export function useAssignedCases(officerUid: string | undefined) {
  const [cases, setCases] = useState<EmergencyCase[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!officerUid) {
      setCases([]);
      setLoading(false);
      return;
    }
    const q = query(
      collection(db, "emergencyCases"),
      where("assignedOfficers", "array-contains", officerUid),
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
        setCases(list);
        setLoading(false);
      },
      (err) => {
        console.warn("[useAssignedCases] listener error", err);
        setLoading(false);
      },
    );
    return () => unsub();
  }, [officerUid]);

  return { cases, loading };
}
