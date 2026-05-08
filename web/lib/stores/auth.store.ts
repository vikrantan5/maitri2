"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { SaheliUser } from "@/lib/auth";

interface AuthState {
  user: SaheliUser | null;
  hydrated: boolean;
  setUser: (u: SaheliUser | null) => void;
  setHydrated: (h: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      hydrated: false,
      setUser: (user) => set({ user }),
      setHydrated: (hydrated) => set({ hydrated }),
    }),
    {
      name: "saheli-auth",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
