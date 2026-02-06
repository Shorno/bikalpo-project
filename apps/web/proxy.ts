import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

// Session cookie names - production uses __Secure- prefix
const SESSION_COOKIE_DEV = "better-auth.session_token";
const SESSION_COOKIE_PROD = "__Secure-better-auth.session_token";

// Role cookie - set by client after login to help proxy with routing
const ROLE_COOKIE = "user-role";

// Helper to get session token from either cookie
function getSessionToken(request: NextRequest): string | undefined {
  return (
    request.cookies.get(SESSION_COOKIE_PROD)?.value ||
    request.cookies.get(SESSION_COOKIE_DEV)?.value
  );
}

// Helper to get user role from cookie
function getUserRole(request: NextRequest): string | undefined {
  return request.cookies.get(ROLE_COOKIE)?.value;
}

// Auth routes that should skip rewrites
const AUTH_ROUTES = [
  "/login",
  "/sign-up",
  "/forgot-password",
  "/reset-password",
];

// Dashboard routes that only internal staff can access
const STAFF_ROUTES = ["/dashboard"];

export function proxy(request: NextRequest) {
  const hostname = request.headers.get("host") || "";
  const pathname = request.nextUrl.pathname;
  const origin = request.headers.get("origin");

  const allowedOrigins = [
    process.env.BETTER_AUTH_URL,
    process.env.NEXT_PUBLIC_APP_SUBDOMAIN_URL,
    "http://localhost:3000",
    "http://b2b.localhost:3000",
    "http://app.b2b.localhost:3000",
  ].filter(Boolean) as string[];

  // Handle CORS for API routes
  if (pathname.startsWith("/api")) {
    if (request.method === "OPTIONS") {
      const response = new NextResponse(null, { status: 204 });
      if (origin && allowedOrigins.includes(origin)) {
        response.headers.set("Access-Control-Allow-Origin", origin);
      }
      response.headers.set("Access-Control-Allow-Credentials", "true");
      response.headers.set(
        "Access-Control-Allow-Methods",
        "GET, POST, PUT, DELETE, OPTIONS",
      );
      response.headers.set(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization",
      );
      return response;
    }

    const response = NextResponse.next();
    if (origin && allowedOrigins.includes(origin)) {
      response.headers.set("Access-Control-Allow-Origin", origin);
    }
    response.headers.set("Access-Control-Allow-Credentials", "true");
    return response;
  }

  // Skip static files and Next.js internals
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon.ico") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  const token = getSessionToken(request);
  const role = getUserRole(request);
  const isAuthRoute = AUTH_ROUTES.some((route) => pathname.startsWith(route));
  const isStaffRoute = STAFF_ROUTES.some((route) => pathname.startsWith(route));

  // Detect app subdomain (customer portal)
  const isAppSubdomain = hostname.startsWith("app.");

  if (isAppSubdomain) {
    // === APP SUBDOMAIN (Customer Portal) ===

    // Auth routes - redirect logged-in users away from login/sign-up
    if (isAuthRoute) {
      if (token) {
        return NextResponse.redirect(new URL("/", request.url));
      }
      return NextResponse.next();
    }

    // Skip if already accessing customer routes
    if (pathname.startsWith("/customer")) {
      return NextResponse.next();
    }

    // Redirect to login if not authenticated
    if (!token) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    // If logged in but not a customer, redirect to main domain
    if (role && role !== "customer") {
      const mainDomain =
        process.env.BETTER_AUTH_URL || "http://b2b.localhost:3000";
      return NextResponse.redirect(new URL("/dashboard", mainDomain));
    }

    // Rewrite to customer folder for customers
    const rewritePath = pathname === "/" ? "/customer" : `/customer${pathname}`;
    const rewriteUrl = new URL(rewritePath, request.url);
    rewriteUrl.search = request.nextUrl.search; // Preserve query params
    return NextResponse.rewrite(rewriteUrl);
  }

  // === MAIN DOMAIN ===

  // Auth routes - redirect logged-in users away from login/sign-up
  if (isAuthRoute) {
    // Only redirect if user has both token and role (fully authenticated)
    // Allow access if no token (not logged in) or if token exists but role is not set yet
    if (token && role) {
      if (role === "customer") {
        const appSubdomain =
          process.env.NEXT_PUBLIC_APP_SUBDOMAIN_URL ||
          "http://app.b2b.localhost:3000";
        return NextResponse.redirect(new URL("/", appSubdomain));
      }
      // Staff or guest - redirect to dashboard (dashboard will handle guest redirect to pending-approval)
      if (role === "guest") {
        return NextResponse.redirect(new URL("/dashboard", request.url));
      }
      // Staff - redirect to dashboard
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    // Allow access to login/sign-up if not logged in or role not set
    return NextResponse.next();
  }

  // If logged in as customer, redirect to app subdomain
  if (token && role === "customer") {
    const appSubdomain =
      process.env.NEXT_PUBLIC_APP_SUBDOMAIN_URL ||
      "http://app.b2b.localhost:3000";
    return NextResponse.redirect(new URL(pathname, appSubdomain));
  }

  // Staff routes - require login
  if (isStaffRoute) {
    if (!token) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    // Allow access for staff (admin, salesman, deliveryman)
    return NextResponse.next();
  }

  // Allow pending-approval page for guest users (unapproved users)
  if (pathname === "/pending-approval") {
    // Allow access for guest users or unauthenticated users
    if (!token || role === "guest") {
      return NextResponse.next();
    }
    // If logged in as staff or customer, redirect to appropriate dashboard
    const staffRoles = ["admin", "salesman", "deliveryman"];
    if (role && staffRoles.includes(role)) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    if (role === "customer") {
      const appSubdomain =
        process.env.NEXT_PUBLIC_APP_SUBDOMAIN_URL ||
        "http://app.b2b.localhost:3000";
      return NextResponse.redirect(new URL("/", appSubdomain));
    }
  }

  // If logged in as staff trying to access public pages, redirect to dashboard
  const staffRoles = ["admin", "salesman", "deliveryman"];
  if (token && role && staffRoles.includes(role)) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Public pages - allow anonymous visitors
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
