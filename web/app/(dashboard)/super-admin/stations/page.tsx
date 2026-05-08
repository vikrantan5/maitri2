"use client";

import { useEffect, useState } from "react";
import { Building2, Search } from "lucide-react";
import { collection, getDocs, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { DashboardShell } from "@/components/dashboard/shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import type { PoliceStation } from "@/lib/firestore/types";

export default function StationsPage() {
  const [items, setItems] = useState<PoliceStation[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDocs(query(collection(db, "policeStations")));
        setItems(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<PoliceStation, "id">) })),
        );
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = items.filter((s) =>
    [s.name, s.district, s.state, s.stationId, s.email]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(q.toLowerCase()),
  );

  return (
    <DashboardShell allow={["super_admin"]} title="Police Stations">
      <div className="space-y-6" data-testid="stations-page">
        <header className="flex items-end justify-between gap-3">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-cyan/70">Network</div>
            <h1 className="text-3xl font-semibold text-white">Police Stations</h1>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-[var(--border)] bg-white/[0.02] px-3">
            <Search className="h-3.5 w-3.5 text-white/40" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="h-9 w-72 border-0 bg-transparent px-2 focus-visible:bg-transparent"
              placeholder="Search by name, district, station ID…"
              data-testid="stations-search-input"
            />
          </div>
        </header>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="h-4 w-4 text-cyan" /> {filtered.length} stations
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="py-8 text-center text-xs text-white/40">Loading…</div>
            ) : filtered.length === 0 ? (
              <EmptyState
                icon={Building2}
                title="No stations yet"
                description="Approved stations will appear here. Use Approvals to review pending requests."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border)] text-left">
                      <Th>Station</Th>
                      <Th>ID</Th>
                      <Th>OIC</Th>
                      <Th>District</Th>
                      <Th>Status</Th>
                      <Th>Online</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((s) => (
                      <tr key={s.id} className="border-b border-white/[0.04] transition-colors hover:bg-white/[0.02]" data-testid={`station-row-${s.stationId || s.id}`}>
                        <Td className="font-medium text-white">{s.name}</Td>
                        <Td className="font-mono text-[11px] text-white/50">{s.stationId}</Td>
                        <Td>{s.officerInCharge}</Td>
                        <Td>{s.district || "—"}, {s.state || ""}</Td>
                        <Td>
                          <Badge variant={s.status === "approved" ? "ok" : s.status === "pending" ? "amber" : "danger"}>
                            {s.status}
                          </Badge>
                        </Td>
                        <Td>
                          <span className={`inline-block h-2 w-2 rounded-full ${s.online ? "bg-ok shadow-[0_0_8px_var(--green)]" : "bg-white/20"}`} />
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
