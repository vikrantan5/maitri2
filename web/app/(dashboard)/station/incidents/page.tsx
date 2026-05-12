"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useEmergencyCases } from "@/lib/realtime/useEmergencyCases";
import { useAuthStore } from "@/lib/stores/auth.store";
import { DashboardShell } from "@/components/dashboard/shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Activity, Image as ImageIcon, Mic } from "lucide-react";

const STATUS_FILTERS = ["all", "new", "acknowledged", "dispatched", "in_progress", "resolved", "false_alarm", "escalated"] as const;

export default function StationIncidentsPage() {
  const user = useAuthStore((s) => s.user);
  const { cases, loading } = useEmergencyCases({ stationId: user?.stationId, max: 200, activeOnly: false });
  const [filter, setFilter] = useState<(typeof STATUS_FILTERS)[number]>("all");
  const [search, setSearch] = useState("");

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return cases.filter((c) => {
      if (filter !== "all" && c.status !== filter) return false;
      if (!q) return true;
      return (
        (c.userName || "").toLowerCase().includes(q) ||
        (c.userPhone || "").includes(q) ||
        c.id.toLowerCase().includes(q)
      );
    });
  }, [cases, filter, search]);

  return (
    <DashboardShell allow={["police_station"]} title="Incidents">
      <div className="space-y-6" data-testid="incidents-page">
        <header>
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-cyan/70">History</div>
          <h1 className="text-3xl font-semibold text-white">Incident History</h1>
        </header>

        <Card>
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center justify-between gap-3 text-base">
              <span className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-cyan" /> {visible.length} of {cases.length} cases
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search user, phone, or case id…"
                  className="rounded-md border border-[var(--border)] bg-white/[0.02] px-3 py-1.5 text-xs text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-cyan/40"
                  data-testid="incidents-search"
                />
                <select
                  value={filter}
                  onChange={(e) => setFilter(e.target.value as any)}
                  className="rounded-md border border-[var(--border)] bg-[var(--glass)] px-2 py-1.5 text-xs text-white focus:outline-none"
                  data-testid="incidents-filter"
                >
                  {STATUS_FILTERS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="py-8 text-center text-xs text-white/40">Loading…</div>
            ) : visible.length === 0 ? (
              <EmptyState icon={Activity} title="No incidents match" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border)] text-left">
                      <Th>User</Th>
                      <Th>Status</Th>
                      <Th>Priority</Th>
                      <Th>Location</Th>
                      <Th>Evidence</Th>
                      <Th>Created</Th>
                       <Th>{" "}</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((c) => (
                      <tr key={c.id} className="border-b border-white/[0.04]" data-testid={`incident-row-${c.id}`}>
                        <Td className="font-medium text-white">{c.userName || "Unknown"}</Td>
                        <Td>
                          <Badge
                            variant={c.status === "new" ? "danger" : c.status === "resolved" ? "ok" : "amber"}
                          >
                            {c.status}
                          </Badge>
                        </Td>
                        <Td>{c.priority || "—"}</Td>
                        <Td className="font-mono text-[11px]">
                          {c.location ? `${c.location.lat.toFixed(3)}, ${c.location.lng.toFixed(3)}` : "—"}
                        </Td>
                        <Td>
                          <div className="flex items-center gap-2">
                            {c.imageUrl ? (
                              <a
                                href={c.imageUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-[11px] text-cyan hover:underline"
                              >
                                <ImageIcon className="h-3 w-3" /> Photo
                              </a>
                            ) : (
                              <span className="text-[11px] text-white/30">—</span>
                            )}
                            {c.audioUrl ? (
                              <a
                                href={c.audioUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-[11px] text-cyan hover:underline"
                              >
                                <Mic className="h-3 w-3" /> Audio
                              </a>
                            ) : (
                              <span className="text-[11px] text-white/30">—</span>
                            )}
                          </div>
                        </Td>
                        <Td className="text-[11px] text-white/50">
                          {(c.createdAt as any)?.toDate?.().toLocaleString() || "—"}
                        </Td>
                        <Td>
                          <Link
                            href={`/officer/case/${c.id}`}
                            className="text-[11px] text-cyan hover:underline"
                            data-testid={`incident-open-${c.id}`}
                          >
                            Open →
                          </Link>
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
