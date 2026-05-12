import { NextResponse, type NextRequest } from "next/server";

/**
 * Lightweight edge middleware:
 *   - If __session cookie is missing on a protected route → redirect /login
 *   - Cookie validity (and role gating) is enforced by RoleGuard on the client
 *     and by server API routes that verify the ID token.
 *
 * We DON'T import firebase-admin here because the edge runtime can't run it.
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Protected paths
  const isProtected =
    pathname.startsWith("/super-admin") ||
    pathname.startsWith("/station") ||
    pathname.startsWith("/officer");

  if (!isProtected) return NextResponse.next();

  const session = req.cookies.get("__session")?.value;
  if (!session) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("from", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/super-admin/:path*", "/station/:path*", "/officer/:path*"],
};
