"use client";

import { useEffect, useRef } from "react";
import type { EmergencyCase } from "@/lib/firestore/types";

export default function CasesMap({ cases }: { cases: EmergencyCase[] }) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const layerRef = useRef<any>(null);
  const mapInstanceRef = useRef<any>(null);
  const LRef = useRef<any>(null);

  // init once
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      await import("leaflet/dist/leaflet.css");
      LRef.current = L;
      if (!mapRef.current || cancelled) return;
      const m = L.map(mapRef.current, { zoomControl: true, attributionControl: false }).setView([20.5937, 78.9629], 5);
      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "© OpenStreetMap, © CARTO",
      }).addTo(m);
      mapInstanceRef.current = m;
    })();
    return () => {
      cancelled = true;
      if (mapInstanceRef.current) mapInstanceRef.current.remove();
    };
  }, []);

  // update markers on cases change
  useEffect(() => {
    const L = LRef.current;
    const m = mapInstanceRef.current;
    if (!L || !m) return;
    if (layerRef.current) {
      m.removeLayer(layerRef.current);
    }
    const group = L.layerGroup();
    const points: [number, number][] = [];
    cases.forEach((c) => {
      if (!c.location) return;
      const color = c.status === "new" ? "#ff3b3b" : c.status === "acknowledged" ? "#ffb020" : c.status === "resolved" ? "#22e08c" : "#00e5ff";
      const marker = L.circleMarker([c.location.lat, c.location.lng], {
        radius: c.status === "new" ? 12 : 8,
        color,
        fillColor: color,
        fillOpacity: 0.55,
        weight: 2,
      }).bindPopup(
        `<div style="font-family:system-ui;color:#0c1220;min-width:180px"><b>${c.userName || "Unknown"}</b><br/><span style="font-size:11px">${c.status} · ${c.priority || "high"}</span></div>`,
      );
      group.addLayer(marker);
      points.push([c.location.lat, c.location.lng]);
    });
    group.addTo(m);
    layerRef.current = group;
    if (points.length) {
      try {
        m.fitBounds(points as any, { padding: [40, 40], maxZoom: 12 });
      } catch {}
    }
  }, [cases]);

  return <div ref={mapRef} className="h-full w-full" data-testid="cases-map" />;
}
