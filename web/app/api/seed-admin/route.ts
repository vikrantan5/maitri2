import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

/**
 * POST /api/seed-admin
 * Idempotently provisions the super-admin user using SUPER_ADMIN_EMAIL /
 * SUPER_ADMIN_PASSWORD from env. Safe to call repeatedly. Anyone may invoke
 * to bootstrap the first session — afterwards the password is settled.
 *
 * The seeded admin:
 *  - exists in Firebase Auth
 *  - has custom claim { role: "super_admin" }
 *  - has users/{uid} mirrored with role
 */
export async function POST(_req: NextRequest) {
  try {
    const email = (process.env.SUPER_ADMIN_EMAIL || "admin@saheli.com").toLowerCase();
    const password = process.env.SUPER_ADMIN_PASSWORD || "Admin@123456";

    let uid: string;
    let created = false;
    try {
      const existing = await adminAuth.getUserByEmail(email);
      uid = existing.uid;
    } catch {
      const u = await adminAuth.createUser({
        email,
        password,
        displayName: "Saheli Super Admin",
        emailVerified: true,
      });
      uid = u.uid;
      created = true;
    }

    // Always re-apply claim so future env changes propagate
    await adminAuth.setCustomUserClaims(uid, { role: "super_admin" });

    await adminDb
      .collection("users")
      .doc(uid)
      .set(
        {
          role: "super_admin",
          name: "Saheli Super Admin",
          email,
          isAdmin: true,
          seededAt: new Date(),
        },
        { merge: true },
      );

    return NextResponse.json({ ok: true, uid, email, created });
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error)?.message || "seed failed" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}
