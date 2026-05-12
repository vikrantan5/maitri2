"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, query } from "firebase/firestore";
import { Building2, MapPin, ShieldOff, Search, CircleDot } from "lucide-react";
import { db } from "@/lib/firebase";
import { DashboardShell } from "@/components/dashboard/shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { suspendStation } from "@/lib/firestore/stations";
import { EmptyState } from "@/components/ui/empty-state";
import { toast } from "sonner";
import type { PoliceStation } from "@/lib/firestore/types";

export default function StationsListPage() {
  const [items, setItems] = useState<PoliceStation[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [status, setStatus] = useState<"all" | PoliceStation["status"]>("all");

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, "policeStations")),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<PoliceStation, "id">) }));
        list.sort((a, b) => a.name.localeCompare(b.name));
        setItems(list);
        setLoading(false);
      },
      () => setLoading(false),
    );
    return () => unsub();
  }, []);

  const filtered = items.filter((s) => {
    if (status !== "all" && s.status !== status) return false;
    if (!filter) return true;
    const q = filter.toLowerCase();
    return (
      s.name?.toLowerCase().includes(q) ||
      s.district?.toLowerCase().includes(q) ||
      s.state?.toLowerCase().includes(q) ||
      s.stationId?.toLowerCase().includes(q)
    );
  });

  const onSuspend = async (id: string) => {
    if (!confirm("Suspend this station? Officers will lose dashboard access.")) return;
    try {
      await suspendStation(id);
      toast.success("Station suspended");
    } catch (e: any) {
      toast.error("Suspend failed", { description: e.message });
    }
  };

  return (
    <DashboardShell allow={["super_admin"]} title="Stations">
      <div className="space-y-6" data-testid="sa-stations-page">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-cyan/70">Network</div>
            <h1 className="text-3xl font-semibold text-white">Police Stations</h1>
            <p className="mt-1 text-sm text-white/50">
              {items.length} approved stations · {filtered.length} shown
            </p>
          </div>
          <a
            href="/super-admin/stations/requests"
            className="rounded-2xl border border-amber/30 bg-amber/10 px-4 py-2 text-xs font-medium uppercase tracking-[0.18em] text-amber transition-colors hover:bg-amber/20"
            data-testid="sa-stations-view-requests"
          >
            View pending requests →
          </a>
        </header>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <CardTitle className="text-base">All Stations</CardTitle>
            <div className="flex items-center gap-2">
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="h-9 rounded-lg border border-[var(--border)] bg-white/[0.02] px-3 text-xs text-white"
                data-testid="sa-stations-filter-status"
              >
                <option value="all">All status</option>
                <option value="approved">Approved</option>
                <option value="suspended">Suspended</option>
              </select>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/40" />
                <Input
                  placeholder="Search by name / district / id"
                  className="h-9 pl-8 w-72"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  data-testid="sa-stations-search"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="py-10 text-center text-xs text-white/40">Loading…</div>
            ) : filtered.length === 0 ? (
              <EmptyState
                icon={Building2}
                title="No stations yet"
                description="Approved stations from the requests queue will appear here."
              />
            ) : (
              <div className="divide-y divide-[var(--border)]">
                {filtered.map((s) => (
                  <div key={s.id} className="flex flex-wrap items-center gap-4 px-6 py-4" data-testid={`sa-station-row-${s.id}`}>
                    <div className="rounded-xl border border-[var(--border)] bg-white/[0.02] p-2">
                      <Building2 className="h-4 w-4 text-cyan" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-white">{s.name}</span>
                        <Badge variant={s.status === "approved" ? "ok" : s.status === "suspended" ? "danger" : "amber"}>
                          {s.status}
                        </Badge>
                        {s.online && (
                          <Badge variant="ok">
                            <CircleDot className="h-2.5 w-2.5" /> online
                          </Badge>
                        )}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-white/50">
                        <span className="font-mono">{s.stationId}</span>
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3 w-3" /> {s.district || "—"}, {s.state || "—"}
                        </span>
                        <span>{s.email}</span>
                        <span>{s.phone}</span>
                      </div>
                    </div>
                    {s.status === "approved" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onSuspend(s.id)}
                        data-testid={`sa-station-suspend-${s.id}`}
                      >
                        <ShieldOff className="h-3 w-3" /> Suspend
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}
