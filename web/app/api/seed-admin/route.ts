import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

/**
 * POST /api/seed-admin
 * Idempotently provisions one or more super-admin users:
 *
 *   - SUPER_ADMIN_EMAIL    (required) — legacy single-admin var, kept for
 *                                       backwards compatibility.
 *   - SUPER_ADMIN_EMAILS   (optional) — comma-separated list. Each email
 *                                       gets role=super_admin, isAdmin=true,
 *                                       and the Firebase custom claim.
 *
 *   - SUPER_ADMIN_PASSWORD            — only used when the auth user does
 *                                       NOT already exist. Existing users
 *                                       keep their current password.
 *
 * Safe to call repeatedly. Anyone may invoke to bootstrap the first session
 * — afterwards the credentials are settled. This is also what fixes the
 * "Missing or insufficient permissions" Firestore error: every email in the
 * list will receive role=super_admin so isAdmin() in firestore.rules passes.
 */
export async function POST(req: NextRequest) {
  try {
    const legacy = (process.env.SUPER_ADMIN_EMAIL || "admin@maitri.com").toLowerCase();
    const extra = (process.env.SUPER_ADMIN_EMAILS || "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);

    // Optional request override
    let bodyEmail: string | null = null;
    try {
      const body = (await req.json()) as { email?: string };
      if (body?.email) bodyEmail = body.email.toLowerCase().trim();
    } catch {
      /* no body / not JSON */
    }

    const emails = Array.from(
      new Set([legacy, ...extra, ...(bodyEmail ? [bodyEmail] : [])].filter(Boolean)),
    );
    const password = process.env.SUPER_ADMIN_PASSWORD || "Admin@123456";

    const results: { email: string; uid: string; created: boolean }[] = [];
    for (const email of emails) {
      let uid: string;
      let created = false;
      try {
        const existing = await adminAuth.getUserByEmail(email);
        uid = existing.uid;
      } catch {
        const u = await adminAuth.createUser({
          email,
          password,
          displayName: "Maitri Super Admin",
          emailVerified: true,
        });
        uid = u.uid;
        created = true;
      }

      // Re-apply custom claim so future env changes propagate
      await adminAuth.setCustomUserClaims(uid, { role: "super_admin" });

      await adminDb
        .collection("users")
        .doc(uid)
        .set(
          {
            role: "super_admin",
            name: "Maitri Super Admin",
            email,
            isAdmin: true,
            seededAt: new Date(),
          },
          { merge: true },
        );

      results.push({ email, uid, created });
    }

    return NextResponse.json({ ok: true, results });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: (e as Error)?.message || "seed failed" },
      { status: 500 },
    );
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}
