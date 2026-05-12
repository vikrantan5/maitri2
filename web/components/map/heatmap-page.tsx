"use client";

import { useEffect, useRef, useState } from "react";
import { collection, onSnapshot, query } from "firebase/firestore";
import { db } from "@/lib/firebase";

// Note: this is dynamically imported on the client only (no SSR)
export default function HeatmapPageInner() {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const [count, setCount] = useState(0);

  useEffect(() => {
    let mapInstance: any;
    let heatLayer: any;
    let cancelled = false;
    let unsubMarkers: (() => void) | null = null;
    let resizeObs: ResizeObserver | null = null;

    (async () => {
      const L = (await import("leaflet")).default;
      await import("leaflet/dist/leaflet.css");
      await import("leaflet.heat" as any);

      if (!mapRef.current || cancelled) return;

      mapInstance = L.map(mapRef.current, {
        zoomControl: true,
        attributionControl: false,
      }).setView([20.5937, 78.9629], 5);

      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png", {
        maxZoom: 19,
        subdomains: "abcd",
        attribution: "© OpenStreetMap, © CARTO",
      }).addTo(mapInstance);

      // Ensure the map fills its container even when it was hidden / resized
      const ensureSize = () => {
        try {
          mapInstance?.invalidateSize();
        } catch {
          /* noop */
        }
      };
      setTimeout(ensureSize, 50);
      setTimeout(ensureSize, 400);
      if (typeof ResizeObserver !== "undefined" && mapRef.current) {
        resizeObs = new ResizeObserver(ensureSize);
        resizeObs.observe(mapRef.current);
      }

      // Subscribe to safety_markers in real-time so newly added markers show up
      try {
        const q = query(collection(db, "safety_markers"));
        unsubMarkers = onSnapshot(
          q,
          (snap) => {
            const points: [number, number, number][] = [];
            snap.docs.forEach((d) => {
              const data = d.data() as any;
              const lat =
                data?.coordinates?.lat ??
                data?.coordinates?.latitude ??
                data?.location?.lat ??
                data?.latitude;
              const lng =
                data?.coordinates?.lng ??
                data?.coordinates?.longitude ??
                data?.location?.lng ??
                data?.longitude;
              if (typeof lat === "number" && typeof lng === "number") {
                // Weight: unsafe = 1.0, caution = 0.6, safe = 0.2
                const w =
                  data?.status === "unsafe"
                    ? 1
                    : data?.status === "caution"
                      ? 0.6
                      : 0.2;
                points.push([lat, lng, w]);
              }
            });

            setCount(points.length);

            if (heatLayer && mapInstance) {
              try {
                mapInstance.removeLayer(heatLayer);
              } catch {
                /* noop */
              }
            }
            // @ts-expect-error leaflet.heat extends L at runtime
            heatLayer = L.heatLayer(points, {
              radius: 28,
              blur: 22,
              maxZoom: 16,
            }).addTo(mapInstance);

            // Fit bounds to markers if we have any
            if (points.length > 0) {
              try {
                const bounds = L.latLngBounds(points.map((p) => [p[0], p[1]] as [number, number]));
                mapInstance.fitBounds(bounds.pad(0.4), { maxZoom: 11 });
              } catch {
                /* noop */
              }
            }
            ensureSize();
          },
          (err) => {
            console.warn("[heatmap] snapshot error", err);
          },
        );
      } catch (e) {
        console.warn("[heatmap] subscribe failed", e);
      }
    })();

    return () => {
      cancelled = true;
      if (unsubMarkers) unsubMarkers();
      if (resizeObs) resizeObs.disconnect();
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
