"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  BadgeCheck,
  BarChart3,
  Building2,
  ChevronLeft,
  Flame,
  LayoutDashboard,
  Map,
  QrCode,
  Settings,
  Shield,
  Siren,
  UserCog,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Role } from "@/lib/auth";

const NAV: Record<Role, { label: string; href: string; icon: any }[]> = {
  super_admin: [
    { label: "Overview", href: "/super-admin", icon: LayoutDashboard },
    { label: "Stations", href: "/super-admin/stations", icon: Building2 },
    { label: "Approvals", href: "/super-admin/stations/requests", icon: BadgeCheck },
    { label: "Users", href: "/super-admin/users", icon: Users },
    { label: "Emergencies", href: "/super-admin/emergencies", icon: Siren },
    { label: "Analytics", href: "/super-admin/analytics", icon: BarChart3 },
    { label: "Heatmap", href: "/super-admin/heatmap", icon: Flame },
    { label: "Settings", href: "/super-admin/settings", icon: Settings },
  ],
  police_station: [
    { label: "Command Center", href: "/station", icon: Siren },
    { label: "Officers", href: "/station/officers", icon: UserCog },
    { label: "Onboard QR", href: "/station/officers/qr", icon: QrCode },
    { label: "Live Map", href: "/station/live-map", icon: Map },
    { label: "Incidents", href: "/station/incidents", icon: Activity },
    { label: "Profile", href: "/station/profile", icon: Settings },
  ],
  police_officer: [
    { label: "My Cases", href: "/officer", icon: AlertTriangle },
  ],
};

export function Sidebar({ role, userName }: { role: Role; userName?: string }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  const items = NAV[role];

  return (
    <motion.aside
      animate={{ width: collapsed ? 76 : 248 }}
      transition={{ type: "spring", stiffness: 220, damping: 28 }}
      className="sticky top-0 z-30 hidden h-screen shrink-0 border-r border-[var(--border)] bg-[var(--bg-1)]/60 backdrop-blur-xl md:flex md:flex-col"
      data-testid="dashboard-sidebar"
    >
      <div className={cn("flex items-center gap-3 px-5 py-5", collapsed && "justify-center px-2")}>
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-cyan to-pink shadow-[0_0_24px_-6px_var(--cyan)]">
          <Shield className="h-5 w-5 text-bg0" strokeWidth={2.4} />
        </div>
        {!collapsed && (
          <div>
            <div className="font-mono text-[11px] uppercase tracking-[0.3em] text-white/40">SAHELI</div>
            <div className="text-sm font-semibold text-white">Operations</div>
          </div>
        )}
      </div>

      <nav className="flex-1 space-y-1 px-3 py-2">
        {items.map((item) => {
          const active = pathname === item.href || (item.href !== "/super-admin" && item.href !== "/station" && pathname?.startsWith(item.href));
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              data-testid={`sidebar-link-${item.label.toLowerCase().replace(/s+/g, "-")}`}
              className={cn(
                "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all",
                active
                  ? "bg-gradient-to-r from-cyan/15 to-pink/10 text-white shadow-[inset_0_0_0_1px_var(--border-hi)]"
                  : "text-white/55 hover:bg-white/[0.03] hover:text-white",
                collapsed && "justify-center px-0",
              )}
            >
              <Icon className={cn("h-4 w-4 shrink-0", active ? "text-cyan" : "")} />
              {!collapsed && <span className="truncate">{item.label}</span>}
              {!collapsed && active && (
                <span className="ml-auto h-1.5 w-1.5 rounded-full bg-cyan shadow-[0_0_8px_var(--cyan)]" />
              )}
            </Link>
          );
        })}
      </nav>

      <div className={cn("border-t border-[var(--border)] p-4", collapsed && "p-2")}>
        {!collapsed && (
          <div className="mb-3">
            <div className="text-[10px] uppercase tracking-[0.18em] text-white/40">Signed in as</div>
            <div className="mt-1 truncate text-sm font-medium text-white">{userName || "Operator"}</div>
            <div className="mt-0.5 inline-flex rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.2em] text-white/60">
              {role.replace("_", " ")}
            </div>
          </div>
        )}
        <button
          onClick={() => setCollapsed((v) => !v)}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-[var(--border)] bg-white/[0.02] py-2 text-[11px] uppercase tracking-[0.16em] text-white/50 transition-colors hover:text-white"
          data-testid="sidebar-toggle-button"
        >
          <ChevronLeft className={cn("h-3.5 w-3.5 transition-transform", collapsed && "rotate-180")} />
          {!collapsed && "Collapse"}
        </button>
      </div>
    </motion.aside>
  );
}
