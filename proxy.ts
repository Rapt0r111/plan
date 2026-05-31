import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PROTECTED_PAGE_PREFIXES = [
  "/board",
  "/dashboard",
  "/epics",
  "/management",
  "/operative",
  "/personal-plan",
  "/profile",
  "/settings",
  "/tasks",
  "/today",
] as const;

function hasSessionCookie(request: NextRequest) {
  return request.cookies.getAll().some((cookie) => (
    cookie.name === "better-auth.session_token" ||
    cookie.name === "__Secure-better-auth.session_token" ||
    cookie.name === "__Host-better-auth.session_token" ||
    cookie.name.endsWith(".better-auth.session_token") ||
    cookie.name.includes("better-auth.session")
  ));
}

function isProtectedPage(pathname: string) {
  return pathname === "/" || PROTECTED_PAGE_PREFIXES.some((prefix) => (
    pathname === prefix || pathname.startsWith(`${prefix}/`)
  ));
}

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

  // API authorization is enforced inside route handlers so JSON clients get
  // proper 401/403 responses instead of HTML redirects.
  if (pathname.startsWith("/api")) {
    return NextResponse.next();
  }

  // Proxy can only cheaply detect cookie presence; DB-backed validity and RBAC
  // remain enforced in layouts/pages/API helpers. This catches clearly anonymous
  // page loads early while stale cookies still flow to server-side auth checks.
  if (isProtectedPage(pathname) && !hasSessionCookie(request)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icons|manifest.json|sw.js|workbox).*)",
  ],
};
