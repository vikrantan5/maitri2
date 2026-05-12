import {
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  onAuthStateChanged,
  type User,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "./firebase";

export type Role = "super_admin" | "police_station" | "police_officer";

export interface SaheliUser {
  uid: string;
  email: string | null;
  name?: string;
  role: Role;
  stationId?: string;
  officerId?: string;
}

const SUPER_ADMIN_EMAILS = [
  (process.env.NEXT_PUBLIC_SUPER_ADMIN_EMAIL || "admin@saheli.com").toLowerCase(),
  "admin@saheli.com",
];

/**
 * Resolve the user's role using:
 *   1) Firebase custom claims (priority)
 *   2) Firestore users/{uid}
 *   3) Hardcoded super-admin email fallback
 */
export async function fetchUserRole(uid: string, email: string | null): Promise<SaheliUser> {
  // 1) Try refreshing the token and reading claims
  let claimsRole: Role | null = null;
  let claimsStation: string | undefined;
  let claimsOfficer: string | undefined;

  try {
    const cu = auth.currentUser;
    if (cu) {
      const tok = await cu.getIdTokenResult(true);
      const r = (tok.claims.role as Role) || null;
      if (r === "super_admin" || r === "police_station" || r === "police_officer") {
        claimsRole = r;
      }
      if (typeof tok.claims.stationId === "string") claimsStation = tok.claims.stationId;
      if (typeof tok.claims.officerId === "string") claimsOfficer = tok.claims.officerId;
    }
  } catch (e) {
    console.warn("[auth] claim read failed", e);
  }

  // 2) Firestore mirror
  let fsName: string | undefined;
  try {
    const snap = await getDoc(doc(db, "users", uid));
    if (snap.exists()) {
      const data = snap.data() as {
        role?: Role;
        stationId?: string;
        officerId?: string;
        name?: string;
        isAdmin?: boolean;
      };
      fsName = data.name;
      if (!claimsRole && data.role) claimsRole = data.role;
      if (!claimsRole && data.isAdmin) claimsRole = "super_admin";
      if (!claimsStation && data.stationId) claimsStation = data.stationId;
      if (!claimsOfficer && data.officerId) claimsOfficer = data.officerId;
    }
  } catch (e) {
    console.warn("[auth] firestore lookup failed", e);
  }

  // 3) Hardcoded admin fallback so first login works
  if (!claimsRole && email && SUPER_ADMIN_EMAILS.includes(email.toLowerCase())) {
    claimsRole = "super_admin";
  }

  return {
    uid,
    email,
    name: fsName,
    role: claimsRole || "police_officer",
    stationId: claimsStation,
    officerId: claimsOfficer,
  };
}

async function bootstrapSuperAdmin(email: string) {
  // Idempotent — seed runs server-side and only acts when the admin
  // doesn't yet exist or its claim is missing. Fires only for the configured email.
  try {
    if (email.toLowerCase() !== "admin@saheli.com") return;
    await fetch("/api/seed-admin", { method: "POST" });
  } catch (e) {
    console.warn("[auth] seed-admin fetch failed", e);
  }
}

async function setServerSession(idToken: string) {
  try {
    await fetch("/api/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    });
  } catch (e) {
    console.warn("[auth] server session set failed", e);
  }
}

export async function loginWithEmail(email: string, password: string): Promise<SaheliUser> {
  // First seed admin so the super-admin row exists in claims+users before our login lookup
  await bootstrapSuperAdmin(email);

  const cred = await signInWithEmailAndPassword(auth, email, password);

  // Force refresh to pull just-seeded claims
  const idToken = await cred.user.getIdToken(true);
  await setServerSession(idToken);

  return fetchUserRole(cred.user.uid, cred.user.email);
}

export async function refreshClaimsAndSession() {
  const cu = auth.currentUser;
  if (!cu) return null;
  const idToken = await cu.getIdToken(true);
  await setServerSession(idToken);
  return fetchUserRole(cu.uid, cu.email);
}

export async function logout() {
  await fbSignOut(auth);
  try {
    await fetch("/api/logout", { method: "POST" });
  } catch {
    /* noop */
  }
}

export function watchAuth(cb: (user: User | null) => void) {
  return onAuthStateChanged(auth, cb);
}

export function landingFor(role: Role): string {
  switch (role) {
    case "super_admin":
      return "/super-admin";
    case "police_station":
      return "/station";
    default:
      return "/officer";
  }
}
