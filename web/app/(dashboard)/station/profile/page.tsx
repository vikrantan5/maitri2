"use client";

import { useAuthStore } from "@/lib/stores/auth.store";
import { DashboardShell } from "@/components/dashboard/shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings as SettingsIcon } from "lucide-react";

export default function StationProfilePage() {
  const user = useAuthStore((s) => s.user);
  return (
    <DashboardShell allow={["police_station"]} title="Profile">
      <div className="space-y-6" data-testid="station-profile-page">
        <header>
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-cyan/70">Profile</div>
          <h1 className="text-3xl font-semibold text-white">Station Profile</h1>
        </header>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><SettingsIcon className="h-4 w-4 text-cyan" /> Account</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {Object.entries({
              "Email": user?.email || "—",
              "UID": user?.uid || "—",
              "Role": user?.role || "—",
              "Station ID": user?.stationId || "—",
            }).map(([k, v]) => (
              <div key={k} className="rounded-xl border border-[var(--border)] bg-white/[0.02] p-3">
                <div className="text-[10px] uppercase tracking-[0.18em] text-white/40">{k}</div>
                <div className="mt-1 truncate font-mono text-sm text-white">{v}</div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}
