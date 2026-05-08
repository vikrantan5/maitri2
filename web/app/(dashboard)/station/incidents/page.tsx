"use client";

import { useEmergencyCases } from "@/lib/realtime/useEmergencyCases";
import { useAuthStore } from "@/lib/stores/auth.store";
import { DashboardShell } from "@/components/dashboard/shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Activity } from "lucide-react";

export default function StationIncidentsPage() {
  const user = useAuthStore((s) => s.user);
  const { cases, loading } = useEmergencyCases({ stationId: user?.stationId, max: 100, activeOnly: false });

  return (
    <DashboardShell allow={["police_station"]} title="Incidents">
      <div className="space-y-6" data-testid="incidents-page">
        <header>
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-cyan/70">History</div>
          <h1 className="text-3xl font-semibold text-white">Incident History</h1>
        </header>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-4 w-4 text-cyan" /> {cases.length} cases
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="py-8 text-center text-xs text-white/40">Loading…</div>
            ) : cases.length === 0 ? (
              <EmptyState icon={Activity} title="No incidents yet" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border)] text-left">
                      <Th>User</Th><Th>Status</Th><Th>Priority</Th><Th>Location</Th><Th>Created</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {cases.map((c) => (
                      <tr key={c.id} className="border-b border-white/[0.04]" data-testid={`incident-row-${c.id}`}>
                        <Td className="font-medium text-white">{c.userName || "Unknown"}</Td>
                        <Td><Badge variant={c.status === "new" ? "danger" : c.status === "resolved" ? "ok" : "amber"}>{c.status}</Badge></Td>
                        <Td>{c.priority}</Td>
                        <Td className="font-mono text-[11px]">{c.location ? `${c.location.lat.toFixed(3)}, ${c.location.lng.toFixed(3)}` : "—"}</Td>
                        <Td className="text-[11px] text-white/50">{c.createdAt?.toDate?.().toLocaleString() || "—"}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}

function Th({ children }: { children: React.ReactNode }) { return <th className="px-3 py-2 text-[10px] font-medium uppercase tracking-[0.18em] text-white/40">{children}</th>; }
function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) { return <td className={`px-3 py-3 text-white/80 ${className}`}>{children}</td>; }
