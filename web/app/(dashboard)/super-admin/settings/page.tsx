"use client";

import { DashboardShell } from "@/components/dashboard/shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuthStore } from "@/lib/stores/auth.store";
import { Settings as SettingsIcon } from "lucide-react";

export default function SettingsPage() {
  const user = useAuthStore((s) => s.user);
  return (
    <DashboardShell allow={["super_admin"]} title="Settings">
      <div className="space-y-6" data-testid="settings-page">
        <header>
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-cyan/70">Account</div>
          <h1 className="text-3xl font-semibold text-white">Settings</h1>
        </header>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <SettingsIcon className="h-4 w-4 text-cyan" /> Profile
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="Email" value={user?.email || "—"} />
            <Field label="Role" value={user?.role || "—"} />
            <Field label="UID" value={user?.uid || "—"} />
            <Field label="Name" value={user?.name || "—"} />
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-white/[0.02] p-3">
      <div className="text-[10px] uppercase tracking-[0.18em] text-white/40">{label}</div>
      <div className="mt-1 truncate font-mono text-sm text-white">{value}</div>
    </div>
  );
}
