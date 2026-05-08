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
}

export async function fetchUserRole(uid: string, email: string | null): Promise<SaheliUser> {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    const data = snap.data() as Partial<SaheliUser>;
    return {
      uid,
      email,
      name: data.name,
      role: (data.role as Role) || "police_officer",
      stationId: data.stationId,
    };
  }
  // Fallback: hard-coded super-admin email so first login works without seeding
  const isSeedAdmin = (email || "").toLowerCase() === "vikrantsinghan5@gmail.com";
  return {
    uid,
    email,
    role: isSeedAdmin ? "super_admin" : "police_officer",
  };
}

export async function loginWithEmail(email: string, password: string): Promise<SaheliUser> {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return fetchUserRole(cred.user.uid, cred.user.email);
}

export async function logout() {
  await fbSignOut(auth);
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
