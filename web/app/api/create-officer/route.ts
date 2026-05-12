import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { sendMail, officerApprovalEmail } from "@/lib/mail";

export const dynamic = "force-dynamic";

/**
 * POST /api/create-officer
 * Body: { requestId: string, approvedBy: string }
 *
 * Caller MUST be authenticated as either police_station (for their own station)
 * or super_admin.
 */
export async function POST(req: NextRequest) {
  try {
    const { requestId, approvedBy } = await req.json();
    if (!requestId) {
      return NextResponse.json({ error: "requestId required" }, { status: 400 });
    }

    const idToken = req.headers.get("authorization")?.replace(/^Bearers+/i, "");
    if (!idToken) {
      return NextResponse.json({ error: "Authorization required" }, { status: 401 });
    }
    const decoded = await adminAuth.verifyIdToken(idToken).catch(() => null);
    if (!decoded) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const callerRole = decoded.role;
    const callerStationId = decoded.stationId as string | undefined;
    if (callerRole !== "police_station" && callerRole !== "super_admin") {
      return NextResponse.json({ error: "Forbidden — station or super_admin only" }, { status: 403 });
    }

    const reqRef = adminDb.collection("officerRequests").doc(requestId);
    const snap = await reqRef.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Officer request not found" }, { status: 404 });
    }
    const data = snap.data() || {};
    if (data.status === "approved") {
      return NextResponse.json({ error: "Already approved" }, { status: 400 });
    }

    const reqStationId: string = data.stationId || "";
    if (callerRole === "police_station" && callerStationId !== reqStationId) {
      return NextResponse.json(
        { error: "Forbidden — request belongs to a different station" },
        { status: 403 },
      );
    }

    // Pick an officer email. If officer registered with email use that;
    // otherwise generate one from badge.
    const stationSlug = reqStationId.toLowerCase().replace(/[^a-z0-9]+/g, "");
    const badgeSlug = String(data.badgeNumber || "officer").toLowerCase().replace(/[^a-z0-9]+/g, "");
    const officerEmail: string = (data.email && String(data.email).trim().toLowerCase()) ||
      `officer-${badgeSlug}-${stationSlug}@saheli.local`;
    const tempPassword = `Saheli@${Math.random().toString(36).slice(2, 8)}${Math.floor(
      Math.random() * 90 + 10,
    )}`;

    // Create or reuse Firebase Auth user
    let uid: string;
    try {
      const existing = await adminAuth.getUserByEmail(officerEmail);
      uid = existing.uid;
      await adminAuth.updateUser(uid, {
        password: tempPassword,
        displayName: data.name,
      });
    } catch {
      const created = await adminAuth.createUser({
        email: officerEmail,
        password: tempPassword,
        displayName: data.name,
        emailVerified: true,
      });
      uid = created.uid;
    }

    // Determine officerId
    const officerId = data.officerId || `OF-${stationSlug.toUpperCase().slice(0, 6)}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

    // Set claims
    await adminAuth.setCustomUserClaims(uid, {
      role: "police_officer",
      stationId: reqStationId,
      officerId,
    });

    const now = new Date();
    await adminDb.collection("policeOfficers").doc(officerId).set(
      {
        officerId,
        uid,
        stationId: reqStationId,
        name: data.name || "",
        badgeNumber: data.badgeNumber || "",
        phone: data.phone || "",
        email: officerEmail,
        rank: data.rank || "",
        status: "approved",
        online: false,
        approvedBy: approvedBy || decoded.email || "station",
        approvedAt: now,
        createdAt: data.createdAt || now,
      },
      { merge: true },
    );

    await adminDb.collection("users").doc(uid).set(
      {
        role: "police_officer",
        stationId: reqStationId,
        officerId,
        badgeNumber: data.badgeNumber || "",
        name: data.name,
        email: officerEmail,
        approvedAt: now,
      },
      { merge: true },
    );

    await reqRef.update({
      status: "approved",
      approvedBy: approvedBy || decoded.email || "station",
      approvedAt: now,
      uid,
      officerId,
    });

    await adminDb.collection("activityLogs").add({
      actor: approvedBy || decoded.email || "station",
      role: callerRole,
      action: "officer_approved",
      target: officerId,
      stationId: reqStationId,
      at: now,
    });

    // Send email if officer provided one (skip our generated @saheli.local fallback)
    let emailSent = false;
    let emailError: string | undefined;
    if (data.email && /^[^@]+@[^@]+.[^@]+$/.test(data.email)) {
      const loginUrl = new URL("/login", req.nextUrl.origin).toString();
      const m = await sendMail({
        to: officerEmail,
        subject: "Saheli — You've been onboarded as a Police Officer",
        html: officerApprovalEmail({
          officerName: data.name || "Officer",
          stationId: reqStationId,
          loginEmail: officerEmail,
          tempPassword,
          loginUrl,
        }),
      });
      emailSent = m.ok;
      emailError = m.error;
    }

    return NextResponse.json({
      ok: true,
      officerId,
      uid,
      loginEmail: officerEmail,
      tempPassword,
      emailSent,
      emailError,
    });
  } catch (e: unknown) {
    console.error("[create-officer] failed", e);
    return NextResponse.json({ error: (e as Error)?.message || "create-officer failed" }, { status: 500 });
  }
}
