import {
  addDoc,
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
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
  // Move request to officers collection
  const docs = await getDocs(query(collection(db, REQ), where("__name__", "==", requestId)));
  if (docs.empty) {
    // fallback by id
    await updateDoc(doc(db, REQ, requestId), { status: "approved", approvedBy: by, approvedAt: serverTimestamp() });
    return;
  }
  const reqDoc = docs.docs[0];
  const data = reqDoc.data() as PoliceOfficer;
  await addDoc(collection(db, COL), {
    ...data,
    status: "approved",
    approvedBy: by,
    approvedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
  });
  await updateDoc(doc(db, REQ, requestId), {
    status: "approved",
    approvedBy: by,
    approvedAt: serverTimestamp(),
  });
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
