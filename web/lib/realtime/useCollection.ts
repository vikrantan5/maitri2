"use client";
import { useEffect, useState } from "react";
import { collection, onSnapshot, query } from "firebase/firestore";
import { db } from "@/lib/firebase";

export function useCollection<T = any>(name: string) {
  const [docs, setDocs] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const q = query(collection(db, name));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setDocs(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as T[]);
        setLoading(false);
      },
      () => setLoading(false),
    );
    return () => unsub();
  }, [name]);
  return { docs, loading };
}
