"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { PoliceStation } from "@/lib/firestore/types";

export function useStationRequests(status?: "pending" | "approved" | "rejected") {
  const [items, setItems] = useState<PoliceStation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const base = collection(db, "stationRequests");
    const q = status
      ? query(base, where("status", "==", status))
      : query(base);
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<PoliceStation, "id">) }));
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
  }, [status]);

  return { items, loading };
}
