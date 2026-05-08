"use client";

import { QueryProvider } from "@/components/shared/query-provider";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <QueryProvider>{children}</QueryProvider>;
}
