import { Shield } from "lucide-react";

export default function SuperAdminPlaceholder() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="max-w-md text-center">
        <Shield className="mx-auto mb-4 h-10 w-10 text-cyan" />
        <h1 className="text-2xl font-semibold text-white">Super-Admin Dashboard</h1>
        <p className="mt-2 text-sm text-white/50">
          KPIs, live SOS feed, station approvals & analytics will land here in Phase 2.
        </p>
        <p className="mt-6 font-mono text-[11px] uppercase tracking-[0.2em] text-cyan/70">
          Page 1 (Login) is implemented · See PROMPT.md for the full build plan
        </p>
      </div>
    </div>
  );
}
