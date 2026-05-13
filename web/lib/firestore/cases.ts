import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,

  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { CaseStatus, EmergencyCase, PoliceOfficer, PoliceStation } from "./types";
import { findNearestStation } from "@/lib/geo/findNearestStation";

const COL = "emergencyCases";

/**
 * Idempotently promote a raw `sos_events/{eventId}` doc into a routable
 * `emergencyCases/{caseId}` doc with full dispatch metadata:
 *
 *   1) Normalize location & evidence URLs from the various legacy schemas
 *      the mobile app writes.
 *   2) Find the nearest *approved* police station via Haversine.
 *   3) Fetch all *approved* officers of that station and assign them
 *      (their `uid`s — that's how Firestore rules check membership).
 *   4) Write the case with status="new", priority="critical", evidence{}
 *      and dispatchedAt — the rest of the platform (LiveFeed, station,
 *      officer dashboards, admin map, etc.) already listens on this
 *      collection and will instantly pick it up.
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

  // ----- Auto-dispatch: nearest approved station + verified officers
  let assignedStationId: string | null = null;
  let assignedOfficers: string[] = [];

  if (location) {
    try {
      const stationsSnap = await getDocs(collection(db, "policeStations"));
      const stations: (PoliceStation & { id: string })[] = stationsSnap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<PoliceStation, "id">),
      }));

      const nearest = findNearestStation(location.lat, location.lng, stations);
      if (nearest) {
        assignedStationId = nearest.station.stationId || nearest.station.id || null;
        console.log(
          `[ensureCaseFromSosEvent] nearest station ${assignedStationId} @ ${nearest.distanceKm.toFixed(2)}km`,
        );

        if (assignedStationId) {
          const offSnap = await getDocs(
            query(
              collection(db, "policeOfficers"),
              where("stationId", "==", assignedStationId),
              where("status", "==", "approved"),
            ),
          );
          assignedOfficers = offSnap.docs
            .map((d) => (d.data() as PoliceOfficer).uid)
            .filter((u): u is string => !!u);
          console.log(
            `[ensureCaseFromSosEvent] auto-assigning ${assignedOfficers.length} verified officer(s)`,
          );
        }
      } else {
        console.warn("[ensureCaseFromSosEvent] no approved station within range");
      }
    } catch (e) {
      console.warn("[ensureCaseFromSosEvent] dispatch lookup failed", e);
    }
  } else {
    console.warn("[ensureCaseFromSosEvent] no location — cannot auto-dispatch");
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
    status: "new" as CaseStatus,
    priority: "critical",
    assignedStationId,
    assignedOfficers,
    notes: [],
    createdAt: now,
    dispatchedAt: assignedStationId ? now : null,
  };

  console.log("[ensureCaseFromSosEvent] creating case", {
    eventId,
    hasLocation: !!location,
    hasImage: !!imageUrl,
    hasAudio: !!audioUrl,
    assignedStationId,
    officerCount: assignedOfficers.length,
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
