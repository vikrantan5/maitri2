"use client";
import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";
import { collection, onSnapshot, query } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface MarkerPoint {
  id: string;
  lat: number;
  lng: number;
  status: "safe" | "caution" | "unsafe" | "unknown";
  note?: string;
  safetyScore?: number;
  weight: number;
}

// Dynamically imported on the client only (no SSR).
export default function HeatmapPageInner() {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const [count, setCount] = useState(0);
  const [bucket, setBucket] = useState<{ unsafe: number; caution: number; safe: number }>({
    unsafe: 0,
    caution: 0,
    safe: 0,
  });

  useEffect(() => {
    let mapInstance: any;
    let heatLayer: any;
    let markerLayer: any;
    let cancelled = false;
    let unsubMarkers: (() => void) | null = null;
    let resizeObs: ResizeObserver | null = null;

    (async () => {
      const L = (await import("leaflet")).default;
 
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
            const points: MarkerPoint[] = [];
            const counts = { unsafe: 0, caution: 0, safe: 0 };

            snap.docs.forEach((d) => {
              const data = d.data() as any;
              const lat =
                data?.coordinates?.lat ??
                data?.coordinates?.latitude ??
                data?.location?.lat ??
                data?.location?.latitude ??
                data?.latitude;
              const lng =
                data?.coordinates?.lng ??
                data?.coordinates?.longitude ??
                data?.location?.lng ??
                data?.location?.longitude ??
                data?.longitude;
              if (typeof lat !== "number" || typeof lng !== "number") return;
              if (!isFinite(lat) || !isFinite(lng)) return;

              const status: MarkerPoint["status"] =
                data?.status === "unsafe" || data?.status === "caution" || data?.status === "safe"
                  ? data.status
                  : "unknown";

              if (status === "unsafe") counts.unsafe++;
              else if (status === "caution") counts.caution++;
              else if (status === "safe") counts.safe++;

              const w = status === "unsafe" ? 1 : status === "caution" ? 0.65 : status === "safe" ? 0.3 : 0.5;

              points.push({
                id: d.id,
                lat,
                lng,
                status,
                note: data?.note || "",
                safetyScore: data?.safetyScore,
                weight: w,
              });
            });

            setCount(points.length);
            setBucket(counts);

            // ---- Heat layer (only weighted by unsafe-ness) ----
            if (heatLayer && mapInstance) {
              try {
                mapInstance.removeLayer(heatLayer);
              } catch {
                /* noop */
              }
            }
            const heatPoints: [number, number, number][] = points.map((p) => [p.lat, p.lng, p.weight]);
            // @ts-expect-error leaflet.heat extends L at runtime
            heatLayer = L.heatLayer(heatPoints, {
              radius: 36,
              blur: 24,
              maxZoom: 16,
              minOpacity: 0.45,
              max: 1.0,
              gradient: {
                0.1: "#22e08c", // green (safe)
                0.35: "#00e5ff", // cyan (low risk)
                0.55: "#ffb020", // amber (caution)
                0.8: "#ff6b00", // orange
                1.0: "#ff2d2d", // red (unsafe)
              },
            }).addTo(mapInstance);

            // ---- Individual circle markers (always-visible) ----
            if (markerLayer && mapInstance) {
              try {
                mapInstance.removeLayer(markerLayer);
              } catch {
                /* noop */
              }
            }
            markerLayer = L.layerGroup();
            points.forEach((p) => {
              const color =
                p.status === "unsafe"
                  ? "#ff2d2d"
                  : p.status === "caution"
                    ? "#ffb020"
                    : p.status === "safe"
                      ? "#22e08c"
                      : "#00e5ff";
              const marker = L.circleMarker([p.lat, p.lng], {
                radius: p.status === "unsafe" ? 9 : 7,
                color,
                weight: 2,
                fillColor: color,
                fillOpacity: 0.85,
              });
              const noteHtml = p.note ? `<div style="margin-top:4px;font-size:11px;color:#444">${escapeHtml(p.note)}</div>` : "";
              const scoreHtml =
                typeof p.safetyScore === "number"
                  ? `<div style="font-family:monospace;font-size:10px;color:#666;margin-top:4px">Score: ${p.safetyScore}</div>`
                  : "";
              marker.bindPopup(
                `<div style="font-family:system-ui;color:#0c1220;min-width:180px"><b>${p.status.toUpperCase()}</b>${noteHtml}${scoreHtml}</div>`,
              );
              markerLayer.addLayer(marker);
            });
            markerLayer.addTo(mapInstance);

            // Fit bounds to markers if we have any
            if (points.length > 0) {
              try {
                const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number]));
                mapInstance.fitBounds(bounds.pad(0.4), { maxZoom: 12 });
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

      {/* Stats overlay */}
      <div className="absolute right-4 top-4 z-[1000] flex flex-col items-end gap-2">
        <div className="rounded-full border border-[var(--border)] bg-bg0/80 px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-white/70 backdrop-blur">
          {count} markers loaded
        </div>
        <div className="flex gap-1.5">
          <Pill color="#ff2d2d" label={`unsafe ${bucket.unsafe}`} />
          <Pill color="#ffb020" label={`caution ${bucket.caution}`} />
          <Pill color="#22e08c" label={`safe ${bucket.safe}`} />
        </div>
      </div>

      {/* Legend */}
      <div className="absolute left-4 bottom-4 z-[1000] rounded-2xl border border-[var(--border)] bg-bg0/85 px-4 py-3 text-[11px] text-white/70 backdrop-blur">
        <div className="mb-2 font-mono uppercase tracking-[0.2em] text-white/40">Risk Gradient</div>
        <div className="flex items-center gap-2">
          <div className="h-2 w-40 rounded-full" style={{ background: "linear-gradient(90deg, #22e08c, #00e5ff, #ffb020, #ff6b00, #ff2d2d)" }} />
        </div>
        <div className="mt-1 flex justify-between text-[10px] text-white/40">
          <span>Safe</span>
          <span>Caution</span>
          <span>Unsafe</span>
        </div>
      </div>
    </div>
  );
}

function Pill({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-bg0/80 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-white/80 backdrop-blur">
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
      {label}
    </div>
  );
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] || c));
}
