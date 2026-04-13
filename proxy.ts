/**
 * @file proxy.ts — project root
 *
 * Protects all (main) routes by requiring an authenticated session.
 * Unauthenticated users are redirected to /login.
 *
 * APPROACH:
 *   better-auth stores the session in a cookie named
 *   "better-auth.session_token" (the default).
 *   We check for cookie presence in proxy for a fast, no-DB check.
 *   Full session validation still happens in each Route Handler/Server Component.
 *
 * PUBLIC PATHS (no auth required):
 *   /login, /api/auth/*, /api/health, /manifest.json, /_next/*, /icons/*
 */

import { type NextRequest, NextResponse } from "next/server";

const PUBLIC_PATHS = [
  "/login",
  "/api/auth",
  "/api/health",
  "/manifest.json",
  "/_next",
  "/icons",
  "/sw.js",
  "/workbox-",
  "/favicon",
  "/dashboard",
  "/board",
  "/operative",
  "/settings",
  "/epics",
  "/api/epics",
  "/api/tasks",
  "/api/subtasks",
  "/api/operative-tasks",
  "/api/operative-subtasks",
];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname.startsWith(p));
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Always allow public paths
  if (isPublic(pathname)) {
    return NextResponse.next();
  }

  // Check for better-auth session cookie
  const sessionCookie =
    request.cookies.get("better-auth.session_token") ??
    request.cookies.get("__Secure-better-auth.session_token");

  if (!sessionCookie?.value) {
    // Preserve the original destination for post-login redirect
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all paths EXCEPT:
     *   - _next/static (static files)
     *   - _next/image (image optimization)
     *   - favicon.ico, icons
     *   - sw.js (service worker)
     */
    "/((?!_next/static|_next/image|favicon.ico|icons|sw.js|workbox-).*)",
  ],
};