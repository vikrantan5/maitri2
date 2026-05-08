"use client";

import { useEffect, useState } from "react";
import { Check, X, UserCog } from "lucide-react";
import { toast } from "sonner";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuthStore } from "@/lib/stores/auth.store";
import { useOfficerRequests } from "@/lib/realtime/useOfficerRequests";
import { approveOfficerRequest, rejectOfficerRequest } from "@/lib/firestore/officers";
import { DashboardShell } from "@/components/dashboard/shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import type { PoliceOfficer } from "@/lib/firestore/types";

export default function StationOfficersPage() {
  const user = useAuthStore((s) => s.user);
  const stationId = user?.stationId;
  const { items: pending } = useOfficerRequests(stationId, "pending");
  const [active, setActive] = useState<PoliceOfficer[]>([]);
  const [acting, setActing] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (!stationId) return;
      const snap = await getDocs(
        query(collection(db, "policeOfficers"), where("stationId", "==", stationId)),
      ).catch(() => ({ docs: [] } as any));
      setActive(snap.docs.map((d: any) => ({ id: d.id, ...d.data() })));
    })();
  }, [stationId]);

  const onApprove = async (id: string) => {
    setActing(id);
    try {
      await approveOfficerRequest(id, user?.email || "station");
      toast.success("Officer approved");
    } catch (e: any) {
      toast.error("Approval failed", { description: e.message });
    } finally {
      setActing(null);
    }
  };

  const onReject = async (id: string) => {
    const reason = window.prompt("Reason?") || "";
    if (!reason) return;
    setActing(id);
    try {
      await rejectOfficerRequest(id, user?.email || "station", reason);
      toast.success("Officer rejected");
    } catch (e: any) {
      toast.error("Rejection failed", { description: e.message });
    } finally {
      setActing(null);
    }
  };

  return (
    <DashboardShell allow={["police_station"]} title="Officers">
      <div className="space-y-6" data-testid="station-officers-page">
        <header>
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-cyan/70">Roster</div>
          <h1 className="text-3xl font-semibold text-white">Officers</h1>
        </header>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-base">
              <span className="flex items-center gap-2">
                <UserCog className="h-4 w-4 text-amber" /> Pending QR Onboarding
              </span>
              <Badge variant="amber">{pending.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pending.length === 0 ? (
              <EmptyState
                icon={UserCog}
                title="No pending officer requests"
                description="Officers who scan your QR code from the mobile app will appear here for approval."
              />
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {pending.map((o) => (
                  <div key={o.id} className="rounded-xl border border-[var(--border)] bg-white/[0.02] p-4" data-testid={`officer-pending-${o.id}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-white">{o.name || "Unknown"}</div>
                        <div className="mt-0.5 font-mono text-[11px] text-white/50">Badge: {o.badgeNumber}</div>
                        <div className="mt-0.5 text-[11px] text-white/50">{o.phone || o.email}</div>
                      </div>
                      <Badge variant="amber">{o.rank || "Officer"}</Badge>
                    </div>
                    <div className="mt-4 flex gap-2">
                      <Button size="sm" onClick={() => onApprove(o.id)} disabled={acting === o.id} className="flex-1" data-testid={`officer-approve-${o.id}`}>
                        <Check className="h-3.5 w-3.5" /> Approve
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => onReject(o.id)} disabled={acting === o.id} data-testid={`officer-reject-${o.id}`}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-base">
              <span>Active Roster</span>
              <Badge>{active.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {active.length === 0 ? (
              <EmptyState icon={UserCog} title="No officers yet" description="Approved officers will appear here." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border)] text-left">
                      <Th>Name</Th><Th>Badge</Th><Th>Rank</Th><Th>Phone</Th><Th>Status</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {active.map((o) => (
                      <tr key={o.id} className="border-b border-white/[0.04]" data-testid={`officer-active-${o.id}`}>
                        <Td className="font-medium text-white">{o.name}</Td>
                        <Td className="font-mono">{o.badgeNumber}</Td>
                        <Td>{o.rank || "—"}</Td>
                        <Td className="font-mono text-[12px]">{o.phone || "—"}</Td>
                        <Td><Badge variant={o.status === "approved" ? "ok" : "outline"}>{o.status}</Badge></Td>
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
