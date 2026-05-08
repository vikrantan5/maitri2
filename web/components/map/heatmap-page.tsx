"use client";

import { useEffect, useRef, useState } from "react";
import { collection, getDocs, query } from "firebase/firestore";
import { db } from "@/lib/firebase";

// Note: this is dynamically imported on the client only (no SSR)
export default function HeatmapPageInner() {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const [count, setCount] = useState(0);

  useEffect(() => {
    let mapInstance: any;
    let cancelled = false;

    (async () => {
      const L = (await import("leaflet")).default;
      await import("leaflet/dist/leaflet.css");
      await import("leaflet.heat" as any);

      if (!mapRef.current || cancelled) return;
      mapInstance = L.map(mapRef.current, { zoomControl: true, attributionControl: false }).setView([20.5937, 78.9629], 5);
      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "© OpenStreetMap, © CARTO",
      }).addTo(mapInstance);

      try {
        const snap = await getDocs(query(collection(db, "safety_markers")));
        const points: [number, number, number][] = [];
        snap.docs.forEach((d) => {
          const data = d.data() as any;
          const lat = data.coordinates?.lat ?? data.latitude;
          const lng = data.coordinates?.lng ?? data.longitude;
          if (typeof lat === "number" && typeof lng === "number") {
            // Weight: unsafe = 1.0, caution = 0.6, safe = 0.2 (inverted)
            const weight = data.status === "unsafe" ? 1 : data.status === "caution" ? 0.6 : 0.2;
            points.push([lat, lng, weight]);
          }
        });
        setCount(points.length);
        // @ts-expect-error leaflet.heat extends L
        L.heatLayer(points, { radius: 28, blur: 22, maxZoom: 16 }).addTo(mapInstance);
      } catch (e) {
        console.warn("heatmap load failed", e);
      }
    })();

    return () => {
      cancelled = true;
      if (mapInstance) mapInstance.remove();
    };
  }, []);

  return (
    <div className="relative h-full w-full">
      <div ref={mapRef} className="h-full w-full" data-testid="heatmap-leaflet" />
      <div className="absolute right-4 top-4 z-[1000] rounded-full border border-[var(--border)] bg-bg0/80 px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-white/60 backdrop-blur">
        {count} markers loaded
      </div>
    </div>
  );
}
