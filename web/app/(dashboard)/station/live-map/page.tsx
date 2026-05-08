"use client";

import dynamic from "next/dynamic";
import { useAuthStore } from "@/lib/stores/auth.store";
import { useEmergencyCases } from "@/lib/realtime/useEmergencyCases";
import { DashboardShell } from "@/components/dashboard/shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Map as MapIcon } from "lucide-react";

const CasesMap = dynamic(() => import("@/components/map/cases-map"), { ssr: false });

export default function StationLiveMapPage() {
  const user = useAuthStore((s) => s.user);
  const { cases } = useEmergencyCases({ stationId: user?.stationId, max: 100, activeOnly: false });

  return (
    <DashboardShell allow={["police_station"]} title="Live Map">
      <div className="space-y-4" data-testid="live-map-page">
        <header>
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-cyan/70">Geo</div>
          <h1 className="text-3xl font-semibold text-white">Live Coverage Map</h1>
        </header>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MapIcon className="h-4 w-4 text-cyan" /> All cases ({cases.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="h-[640px] w-full overflow-hidden rounded-b-2xl">
              <CasesMap cases={cases} />
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}
