"use client";

import dynamic from "next/dynamic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardShell } from "@/components/dashboard/shell";
import { Flame } from "lucide-react";

const Heatmap = dynamic(() => import("@/components/map/heatmap-page"), { ssr: false });

export default function HeatmapPage() {
  return (
    <DashboardShell allow={["super_admin"]} title="Unsafe Heatmap">
      <div className="space-y-4" data-testid="heatmap-page">
        <header>
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-amber/80">Risk</div>
          <h1 className="text-3xl font-semibold text-white">Unsafe Zone Heatmap</h1>
          <p className="mt-1 max-w-xl text-sm text-white/50">
            Aggregated from crowd-sourced safety markers. Brighter regions indicate verified unsafe
            zones reported by Maitri users.
          </p>
        </header>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Flame className="h-4 w-4 text-amber" /> Live heatmap (Leaflet)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="h-[640px] w-full overflow-hidden rounded-b-2xl">
              <Heatmap />
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}
