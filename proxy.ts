import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// better-auth default session cookie name
const SESSION_COOKIE = "better-auth.session_token";

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

  const sessionToken = request.cookies.get(SESSION_COOKIE);
  const isAuthenticated = !!sessionToken?.value;

  // Auth pages: redirect to dashboard if already logged in
  if (pathname === "/login" || pathname === "/register") {
    if (isAuthenticated) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
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