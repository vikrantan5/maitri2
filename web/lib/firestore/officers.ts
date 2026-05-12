import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { PoliceOfficer } from "./types";

const COL = "policeOfficers";
const REQ = "officerRequests";

export async function listOfficersByStation(stationId: string): Promise<PoliceOfficer[]> {
  const snap = await getDocs(query(collection(db, COL), where("stationId", "==", stationId)));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<PoliceOfficer, "id">) }));
}

export async function approveOfficerRequest(requestId: string, by: string) {
  // Read the request document directly by id
  const reqRef = doc(db, REQ, requestId);
  const reqSnap = await getDoc(reqRef);
  if (!reqSnap.exists()) {
    throw new Error("Officer request not found");
  }
  const data = reqSnap.data() as PoliceOfficer & { uid?: string };

  // 1) Create the canonical officer record
  await addDoc(collection(db, COL), {
    ...data,
    status: "approved",
    approvedBy: by,
    approvedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
  });

  // 2) Mark request approved
  await updateDoc(reqRef, {
    status: "approved",
    approvedBy: by,
    approvedAt: serverTimestamp(),
  });

  // 3) Mirror role + stationId onto users/{uid} so the mobile app can detect
  //    "this is an officer" on next login (no Cloud Function required).
  if (data.uid) {
    await setDoc(
      doc(db, "users", data.uid),
      {
        role: "police_officer",
        stationId: data.stationId,
        badgeNumber: data.badgeNumber,
        officerApprovedAt: new Date().toISOString(),
      },
      { merge: true },
    );
  }
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
