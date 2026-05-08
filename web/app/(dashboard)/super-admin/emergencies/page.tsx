"use client";

import { useAuthStore } from "@/lib/stores/auth.store";
import { DashboardShell } from "@/components/dashboard/shell";
import { LiveFeed } from "@/components/dashboard/live-feed";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Siren } from "lucide-react";

export default function EmergenciesPage() {
  const user = useAuthStore((s) => s.user);
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
              <Siren className="h-4 w-4 text-danger" /> All active SOS — every station, every district
            </CardTitle>
          </CardHeader>
          <CardContent>
            <LiveFeed by={user?.email || "super_admin"} />
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}
