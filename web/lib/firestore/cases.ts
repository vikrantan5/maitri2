import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { CaseStatus, EmergencyCase, PoliceOfficer, PoliceStation } from "./types";
import { findBroadcastStations } from "@/lib/geo/findNearbyStations";

const COL = "emergencyCases";

/**
 * Custom error thrown when a second station tries to accept a case that
 * was already claimed by a faster responder. Surfaced to the UI so the
 * LiveFeed can swap the "Accept" CTA for an "Already assigned" badge.
 */
export class CaseAlreadyAssignedError extends Error {
  caseId: string;
  assignedStationId: string;
  constructor(caseId: string, assignedStationId: string) {
    super(`Case ${caseId} already assigned to ${assignedStationId}`);
    this.name = "CaseAlreadyAssignedError";
    this.caseId = caseId;
    this.assignedStationId = assignedStationId;
  }
}

/**
 * Idempotently promote a raw `sos_events/{eventId}` doc into a routable
 * `emergencyCases/{caseId}` doc with full BROADCAST metadata:
 *
 *   1) Normalize location & evidence URLs.
 *   2) Find ALL approved police stations within 2km (falling back to 5km
 *      then 10km, then nearest single station) via Haversine.
 *   3) Write the case with:
 *         status            = "broadcasted"
 *         nearbyStationIds  = [<all stations in radius>]
 *         assignedStationId = null
 *         assignedOfficers  = []        ← assigned only when a station accepts
 *         acceptedByStation = false
 *
 *   The first station to call `acceptCase` will atomically lock the case
 *   to itself and auto-assign its approved officers (see `acceptCase`).
 *
 * Safe to call from multiple places concurrently — guarded by a
 * `sourceEventId` uniqueness query at the top.
 */
export async function ensureCaseFromSosEvent(eventId: string, raw: Record<string, any>): Promise<string> {
  const q = query(collection(db, COL), where("sourceEventId", "==", eventId), limit(1));
  const snap = await getDocs(q);
  if (!snap.empty) {
    console.log("[ensureCaseFromSosEvent] case already exists for", eventId);
    return snap.docs[0].id;
  }

  // ----- Location normalization
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
  const location =
    lat != null && lng != null && !Number.isNaN(Number(lat)) && !Number.isNaN(Number(lng))
      ? { lat: Number(lat), lng: Number(lng) }
      : null;

  // ----- Evidence normalization
  const imageUrl = raw.image_url || raw.imageUrl || "";
  const audioUrl = raw.audio_url || raw.audioUrl || "";

  // ----- Multi-station broadcast: all approved stations within radius
  let nearbyStationIds: string[] = [];
  let radiusKmUsed: number | null = null;

  if (location) {
    try {
      const stationsSnap = await getDocs(collection(db, "policeStations"));
      const stations: (PoliceStation & { id: string })[] = stationsSnap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<PoliceStation, "id">),
      }));

      const { hits, radiusKmUsed: r } = findBroadcastStations(location.lat, location.lng, stations);
      radiusKmUsed = r;
      nearbyStationIds = hits
        .map((h) => h.station.stationId || h.station.id)
        .filter((s): s is string => !!s);

      console.log(
        `[ensureCaseFromSosEvent] broadcasting to ${nearbyStationIds.length} station(s) within ${radiusKmUsed ?? "?"}km`,
        nearbyStationIds,
      );
    } catch (e) {
      console.warn("[ensureCaseFromSosEvent] station broadcast lookup failed", e);
    }
  } else {
    console.warn("[ensureCaseFromSosEvent] no location — cannot broadcast (case will need manual admin routing)");
  }

  const now = serverTimestamp();
  const data: Record<string, any> = {
    sourceEventId: eventId,
    userId: raw.user_id || raw.userId || "unknown",
    userName: raw.user_name || raw.userName || "Unknown",
    userPhone: raw.userPhone || raw.user_phone || "",
    location,
    imageUrl,
    audioUrl,
    evidence: {
      image: imageUrl || "",
      audio: audioUrl || "",
      uploadedAt: now,
    },
    status: "broadcasted" as CaseStatus,
    priority: "critical",
    nearbyStationIds,
    radiusKmUsed,
    assignedStationId: null,
    assignedOfficers: [],
    acceptedByStation: false,
    notes: [],
    createdAt: now,
    dispatchedAt: null,
  };

  console.log("[ensureCaseFromSosEvent] creating broadcasted case", {
    eventId,
    hasLocation: !!location,
    hasImage: !!imageUrl,
    hasAudio: !!audioUrl,
    nearbyStationCount: nearbyStationIds.length,
  });

  const created = await addDoc(collection(db, COL), data);
  return created.id;
}

/**
 * First-accept race winner — Firestore transaction-guarded.
 *
 * The first station to call this for a given case wins the dispatch. The
 * transaction:
 *   1) Reads the case.
 *   2) Throws `CaseAlreadyAssignedError` if `assignedStationId` is set.
 *   3) Otherwise writes:
 *        assignedStationId = <this station>
 *        status            = "assigned"
 *        acceptedByStation = true
 *        acceptedAt        = serverTimestamp()
 *
 * After the transaction commits we fetch the station's approved officers
 * and update the case with `assignedOfficers` + `status="dispatched"` so
 * the officer dashboard (`/officer`) shows the case in realtime.
 *
 * Officer fetch happens OUTSIDE the transaction because Firestore txns
 * can only read documents, not run queries.
 */
export async function acceptCase(caseId: string, stationId: string, by: string) {
  const caseRef = doc(db, COL, caseId);

  console.log(`[acceptCase] station ${stationId} attempting to accept case ${caseId}`);

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(caseRef);
    if (!snap.exists()) throw new Error("Case does not exist");
    const data = snap.data() as EmergencyCase;
    if (data.assignedStationId && data.assignedStationId !== stationId) {
      console.warn(`[acceptCase] race lost — case already assigned to ${data.assignedStationId}`);
      throw new CaseAlreadyAssignedError(caseId, data.assignedStationId);
    }
    tx.update(caseRef, {
      assignedStationId: stationId,
      status: "assigned",
      acceptedByStation: true,
      acceptedAt: serverTimestamp(),
      notes: arrayAppendNote(data.notes || [], by, "Case accepted by station."),
    });
  });

  console.log(`[acceptCase] station ${stationId} WON race for case ${caseId}`);

  // ----- Officer fan-out (outside transaction)
  try {
    const offSnap = await getDocs(
      query(
        collection(db, "policeOfficers"),
        where("stationId", "==", stationId),
        where("status", "==", "approved"),
      ),
    );
    const officerUids = offSnap.docs
      .map((d) => (d.data() as PoliceOfficer).uid)
      .filter((u): u is string => !!u);

    if (officerUids.length > 0) {
      await updateDoc(caseRef, {
        assignedOfficers: officerUids,
        status: "dispatched",
        dispatchedAt: serverTimestamp(),
      });
      console.log(`[acceptCase] auto-dispatched ${officerUids.length} officer(s) for ${caseId}`);
    } else {
      console.warn(`[acceptCase] station ${stationId} has no approved officers — case acknowledged but not dispatched`);
    }
  } catch (e) {
    console.warn("[acceptCase] officer auto-dispatch failed (case still assigned)", e);
  }
}

export async function dispatchOfficers(caseId: string, officerUids: string[], by: string) {
  await updateDoc(doc(db, COL, caseId), {
    status: "dispatched",
    assignedOfficers: officerUids,
    dispatchedAt: serverTimestamp(),
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
  return [...existing, { by, text, at: new Date().toISOString() }];
}
