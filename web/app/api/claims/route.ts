import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

/**
 * POST /api/claims
 * Body: { uid: string, role: "super_admin" | "police_station" | "police_officer",
 *         stationId?: string, officerId?: string }
 *
 * Sets Firebase custom claims and mirrors role onto users/{uid}.
 * Caller MUST be authenticated as super_admin.
 *
 * GET /api/claims — returns current caller's decoded claims (for debug).
 */
export async function POST(req: NextRequest) {
  try {
     const idToken = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (!idToken) {
      return NextResponse.json({ error: "Authorization required" }, { status: 401 });
    }
    const decoded = await adminAuth.verifyIdToken(idToken).catch(() => null);
    if (!decoded || decoded.role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden — super_admin only" }, { status: 403 });
    }

    const { uid, role, stationId, officerId } = await req.json();
    if (!uid || !role) {
      return NextResponse.json({ error: "uid and role required" }, { status: 400 });
    }
    if (!["super_admin", "police_station", "police_officer"].includes(role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }

    const claims: Record<string, unknown> = { role };
    if (stationId) claims.stationId = stationId;
    if (officerId) claims.officerId = officerId;

    await adminAuth.setCustomUserClaims(uid, claims);
    await adminDb.collection("users").doc(uid).set(
      { role, stationId: stationId || null, officerId: officerId || null },
      { merge: true },
    );

    return NextResponse.json({ ok: true, uid, claims });
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error)?.message || "claims failed" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
   const idToken = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (!idToken) return NextResponse.json({ error: "Authorization required" }, { status: 401 });
    const decoded = await adminAuth.verifyIdToken(idToken).catch(() => null);
    if (!decoded) return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    return NextResponse.json({
      uid: decoded.uid,
      email: decoded.email,
      role: decoded.role || null,
      stationId: decoded.stationId || null,
      officerId: decoded.officerId || null,
    });
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error)?.message }, { status: 500 });
  }
}
