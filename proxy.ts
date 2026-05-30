import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Always allow static files and system paths
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/icons") ||
    pathname.startsWith("/manifest") ||
    pathname.startsWith("/sw.js") ||
    pathname.startsWith("/workbox") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  // Auth pages must stay reachable even when a stale/expired auth cookie exists.
  // Validity is DB-backed and cannot be proven from the proxy cookie presence alone.
  if (pathname === "/login" || pathname === "/register") {
    return NextResponse.next();
  }

  // All other routes are publicly accessible.
  // Authorization (delete = admin only, etc.) is enforced at the API layer.
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icons|manifest.json|sw.js|workbox).*)",
  ],
};
