"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Check, X, Building2 } from "lucide-react";
import { toast } from "sonner";
import { useStationRequests } from "@/lib/realtime/useStationRequests";
import { approveStationRequest, rejectStationRequest } from "@/lib/firestore/stations";
import { useAuthStore } from "@/lib/stores/auth.store";
import { DashboardShell } from "@/components/dashboard/shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

export default function StationRequestsPage() {
  const user = useAuthStore((s) => s.user);
  const { items, loading } = useStationRequests();
  const [acting, setActing] = useState<string | null>(null);

  const buckets = {
    pending: items.filter((i) => i.status === "pending"),
    approved: items.filter((i) => i.status === "approved"),
    rejected: items.filter((i) => i.status === "rejected"),
  };

  const onApprove = async (id: string) => {
    setActing(id);
    try {
      await approveStationRequest(id, user?.email || "super_admin");
      toast.success("Station approved", { description: "Credentials & QR will be issued shortly." });
    } catch (e: any) {
      toast.error("Approval failed", { description: e.message });
    } finally {
      setActing(null);
    }
  };

  const onReject = async (id: string) => {
    const reason = window.prompt("Rejection reason?") || "";
    if (!reason) return;
    setActing(id);
    try {
      await rejectStationRequest(id, user?.email || "super_admin", reason);
      toast.success("Station rejected");
    } catch (e: any) {
      toast.error("Rejection failed", { description: e.message });
    } finally {
      setActing(null);
    }
  };

  return (
    <DashboardShell allow={["super_admin"]} title="Station Approvals">
      <div className="space-y-6" data-testid="station-requests-page">
        <header>
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-cyan/70">Workflow</div>
          <h1 className="text-3xl font-semibold text-white">Station Approval Queue</h1>
          <p className="mt-1 max-w-xl text-sm text-white/50">
            Review registration requests and approve verified police stations to bring them online.
          </p>
        </header>

        {loading ? (
          <div className="py-8 text-center text-xs text-white/40">Loading queue…</div>
        ) : items.length === 0 ? (
          <EmptyState icon={Building2} title="No registration requests yet" description="Pending submissions from /register-station appear here in realtime." />
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {(["pending", "approved", "rejected"] as const).map((bucket) => (
              <Card key={bucket}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between text-base capitalize">
                    {bucket}
                    <Badge variant={bucket === "pending" ? "amber" : bucket === "approved" ? "ok" : "danger"}>
                      {buckets[bucket].length}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {buckets[bucket].length === 0 && (
                    <div className="rounded-xl border border-dashed border-white/10 p-4 text-center text-[11px] text-white/40">
                      No items
                    </div>
                  )}
                  {buckets[bucket].map((s) => (
                    <motion.div
                      key={s.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="rounded-xl border border-[var(--border)] bg-white/[0.02] p-3"
                      data-testid={`request-card-${s.id}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-white">{s.name}</div>
                          <div className="text-[11px] text-white/50">{s.district}, {s.state}</div>
                          <div className="mt-1 text-[11px] text-white/40">OIC: {s.officerInCharge}</div>
                          <div className="text-[11px] text-white/40">{s.email}</div>
                        </div>
                      </div>
                      {bucket === "pending" && (
                        <div className="mt-3 flex gap-2">
                          <Button
                            size="sm"
                            disabled={acting === s.id}
                            onClick={() => onApprove(s.id)}
                            data-testid={`request-approve-${s.id}`}
                            className="flex-1"
                          >
                            <Check className="h-3.5 w-3.5" /> Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={acting === s.id}
                            onClick={() => onReject(s.id)}
                            data-testid={`request-reject-${s.id}`}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                    </motion.div>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
