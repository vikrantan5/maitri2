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
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { PoliceStation } from "./types";

const COL = "policeStations";
const REQ = "stationRequests";

export async function submitStationRequest(payload: Omit<PoliceStation, "id" | "stationId" | "status">) {
  const data = {
    ...payload,
    status: "pending",
    createdAt: serverTimestamp(),
  };
  const ref = await addDoc(collection(db, REQ), data);
  return ref.id;
}

export async function approveStationRequest(requestId: string, approvedBy: string) {
  const reqRef = doc(db, REQ, requestId);
  const snap = await getDoc(reqRef);
  if (!snap.exists()) throw new Error("Request not found");
  const data = snap.data() as PoliceStation;

  // Generate station ID slug e.g. MH-MUM-9X3KL
  const stationId =
    `${(data.state || "IN").slice(0, 2).toUpperCase()}-${(data.district || "STN").slice(0, 3).toUpperCase()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

  // Use setDoc so the document id is the stationId (deterministic, joinable)
  await setDoc(doc(db, COL, stationId), {
    ...data,
    stationId,
    status: "approved",
    approvedBy,
    approvedAt: serverTimestamp(),
    online: false,
    qrCodeUrl: `${typeof window !== "undefined" ? window.location.origin : ""}/api/station-qr/${stationId}`,
  });

  await updateDoc(reqRef, {
    status: "approved",
    approvedBy,
    approvedAt: serverTimestamp(),
    stationId,
  });

  return stationId;
}

export async function rejectStationRequest(requestId: string, by: string, reason?: string) {
  await updateDoc(doc(db, REQ, requestId), {
    status: "rejected",
    rejectedBy: by,
    rejectedAt: serverTimestamp(),
    rejectionReason: reason || "",
  });
}

export async function suspendStation(stationId: string) {
  // stationId here is the doc id from policeStations listing
  await updateDoc(doc(db, COL, stationId), { status: "suspended" });
}

export async function listAllStations(): Promise<PoliceStation[]> {
  const snap = await getDocs(query(collection(db, COL)));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<PoliceStation, "id">) }));
}
