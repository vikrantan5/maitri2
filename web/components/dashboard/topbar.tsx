"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, LogOut, Search, Wifi } from "lucide-react";
import { toast } from "sonner";
import { logout } from "@/lib/auth";
import { useAuthStore } from "@/lib/stores/auth.store";
import type { Role } from "@/lib/auth";

const ROLE_LABEL: Record<Role, string> = {
  super_admin: "Super Admin Console",
  police_station: "Station Command Center",
  police_officer: "Officer Console",
};

export function Topbar({ role, title }: { role: Role; title?: string }) {
  const router = useRouter();
  const setUser = useAuthStore((s) => s.setUser);
  const [signingOut, setSigningOut] = useState(false);

  const onLogout = async () => {
    setSigningOut(true);
    try {
      await logout();
      setUser(null);
      toast.success("Signed out");
      router.replace("/login");
    } catch (e) {
      toast.error("Sign out failed", { description: (e as Error).message });
      setSigningOut(false);
    }
  };

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-4 border-b border-[var(--border)] bg-[var(--bg-0)]/70 px-4 backdrop-blur-xl md:px-6" data-testid="dashboard-topbar">
      <div className="flex flex-1 items-center gap-3">
        <div className="hidden md:block">
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-white/40">{ROLE_LABEL[role]}</div>
          <div className="text-sm font-semibold text-white">{title || "Live Operations"}</div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className="hidden rounded-full border border-[var(--border)] bg-white/[0.02] px-3 py-1.5 md:flex md:items-center md:gap-2">
            <Search className="h-3.5 w-3.5 text-white/40" />
            <input
              placeholder="Search cases, stations, officers…"
              className="w-72 bg-transparent text-xs text-white placeholder:text-white/30 focus:outline-none"
              data-testid="topbar-search-input"
            />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <span className="hidden items-center gap-1.5 rounded-full border border-ok/30 bg-ok/10 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-ok md:inline-flex">
          <Wifi className="h-3 w-3" /> Online
        </span>

        <button
          className="relative rounded-lg border border-[var(--border)] bg-white/[0.02] p-2 text-white/60 transition-colors hover:text-white"
          data-testid="topbar-notifications-button"
        >
          <Bell className="h-4 w-4" />
          <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-pink shadow-[0_0_6px_var(--pink)]" />
        </button>

        <button
          onClick={onLogout}
          disabled={signingOut}
          className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-white/[0.02] px-3 py-2 text-xs text-white/70 transition-colors hover:border-danger/30 hover:bg-danger/5 hover:text-danger disabled:opacity-50"
          data-testid="topbar-logout-button"
        >
          <LogOut className="h-3.5 w-3.5" />
          {signingOut ? "Signing out…" : "Sign out"}
        </button>
      </div>
    </header>
  );
}
