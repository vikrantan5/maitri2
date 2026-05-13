"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, query } from "firebase/firestore";
import { Users, Search } from "lucide-react";
import { db } from "@/lib/firebase";
import { DashboardShell } from "@/components/dashboard/shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";

interface UserRow {
  id: string;
  name?: string;
  email?: string;
  phone?: string;
  role?: string;
  isAdmin?: boolean;
}

export default function UsersPage() {
  const [items, setItems] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDocs(query(collection(db, "users")));
        setItems(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<UserRow, "id">) })));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = items.filter((u) =>
    [u.name, u.email, u.phone, u.role].filter(Boolean).join(" ").toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <DashboardShell allow={["super_admin"]} title="Users">
      <div className="space-y-6" data-testid="users-page">
        <header className="flex items-end justify-between gap-3">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-cyan/70">Identity</div>
            <h1 className="text-3xl font-semibold text-white">Maitri Users</h1>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-[var(--border)] bg-white/[0.02] px-3">
            <Search className="h-3.5 w-3.5 text-white/40" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="h-9 w-72 border-0 bg-transparent px-2 focus-visible:bg-transparent"
              placeholder="Search users…"
              data-testid="users-search-input"
            />
          </div>
        </header>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4 text-cyan" /> {filtered.length} users
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="py-8 text-center text-xs text-white/40">Loading…</div>
            ) : filtered.length === 0 ? (
              <EmptyState icon={Users} title="No users found" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border)] text-left">
                      <Th>Name</Th>
                      <Th>Email</Th>
                      <Th>Phone</Th>
                      <Th>Role</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.slice(0, 200).map((u) => (
                      <tr key={u.id} className="border-b border-white/[0.04] transition-colors hover:bg-white/[0.02]" data-testid={`user-row-${u.id}`}>
                        <Td className="font-medium text-white">{u.name || "—"}</Td>
                        <Td>{u.email || "—"}</Td>
                        <Td className="font-mono text-[12px]">{u.phone || "—"}</Td>
                        <Td>
                          <Badge variant={u.isAdmin ? "pink" : "outline"}>
                            {u.isAdmin ? "admin" : u.role || "user"}
                          </Badge>
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-3 py-2 text-[10px] font-medium uppercase tracking-[0.18em] text-white/40">{children}</th>;
}
function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-3 text-white/80 ${className}`}>{children}</td>;
}
