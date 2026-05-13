"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useAuthStore } from "@/lib/stores/auth.store";
import { useEmergencyCases } from "@/lib/realtime/useEmergencyCases";
import { DashboardShell } from "@/components/dashboard/shell";
import { LiveFeed } from "@/components/dashboard/live-feed";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Image as ImageIcon, Map as MapIcon, Mic, Siren, History as HistoryIcon } from "lucide-react";

const CasesMap = dynamic(() => import("@/components/map/cases-map"), { ssr: false });

export default function EmergenciesPage() {
  const user = useAuthStore((s) => s.user);
  const { cases: history, loading } = useEmergencyCases({ activeOnly: false, max: 200 });
  const [showMap, setShowMap] = useState(true);

  return (
    <DashboardShell allow={["super_admin"]} title="Emergencies">
      <div className="space-y-6" data-testid="emergencies-page">
        <header>
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-cyan/70">Live</div>
          <h1 className="text-3xl font-semibold text-white">Global Emergency Cases</h1>
        </header>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Siren className="h-4 w-4 text-danger" /> Active SOS — every station, every district
            </CardTitle>
          </CardHeader>
          <CardContent>
            <LiveFeed by={user?.email || "super_admin"} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-2 text-base">
              <span className="flex items-center gap-2">
                <MapIcon className="h-4 w-4 text-cyan" /> Coverage Map — all cases ({history.length})
              </span>
              <Button size="sm" variant="outline" onClick={() => setShowMap((v) => !v)} data-testid="toggle-map">
                {showMap ? "Hide map" : "Show map"}
              </Button>
            </CardTitle>
          </CardHeader>
          {showMap && (
            <CardContent className="p-0">
              <div className="h-[480px] w-full overflow-hidden rounded-b-2xl">
                <CasesMap cases={history} />
              </div>
            </CardContent>
          )}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <HistoryIcon className="h-4 w-4 text-amber" /> Full Incident History ({history.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="py-8 text-center text-xs text-white/40">Loading cases…</div>
            ) : history.length === 0 ? (
              <EmptyState icon={Siren} title="No incidents yet" description="Cases from across the network will appear here." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm" data-testid="emergencies-table">
                  <thead>
                    <tr className="border-b border-[var(--border)] text-left">
                      <Th>User</Th>
                      <Th>Status</Th>
                      <Th>Broadcast</Th>
                      <Th>Assigned</Th>
                      <Th>Location</Th>
                      <Th>Evidence</Th>
                      <Th>Officers</Th>
                      <Th>Created</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((c) => (
                      <tr key={c.id} className="border-b border-white/[0.04]" data-testid={`emergency-row-${c.id}`}>
                        <Td className="font-medium text-white">{c.userName || "Unknown"}</Td>
                        <Td>
                          <Badge variant={c.status === "new" || c.status === "broadcasted" ? "danger" : c.status === "resolved" ? "ok" : "amber"}>
                            {c.status?.replace("_", " ")}
                          </Badge>
                        </Td>
                        <Td className="font-mono text-[11px]" data-testid={`emergency-broadcast-${c.id}`}>
                          {(c.nearbyStationIds?.length ?? 0) > 0
                            ? `${c.nearbyStationIds!.length} station(s)`
                            : "—"}
                        </Td>
                        <Td className="font-mono text-[11px]">{c.assignedStationId || "—"}</Td>
                        <Td className="font-mono text-[11px]">
                          {c.location
                            ? `${c.location.lat.toFixed(3)}, ${c.location.lng.toFixed(3)}`
                            : "—"}
                        </Td>
                        <Td>
                          <div className="flex items-center gap-2">
                            {c.imageUrl ? (
                              <a
                                href={c.imageUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] bg-white/[0.02] px-2 py-1 text-[11px] text-white/70 hover:text-cyan"
                                data-testid={`emergency-image-${c.id}`}
                              >
                                <ImageIcon className="h-3 w-3" /> Photo
                              </a>
                            ) : (
                              <span className="text-[11px] text-white/30">No photo</span>
                            )}
                            {c.audioUrl ? (
                              <a
                                href={c.audioUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] bg-white/[0.02] px-2 py-1 text-[11px] text-white/70 hover:text-cyan"
                                data-testid={`emergency-audio-${c.id}`}
                              >
                                <Mic className="h-3 w-3" /> Audio
                              </a>
                            ) : (
                              <span className="text-[11px] text-white/30">No audio</span>
                            )}
                          </div>
                        </Td>
                        <Td>{c.assignedOfficers?.length || 0}</Td>
                        <Td className="text-[11px] text-white/50">
                          {(c.createdAt as any)?.toDate?.().toLocaleString() || "—"}
                        </Td>
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

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-3 py-2 text-[10px] font-medium uppercase tracking-[0.18em] text-white/40">{children}</th>;
}
function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-3 text-white/80 ${className}`}>{children}</td>;
}
