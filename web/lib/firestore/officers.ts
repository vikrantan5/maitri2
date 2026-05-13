import {
   addDoc,
  collection,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
  doc,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import type { PoliceOfficer } from "./types";

const COL = "policeOfficers";
const REQ = "officerRequests";

export async function listOfficersByStation(stationId: string): Promise<PoliceOfficer[]> {
  const snap = await getDocs(query(collection(db, COL), where("stationId", "==", stationId)));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<PoliceOfficer, "id">) }));
}

/**
 * Approve a pending officer request.
 *
 * IMPORTANT: All privileged writes (auth user creation, custom claims,
 * users/{uid} role assignment) MUST happen on the server. This client
 * helper therefore just forwards the call to the secure API route which
 * uses the Firebase Admin SDK. Doing these writes from the client would
 * fail with "Missing or insufficient permissions" because Firestore rules
 * (correctly) forbid stations from mutating arbitrary users/{uid} docs.
 */
export async function approveOfficerRequest(requestId: string, by: string) {
  const user = auth.currentUser;
  if (!user) {
    throw new Error("Not signed in");
  }

  // Refresh token first so custom claims (role: police_station, stationId)
  // are up to date for the server middleware/check.
  const idToken = await user.getIdToken(true);

  console.log("[approve-officer] calling /api/create-officer", requestId);
  const res = await fetch("/api/create-officer", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ requestId, approvedBy: by }),
  });

  let body: any = {};
  try {
    body = await res.json();
  } catch {
    /* non-JSON */
  }

  if (!res.ok || body?.error) {
    console.error("[approve-officer] API route failed", res.status, body);
    throw new Error(body?.error || `Approval failed (${res.status})`);
  }

  console.log("[approve-officer] success", body);
  return body as {
    ok: true;
    officerId: string;
    uid: string;
    loginEmail: string;
    tempPassword: string;
    emailSent: boolean;
    emailError?: string;
  };
}
export async function rejectOfficerRequest(requestId: string, by: string, reason?: string) {
  await updateDoc(doc(db, REQ, requestId), {
    status: "rejected",
    rejectedBy: by,
    rejectedAt: serverTimestamp(),
    rejectionReason: reason || "",
  });
}

export async function submitOfficerRequest(payload: Omit<PoliceOfficer, "id" | "status">) {
  const data = {
    ...payload,
    status: "pending",
    createdAt: serverTimestamp(),
  };
  const ref = await addDoc(collection(db, REQ), data);
  return ref.id;
}
