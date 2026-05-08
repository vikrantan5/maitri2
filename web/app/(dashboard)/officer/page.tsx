"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { Siren } from "lucide-react";
import { db } from "@/lib/firebase";
import { useAuthStore } from "@/lib/stores/auth.store";
import { DashboardShell } from "@/components/dashboard/shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SosCard } from "@/components/dashboard/sos-card";
import { EmptyState } from "@/components/ui/empty-state";
import { setCaseStatus } from "@/lib/firestore/cases";
import type { EmergencyCase } from "@/lib/firestore/types";
import { toast } from "sonner";

export default function OfficerDashboard() {
  const user = useAuthStore((s) => s.user);
  const [cases, setCases] = useState<EmergencyCase[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.uid) return;
    const q = query(
      collection(db, "emergencyCases"),
      where("assignedOfficers", "array-contains", user.uid),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<EmergencyCase, "id">) }));
        list.sort((a: any, b: any) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
        setCases(list);
        setLoading(false);
      },
      () => setLoading(false),
    );
    return () => unsub();
  }, [user?.uid]);

  const action = async (id: string, action: "in_progress" | "resolved" | "false_alarm") => {
    try {
      await setCaseStatus(
        id,
        action,
        user?.email || user?.uid || "officer",
        action === "in_progress" ? "Officer arrived." : action === "resolved" ? "Resolved on-site." : "Marked false alarm.",
      );
      toast.success("Updated");
    } catch (e: any) {
      toast.error("Update failed", { description: e.message });
    }
  };

  return (
    <DashboardShell allow={["police_officer"]} title="My Cases">
      <div className="space-y-6" data-testid="officer-dashboard">
        <header>
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-cyan/70">Dispatch</div>
          <h1 className="text-3xl font-semibold text-white">Cases assigned to you</h1>
        </header>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Siren className="h-4 w-4 text-danger" /> {cases.length} active assignment{cases.length !== 1 ? "s" : ""}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              <div className="py-8 text-center text-xs text-white/40">Loading…</div>
            ) : cases.length === 0 ? (
              <EmptyState
                icon={Siren}
                title="Standby"
                description="You'll be notified the instant your station dispatches you on a case."
              />
            ) : (
              cases.map((c) => (
                <SosCard
                  key={c.id}
                  c={c}
                  onAccept={c.status === "dispatched" ? () => action(c.id, "in_progress") : undefined}
                  onResolve={() => action(c.id, "resolved")}
                  href={`/officer/case/${c.id}`}
                />
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}
