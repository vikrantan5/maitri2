import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { sendMail, stationApprovalEmail } from "@/lib/mail";

export const dynamic = "force-dynamic";

/**
 * POST /api/create-station
 * Body: { requestId: string, approvedBy: string }
 *
 * 1) Reads stationRequests/{requestId}
 * 2) Generates a stationId slug
 * 3) Creates Firebase Auth user (station email + temp password)
 * 4) Sets custom claims { role: "police_station", stationId }
 * 5) Writes policeStations/{stationId} + users/{uid}
 * 6) Marks the request approved
 * 7) Emails credentials to the station OIC
 */
export async function POST(req: NextRequest) {
  try {
    const { requestId, approvedBy } = await req.json();
    if (!requestId) {
      return NextResponse.json({ error: "requestId required" }, { status: 400 });
    }

    // Verify the caller has super_admin claim
        const idToken = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (!idToken) {
      return NextResponse.json({ error: "Authorization required" }, { status: 401 });
    }
    const decoded = await adminAuth.verifyIdToken(idToken).catch(() => null);
    if (!decoded) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }
    if (decoded.role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden — super_admin only" }, { status: 403 });
    }

    const reqRef = adminDb.collection("stationRequests").doc(requestId);
    const snap = await reqRef.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }
    const data = snap.data() || {};
    if (data.status === "approved") {
      return NextResponse.json({ error: "Already approved", stationId: data.stationId }, { status: 400 });
    }

    // Build deterministic stationId
    const state = (data.state || "IN").slice(0, 2).toUpperCase();
    const dist = (data.district || "STN").slice(0, 3).toUpperCase();
    const rand = Math.random().toString(36).slice(2, 7).toUpperCase();
    const stationId = `${state}-${dist}-${rand}`;

    const stationEmail: string = String(data.email || "").trim().toLowerCase();
    if (!stationEmail) {
      return NextResponse.json({ error: "Station email missing on request" }, { status: 400 });
    }

    // Generate temp password
    const tempPassword = `Saheli@${Math.random().toString(36).slice(2, 8)}${Math.floor(
      Math.random() * 90 + 10,
    )}`;

    // Create or fetch Firebase Auth user
    let uid: string;
    try {
      const existing = await adminAuth.getUserByEmail(stationEmail);
      uid = existing.uid;
      // Reset password so we know what it is
      await adminAuth.updateUser(uid, { password: tempPassword, displayName: data.name });
    } catch {
      const created = await adminAuth.createUser({
        email: stationEmail,
        password: tempPassword,
        displayName: data.name,
        emailVerified: true,
      });
      uid = created.uid;
    }

    // Set custom claims
    await adminAuth.setCustomUserClaims(uid, {
      role: "police_station",
      stationId,
    });

    const now = new Date();

    // Create policeStations doc keyed by stationId
    await adminDb
      .collection("policeStations")
      .doc(stationId)
      .set(
        {
          stationId,
          uid,
          name: data.name || "",
          officerInCharge: data.officerInCharge || "",
          phone: data.phone || "",
          email: stationEmail,
          address: data.address || "",
          district: data.district || "",
          state: data.state || "",
          geo: data.geo || null,
          govtVerificationId: data.govtVerificationId || "",
          documents: data.documents || [],
          status: "approved",
          approvedBy: approvedBy || decoded.email || "super_admin",
          approvedAt: now,
          online: false,
          createdAt: data.createdAt || now,
        },
        { merge: true },
      );

    // Mirror role onto users/{uid} so the client side helper finds it
    await adminDb
      .collection("users")
      .doc(uid)
      .set(
        {
          role: "police_station",
          stationId,
          name: data.name,
          email: stationEmail,
          approvedAt: now,
        },
        { merge: true },
      );

    // Update the request
    await reqRef.update({
      status: "approved",
      approvedBy: approvedBy || decoded.email || "super_admin",
      approvedAt: now,
      stationId,
      uid,
    });

    // Activity log
    await adminDb.collection("activityLogs").add({
      actor: approvedBy || decoded.email || "super_admin",
      role: "super_admin",
      action: "station_approved",
      target: stationId,
      at: now,
    });

    // Email credentials
    const loginUrl = new URL("/login", req.nextUrl.origin).toString();
    const mail = await sendMail({
      to: stationEmail,
      subject: `Saheli — Your station "${data.name}" is approved`,
      html: stationApprovalEmail({
        stationName: data.name,
        stationId,
        loginEmail: stationEmail,
        tempPassword,
        loginUrl,
      }),
    });

    return NextResponse.json({
      ok: true,
      stationId,
      uid,
      loginEmail: stationEmail,
      tempPassword,
      emailSent: mail.ok,
      emailError: mail.error,
    });
  } catch (e: unknown) {
    console.error("[create-station] failed", e);
    return NextResponse.json({ error: (e as Error)?.message || "create-station failed" }, { status: 500 });
  }
}
