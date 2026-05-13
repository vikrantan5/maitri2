"use client";

import { useEffect, useState } from "react";
import {
  collection,
  getCountFromServer,
  getDocs,
  limit,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import {
  Activity,
  AlertTriangle,
  BadgeCheck,
  Building2,
  Flame,
  Siren,
  TrendingUp,
  Users,
} from "lucide-react";
import { db } from "@/lib/firebase";
import { useAuthStore } from "@/lib/stores/auth.store";
import { DashboardShell } from "@/components/dashboard/shell";
import { StatCard } from "@/components/dashboard/stat-card";
import { LiveFeed } from "@/components/dashboard/live-feed";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Counts {
  stations: number;
  pendingStations: number;
  users: number;
  activeSos: number;
  resolvedToday: number;
  unsafeMarkers: number;
}

export default function SuperAdminPage() {
  const user = useAuthStore((s) => s.user);
  const [counts, setCounts] = useState<Counts>({
    stations: 0,
    pendingStations: 0,
    users: 0,
    activeSos: 0,
    resolvedToday: 0,
    unsafeMarkers: 0,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [stationsSnap, pendingSnap, usersSnap, activeSnap, markersSnap] = await Promise.all([
          getCountFromServer(query(collection(db, "policeStations"))).catch(() => null),
          getCountFromServer(query(collection(db, "stationRequests"), where("status", "==", "pending"))).catch(() => null),
          getCountFromServer(query(collection(db, "users"))).catch(() => null),
          getCountFromServer(
            query(collection(db, "emergencyCases"), where("status", "in", ["new", "acknowledged", "dispatched", "in_progress", "escalated"])),
          ).catch(() => null),
          getCountFromServer(query(collection(db, "safety_markers"), where("status", "==", "unsafe"))).catch(() => null),
        ]);

        // Resolved today
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const resolvedSnap = await getDocs(
          query(
            collection(db, "emergencyCases"),
            where("status", "==", "resolved"),
            limit(1000),
          ),
        ).catch(() => ({ docs: [] } as any));
        const resolvedToday = resolvedSnap.docs.filter((d: any) => {
          const r = d.data().resolvedAt;
          const t = r?.toDate?.();
          return t && t >= today;
        }).length;

        if (cancelled) return;
        setCounts({
          stations: stationsSnap?.data().count ?? 0,
          pendingStations: pendingSnap?.data().count ?? 0,
          users: usersSnap?.data().count ?? 0,
          activeSos: activeSnap?.data().count ?? 0,
          resolvedToday,
          unsafeMarkers: markersSnap?.data().count ?? 0,
        });
      } catch (err) {
        console.warn("KPI load error", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <DashboardShell allow={["super_admin"]} title="Operations Overview">
      <div className="space-y-6" data-testid="super-admin-overview">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-cyan/70">Realtime</div>
            <h1 className="text-3xl font-semibold text-white">National Operations</h1>
            <p className="mt-1 max-w-xl text-sm text-white/50">
              Live triage across every approved station, officer, and SOS event in the Maitri network.
            </p>
          </div>
          <div className="rounded-2xl border border-[var(--border)] bg-white/[0.03] px-4 py-2 font-mono text-[11px] uppercase tracking-[0.18em] text-white/50">
            Console: <span className="text-cyan">{user?.email}</span>
          </div>
        </header>

        <section className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
          <StatCard testId="stat-stations" label="Police Stations" value={counts.stations} icon={Building2} accent="cyan" delay={0.0} />
          <StatCard testId="stat-pending" label="Pending Approvals" value={counts.pendingStations} icon={BadgeCheck} accent="amber" delay={0.05} />
          <StatCard testId="stat-users" label="Users" value={counts.users} icon={Users} accent="pink" delay={0.1} />
          <StatCard testId="stat-active-sos" label="Active SOS" value={counts.activeSos} icon={Siren} accent="danger" delay={0.15} />
          <StatCard testId="stat-resolved" label="Resolved (24h)" value={counts.resolvedToday} icon={Activity} accent="ok" delay={0.2} />
          <StatCard testId="stat-unsafe" label="Unsafe Markers" value={counts.unsafeMarkers} icon={Flame} accent="amber" delay={0.25} />
        </section>

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <AlertTriangle className="h-4 w-4 text-danger" /> Live SOS Feed
                </CardTitle>
              </CardHeader>
              <CardContent>
                <LiveFeed by={user?.email || "super_admin"} />
              </CardContent>
            </Card>
          </div>
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <TrendingUp className="h-4 w-4 text-cyan" /> Quick Insights
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <Insight label="Avg. accept time" value="—" hint="Coming after first 50 cases" />
                <Insight label="Network coverage" value={`${counts.stations} stations`} hint="Approved & online" />
                <Insight label="Backlog" value={`${counts.pendingStations} requests`} hint="Awaiting review" />
              </CardContent>
            </Card>
          </div>
        </section>
      </div>
    </DashboardShell>
  );
}

function Insight({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-white/[0.02] p-3">
      <div className="text-[10px] uppercase tracking-[0.18em] text-white/40">{label}</div>
      <div className="mt-1 font-mono text-lg font-semibold text-white">{value}</div>
      {hint && <div className="mt-0.5 text-[11px] text-white/40">{hint}</div>}
    </div>
  );
}
