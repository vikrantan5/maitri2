"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { PoliceOfficer } from "@/lib/firestore/types";

export function useOfficerRequests(stationId?: string, status?: "pending" | "approved" | "rejected") {
  const [items, setItems] = useState<PoliceOfficer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const base = collection(db, "officerRequests");
    const constraints: any[] = [];
    if (stationId) constraints.push(where("stationId", "==", stationId));
    if (status) constraints.push(where("status", "==", status));
    const q = constraints.length ? query(base, ...constraints) : query(base);

    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<PoliceOfficer, "id">) }));
        list.sort((a: any, b: any) => {
          const ta = a.createdAt?.toMillis?.() || 0;
          const tb = b.createdAt?.toMillis?.() || 0;
          return tb - ta;
        });
        setItems(list);
        setLoading(false);
      },
      () => setLoading(false),
    );
    return () => unsub();
  }, [stationId, status]);

  return { items, loading };
}
