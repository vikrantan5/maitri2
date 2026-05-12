import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { CaseStatus, EmergencyCase } from "./types";

const COL = "emergencyCases";

export async function ensureCaseFromSosEvent(eventId: string, raw: Record<string, any>): Promise<string> {
  // Idempotent — if a case for this sourceEventId exists, return it
  const q = query(collection(db, COL), where("sourceEventId", "==", eventId), limit(1));
  const snap = await getDocs(q);
  if (!snap.empty) return snap.docs[0].id;

  // The mobile app writes sos_events with a nested object:
  //   location: { latitude, longitude, timestamp }
  // Earlier schemas used flat latitude/longitude. Support both, and also the
  // canonical { lat, lng } shape if anyone wrote it directly.
  const lat =
    raw?.location?.lat ??
    raw?.location?.latitude ??
    raw?.latitude ??
    null;
  const lng =
    raw?.location?.lng ??
    raw?.location?.longitude ??
    raw?.longitude ??
    null;

  const data: Record<string, any> = {
    sourceEventId: eventId,
    userId: raw.user_id || raw.userId || "unknown",
    userName: raw.user_name || raw.userName || "Unknown",
    userPhone: raw.userPhone || raw.user_phone || "",
    location:
      lat != null && lng != null
        ? { lat: Number(lat), lng: Number(lng) }
        : null,
    imageUrl: raw.image_url || raw.imageUrl || "",
    audioUrl: raw.audio_url || raw.audioUrl || "",
    status: "new" as CaseStatus,
    priority: "high",
    assignedStationId: null,
    assignedOfficers: [],
    notes: [],
    createdAt: serverTimestamp(),
  };

  console.log("[ensureCaseFromSosEvent] promoting sos_event", eventId, {
    hasLocation: !!data.location,
    hasImage: !!data.imageUrl,
    hasAudio: !!data.audioUrl,
  });

  const created = await addDoc(collection(db, COL), data);
  return created.id;
}

export async function acceptCase(caseId: string, stationId: string, by: string) {
  await updateDoc(doc(db, COL, caseId), {
    status: "acknowledged",
    assignedStationId: stationId,
    acceptedAt: serverTimestamp(),
    notes: arrayAppendNote([], by, "Case accepted by station."),
  });
}

export async function dispatchOfficers(caseId: string, officerUids: string[], by: string) {
  await updateDoc(doc(db, COL, caseId), {
    status: "dispatched",
    assignedOfficers: officerUids,
    notes: arrayAppendNote([], by, `Dispatched ${officerUids.length} officer(s).`),
  });
}

export async function setCaseStatus(caseId: string, status: CaseStatus, by: string, note?: string) {
  const updates: Record<string, any> = { status };
  if (status === "resolved" || status === "false_alarm") {
    updates.resolvedAt = serverTimestamp();
  }
  if (note) updates.notes = arrayAppendNote([], by, note);
  await updateDoc(doc(db, COL, caseId), updates);
}

export async function getCase(caseId: string): Promise<EmergencyCase | null> {
  const ref = doc(db, COL, caseId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as Omit<EmergencyCase, "id">) };
}

function arrayAppendNote(existing: any[], by: string, text: string) {
  // Firestore can't atomically append to a sub-object array in updateDoc easily without arrayUnion,
  // and notes contain serverTimestamp which arrayUnion can't process. Caller can read+write if needed.
  return [...existing, { by, text, at: new Date().toISOString() }];
}
