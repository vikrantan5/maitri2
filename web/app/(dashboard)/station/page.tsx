"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Building2, Map as MapIcon, Siren, Users as UsersIcon } from "lucide-react";
import { collection, getDocs, query, where, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuthStore } from "@/lib/stores/auth.store";
import { DashboardShell } from "@/components/dashboard/shell";
import { LiveFeed } from "@/components/dashboard/live-feed";
import { StatCard } from "@/components/dashboard/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useEmergencyCases } from "@/lib/realtime/useEmergencyCases";

const CasesMap = dynamic(() => import("@/components/map/cases-map"), { ssr: false });

export default function StationCommandCenter() {
  const user = useAuthStore((s) => s.user);
  const stationId = user?.stationId;
  const { cases } = useEmergencyCases({ stationId, max: 25 });
  const [officerCount, setOfficerCount] = useState(0);

  useEffect(() => {
    (async () => {
      if (!stationId) return;
      const snap = await getDocs(
        query(collection(db, "policeOfficers"), where("stationId", "==", stationId), limit(500)),
      ).catch(() => ({ size: 0 } as any));
      setOfficerCount(snap.size || 0);
    })();
  }, [stationId]);

  const newCount = cases.filter((c) => c.status === "new" || c.status === "broadcasted").length;
  const inProgress = cases.filter((c) => c.status === "dispatched" || c.status === "in_progress" || c.status === "assigned").length;

  return (
    <DashboardShell allow={["police_station"]} title="Command Center">
      <div className="space-y-6" data-testid="station-command-center">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-cyan/70">Station ID · {stationId || "Unassigned"}</div>
            <h1 className="text-3xl font-semibold text-white">Command Center</h1>
          </div>
        </header>

        <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatCard testId="stat-active" label="Active Cases" value={cases.length} icon={Siren} accent="danger" />
          <StatCard testId="stat-new" label="Unattended" value={newCount} icon={Siren} accent="amber" delay={0.05} />
          <StatCard testId="stat-progress" label="In Progress" value={inProgress} icon={MapIcon} accent="cyan" delay={0.1} />
          <StatCard testId="stat-officers" label="Officers" value={officerCount} icon={UsersIcon} accent="ok" delay={0.15} />
        </section>

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Siren className="h-4 w-4 text-danger" /> Live SOS Panel
                </CardTitle>
              </CardHeader>
              <CardContent>
                <LiveFeed
                  scope={{ stationId }}
                  by={user?.email || "station"}
                />
              </CardContent>
            </Card>
          </div>
          <div>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <MapIcon className="h-4 w-4 text-cyan" /> Coverage Map
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="h-[460px] w-full overflow-hidden rounded-b-2xl border-t border-[var(--border)]">
                  <CasesMap cases={cases} />
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
      </div>
    </DashboardShell>
  );
}
