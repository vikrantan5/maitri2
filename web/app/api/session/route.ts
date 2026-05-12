import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

const SESSION_COOKIE = "__session";
const FIVE_DAYS_MS = 60 * 60 * 24 * 5 * 1000;

/**
 * POST /api/session
 * Body: { idToken }
 * Creates a Firebase session cookie from a freshly-issued ID token.
 * The cookie is httpOnly, used by middleware to gate /super-admin /station /officer.
 */
export async function POST(req: NextRequest) {
  try {
    const { idToken } = await req.json();
    if (!idToken) return NextResponse.json({ error: "idToken required" }, { status: 400 });

    const decoded = await adminAuth.verifyIdToken(idToken, true).catch(() => null);
    if (!decoded) return NextResponse.json({ error: "Invalid idToken" }, { status: 401 });

    const sessionCookie = await adminAuth.createSessionCookie(idToken, {
      expiresIn: FIVE_DAYS_MS,
    });

    const res = NextResponse.json({
      ok: true,
      uid: decoded.uid,
      role: decoded.role || null,
      stationId: decoded.stationId || null,
    });
    res.cookies.set(SESSION_COOKIE, sessionCookie, {
      httpOnly: true,
      secure: req.nextUrl.protocol === "https:",
      sameSite: "lax",
      path: "/",
      maxAge: FIVE_DAYS_MS / 1000,
    });
    return res;
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error)?.message || "session failed" }, { status: 500 });
  }
}

/**
 * DELETE /api/session — clears the session cookie.
 */
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set("__session", "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}
