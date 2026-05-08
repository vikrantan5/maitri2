"use client";

import { Sidebar } from "@/components/dashboard/sidebar";
import { Topbar } from "@/components/dashboard/topbar";
import { RoleGuard } from "@/components/auth/role-guard";
import { useAuthStore } from "@/lib/stores/auth.store";
import type { Role } from "@/lib/auth";

export function DashboardShell({
  allow,
  title,
  children,
}: {
  allow: Role[];
  title?: string;
  children: React.ReactNode;
}) {
  const user = useAuthStore((s) => s.user);
  return (
    <RoleGuard allow={allow}>
      <div className="flex min-h-screen">
        <Sidebar role={user?.role ?? allow[0]} userName={user?.name || user?.email || undefined} />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar role={user?.role ?? allow[0]} title={title} />
          <main className="flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
        </div>
      </div>
    </RoleGuard>
  );
}
