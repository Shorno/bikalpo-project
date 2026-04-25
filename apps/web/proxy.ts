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
    process.env.NEXT_PUBLIC_AUTH_URL,
    process.env.NEXT_PUBLIC_SHOP_SUBDOMAIN_URL,
    process.env.NEXT_PUBLIC_B2B_SUBDOMAIN_URL,
    process.env.NEXT_PUBLIC_WAREHOUSE_SUBDOMAIN_URL,
    "http://localhost:3001",
    "http://bikalpo.localhost:3001",
    "http://shop.bikalpo.localhost:3001",
    "http://b2b.bikalpo.localhost:3001",
    "http://warehouse.bikalpo.localhost:3001",
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

  // Detect subdomains
  const isShopSubdomain = hostname.startsWith("shop.");
  const isB2bSubdomain = hostname.startsWith("b2b.");
  const isWarehouseSubdomain = hostname.startsWith("warehouse.");

  // === B2B SUBDOMAIN (Public marketing/landing page) ===
  if (isB2bSubdomain) {
    // B2B is public — allow auth routes as normal
    if (isAuthRoute) {
      if (token) {
        return NextResponse.redirect(new URL("/", request.url));
      }
      return NextResponse.next();
    }

    // Skip rewrite if already accessing /b2b routes internally
    if (pathname.startsWith("/b2b")) {
      return NextResponse.next();
    }

    // Rewrite to /b2b folder
    const rewritePath = pathname === "/" ? "/b2b" : `/b2b${pathname}`;
    const rewriteUrl = new URL(rewritePath, request.url);
    rewriteUrl.search = request.nextUrl.search;
    return NextResponse.rewrite(rewriteUrl);
  }

  // === SHOP SUBDOMAIN (Shop Owner Portal — requires auth) ===
  if (isShopSubdomain) {
    // === SHOP SUBDOMAIN (Shop Owner Portal) ===

    // Auth routes - redirect logged-in users away from login/sign-up
    if (isAuthRoute) {
      if (token) {
        return NextResponse.redirect(new URL("/", request.url));
      }
      return NextResponse.next();
    }

    // Skip if already accessing shop routes
    if (pathname.startsWith("/shop")) {
      return NextResponse.next();
    }

    // Allow apply-business and application-status routes (they live at root, not under /shop)
    if (pathname === "/apply-business" || pathname === "/application-status") {
      if (!token) {
        return NextResponse.redirect(new URL("/login", request.url));
      }
      return NextResponse.next();
    }

    // Redirect to main domain login if not authenticated
    if (!token) {
      // Use the frontend URL, not the auth/backend URL
      const mainDomain = `${request.nextUrl.protocol}//${hostname.replace(/^(shop|b2b)\./, "")}`;
      return NextResponse.redirect(new URL("/login", mainDomain));
    }

    // If logged in but not a shop_owner, redirect to main domain
    if (role && role !== "shop_owner") {
      const mainDomain = `${request.nextUrl.protocol}//${hostname.replace(/^(shop|b2b)\./, "")}`;
      return NextResponse.redirect(new URL("/", mainDomain));
    }

    // Logged-in shop owners hitting root → redirect to dashboard (like warehouse)
    if (pathname === "/") {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    // Rewrite to shop folder for shop owners
    const rewritePath = `/shop${pathname}`;
    const rewriteUrl = new URL(rewritePath, request.url);
    rewriteUrl.search = request.nextUrl.search; // Preserve query params
    return NextResponse.rewrite(rewriteUrl);
  }

  // === WAREHOUSE SUBDOMAIN (Warehouse Owner Portal — requires auth) ===
  if (isWarehouseSubdomain) {
    // Auth routes - redirect logged-in users away from login/sign-up
    if (isAuthRoute) {
      if (token) {
        return NextResponse.redirect(new URL("/", request.url));
      }
      return NextResponse.next();
    }

    // Skip if already accessing warehouse routes
    if (pathname.startsWith("/warehouse")) {
      return NextResponse.next();
    }

    // Redirect to main domain login if not authenticated
    if (!token) {
      const mainDomain = `${request.nextUrl.protocol}//${hostname.replace(/^warehouse\./, "")}`;
      return NextResponse.redirect(new URL("/login", mainDomain));
    }

    // If logged in but not a warehouse user, redirect to main domain
    if (role && role !== "warehouse") {
      const mainDomain = `${request.nextUrl.protocol}//${hostname.replace(/^warehouse\./, "")}`;
      return NextResponse.redirect(new URL("/", mainDomain));
    }

    // Rewrite to warehouse folder for warehouse users
    const rewritePath = pathname === "/" ? "/warehouse" : `/warehouse${pathname}`;
    const rewriteUrl = new URL(rewritePath, request.url);
    rewriteUrl.search = request.nextUrl.search;
    return NextResponse.rewrite(rewriteUrl);
  }

  // === MAIN DOMAIN ===

  // Auth routes - redirect logged-in users away from login/sign-up
  if (isAuthRoute) {
    if (token && role) {
      if (role === "shop_owner") {
        // Shop owners go to shop subdomain
        const shopDomain =
          process.env.NEXT_PUBLIC_SHOP_SUBDOMAIN_URL ||
          "http://shop.bikalpo.localhost:3001";
        return NextResponse.redirect(new URL("/", shopDomain));
      }
      if (role === "warehouse") {
        // Warehouse users go to warehouse subdomain
        const warehouseDomain =
          process.env.NEXT_PUBLIC_WAREHOUSE_SUBDOMAIN_URL ||
          "http://warehouse.bikalpo.localhost:3001";
        return NextResponse.redirect(new URL("/", warehouseDomain));
      }
      // Staff go to dashboard
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    // Allow access to login/sign-up if not logged in
    return NextResponse.next();
  }

  // Staff routes - require login and appropriate role
  if (isStaffRoute) {
    if (!token) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    // Allow access for staff (admin, salesman, deliveryman) and shop_owner
    return NextResponse.next();
  }

  // Allow application-status page for authenticated users
  if (pathname === "/application-status" || pathname === "/apply-business") {
    if (!token) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    return NextResponse.next();
  }

  // Allow warehouse storefront, application, and status routes for ALL users (including staff)
  if (
    pathname.startsWith("/w/") ||
    pathname.startsWith("/apply-warehouse") ||
    pathname.startsWith("/warehouse-application-status")
  ) {
    if (
      !token &&
      (pathname.startsWith("/apply-warehouse") ||
        pathname.startsWith("/warehouse-application-status"))
    ) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    return NextResponse.next();
  }

  // If logged in as staff trying to access public pages, redirect to dashboard
  const staffRoles = ["admin", "salesman", "deliveryman", "shop_owner", "warehouse"];
  if (token && role && staffRoles.includes(role)) {
    if (role === "shop_owner") {
      const shopDomain =
        process.env.NEXT_PUBLIC_SHOP_SUBDOMAIN_URL ||
        "http://shop.bikalpo.localhost:3001";
      return NextResponse.redirect(new URL("/", shopDomain));
    }
    if (role === "warehouse") {
      const warehouseDomain =
        process.env.NEXT_PUBLIC_WAREHOUSE_SUBDOMAIN_URL ||
        "http://warehouse.bikalpo.localhost:3001";
      return NextResponse.redirect(new URL("/", warehouseDomain));
    }
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Public pages - allow anonymous visitors and consumers
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
