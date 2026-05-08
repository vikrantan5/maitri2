"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { fetchUserRole, type Role } from "@/lib/auth";
import { useAuthStore } from "@/lib/stores/auth.store";

export function RoleGuard({
  allow,
  children,
}: {
  allow: Role[];
  children: React.ReactNode;
}) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const setHydrated = useAuthStore((s) => s.setHydrated);
  const hydrated = useAuthStore((s) => s.hydrated);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      if (!fbUser) {
        setUser(null);
        setHydrated(true);
        router.replace("/login");
        return;
      }
      const u = await fetchUserRole(fbUser.uid, fbUser.email);
      setUser(u);
      setHydrated(true);
      if (!allow.includes(u.role)) {
        // Wrong role → bounce to their landing
        const map: Record<Role, string> = {
          super_admin: "/super-admin",
          police_station: "/station",
          police_officer: "/officer",
        };
        router.replace(map[u.role]);
      }
    });
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!hydrated || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="font-mono text-[11px] uppercase tracking-[0.3em] text-white/40">
          Authenticating…
        </div>
      </div>
    );
  }

  if (!allow.includes(user.role)) {
    return null;
  }

  return <>{children}</>;
}
