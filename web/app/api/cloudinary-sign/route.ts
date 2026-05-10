import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

export const dynamic = "force-dynamic";

// Returns a signed Cloudinary upload payload. Unauthenticated for now
// (matches the existing FastAPI sign endpoint contract). If a Saheli FastAPI
// backend is reachable via NEXT_PUBLIC_BACKEND_URL we delegate to it; otherwise
// we sign locally using CLOUDINARY_API_SECRET in /app/.env.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const folder = body.folder || "saheli/uploads";
    const upload_preset = body.upload_preset || undefined;
    const public_id = body.public_id || undefined;

    const cloud = process.env.CLOUDINARY_CLOUD_NAME || process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (!cloud || !apiKey || !apiSecret) {
      return NextResponse.json(
        { error: "Cloudinary credentials missing on server" },
        { status: 500 },
      );
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const params: Record<string, string | number> = { folder, timestamp };
    if (upload_preset) params.upload_preset = upload_preset;
    if (public_id) params.public_id = public_id;

    // Build signature: alphabetical join of key=value pairs + apiSecret
    const toSign = Object.keys(params)
      .sort()
      .map((k) => `${k}=${params[k]}`)
      .join("&");
    const signature = crypto
      .createHash("sha1")
      .update(toSign + apiSecret)
      .digest("hex");

    return NextResponse.json({
      cloud_name: cloud,
      api_key: apiKey,
      timestamp,
      folder,
      upload_preset,
      public_id,
      signature,
      upload_url: `https://api.cloudinary.com/v1_1/${cloud}/auto/upload`,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "sign failed" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, service: "cloudinary-sign" });
}
