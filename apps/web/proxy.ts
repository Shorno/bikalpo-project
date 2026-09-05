import { isShopPortalRole } from "@bikalpo-project/auth/shop-staff-access";
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
const STAFF_ROUTES = ["/dashboard", "/deliveryman"];

const PORTAL_SUBDOMAIN_PREFIXES = new Set([
  "shop",
  "b2b",
  "warehouse",
  "delivery",
  "sales",
]);

function getRootDomainUrl(request: NextRequest) {
  const host = request.headers.get("host") || request.nextUrl.host;
  const [prefix, ...rest] = host.split(".");
  const rootHost =
    prefix && rest.length > 0 && PORTAL_SUBDOMAIN_PREFIXES.has(prefix)
      ? rest.join(".")
      : host;

  return `${request.nextUrl.protocol}//${rootHost}`;
}

function getRootAuthRouteUrl(request: NextRequest) {
  const url = new URL(request.nextUrl.pathname, getRootDomainUrl(request));
  url.search = request.nextUrl.search;
  return url;
}

function isPathAtOrBelow(pathname: string, route: string) {
  return pathname === route || pathname.startsWith(`${route}/`);
}

function isShopDashboardAliasPath(pathname: string) {
  return (
    pathname === "/dashboard" ||
    pathname === "/dashboard/daybook" ||
    isPathAtOrBelow(pathname, "/dashboard/reports") ||
    isPathAtOrBelow(pathname, "/dashboard/finance") ||
    isPathAtOrBelow(pathname, "/dashboard/suppliers") ||
    isPathAtOrBelow(pathname, "/dashboard/customers")
  );
}

export function proxy(request: NextRequest) {
  const hostname = request.headers.get("host") || "";
  const pathname = request.nextUrl.pathname;
  const origin = request.headers.get("origin");

  const allowedOrigins = [
    process.env.NEXT_PUBLIC_AUTH_URL,
    process.env.NEXT_PUBLIC_SHOP_SUBDOMAIN_URL,
    process.env.NEXT_PUBLIC_B2B_SUBDOMAIN_URL,
    process.env.NEXT_PUBLIC_WAREHOUSE_SUBDOMAIN_URL,
    process.env.NEXT_PUBLIC_DELIVERY_SUBDOMAIN_URL,
    process.env.NEXT_PUBLIC_SALES_SUBDOMAIN_URL,
    "http://localhost:3001",
    "http://bikalpo.localhost:3001",
    "http://shop.bikalpo.localhost:3001",
    "http://b2b.bikalpo.localhost:3001",
    "http://warehouse.bikalpo.localhost:3001",
    "http://delivery.bikalpo.localhost:3001",
    "http://sales.bikalpo.localhost:3001",
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
  const isDeliverySubdomain = hostname.startsWith("delivery.");
  const isSalesSubdomain = hostname.startsWith("sales.");

  // === B2B SUBDOMAIN (Public marketing/landing page) ===
  if (isB2bSubdomain) {
    // Generic auth routes always live on the root domain.
    if (isAuthRoute) {
      if (token) {
        return NextResponse.redirect(new URL("/", request.url));
      }
      return NextResponse.redirect(getRootAuthRouteUrl(request));
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
      return NextResponse.redirect(getRootAuthRouteUrl(request));
    }

    // Skip if already accessing shop routes
    if (pathname.startsWith("/shop")) {
      return NextResponse.next();
    }

    // Keep warehouse checkout handoffs on the shop origin so browser cart
    // storage remains available when the shared storefront opens.
    if (pathname.startsWith("/w/")) {
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
      const mainDomain = getRootDomainUrl(request);
      return NextResponse.redirect(new URL("/login", mainDomain));
    }

    // If logged in but not a shop portal account, redirect to main domain
    if (role && !isShopPortalRole(role)) {
      const mainDomain = getRootDomainUrl(request);
      return NextResponse.redirect(new URL("/", mainDomain));
    }

    // Logged-in shop owners hitting root → redirect to dashboard (like warehouse)
    if (pathname === "/") {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    if (isShopDashboardAliasPath(pathname)) {
      return NextResponse.next();
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
      return NextResponse.redirect(getRootAuthRouteUrl(request));
    }

    // Keep warehouse subdomain URLs scoped to /dashboard.
    if (pathname.startsWith("/warehouse/dashboard")) {
      const suffix = pathname.slice("/warehouse/dashboard".length);
      return NextResponse.redirect(
        new URL(
          `/dashboard${suffix || ""}${request.nextUrl.search}`,
          request.url,
        ),
      );
    }

    // Skip if already accessing warehouse routes
    if (pathname.startsWith("/warehouse")) {
      return NextResponse.next();
    }

    // Redirect to main domain login if not authenticated
    if (!token) {
      const mainDomain = getRootDomainUrl(request);
      return NextResponse.redirect(new URL("/login", mainDomain));
    }

    // If logged in but not a warehouse user, redirect to main domain
    if (role && role !== "warehouse") {
      const mainDomain = getRootDomainUrl(request);
      return NextResponse.redirect(new URL("/", mainDomain));
    }

    // Rewrite to warehouse folder for warehouse users
    const rewritePath =
      pathname === "/" ? "/warehouse" : `/warehouse${pathname}`;
    const rewriteUrl = new URL(rewritePath, request.url);
    rewriteUrl.search = request.nextUrl.search;
    return NextResponse.rewrite(rewriteUrl);
  }

  // === DELIVERY SUBDOMAIN (Warehouse Rider Portal — requires deliveryman auth) ===
  if (isDeliverySubdomain) {
    // Auth routes - redirect logged-in users away from login/sign-up
    if (isAuthRoute) {
      if (token) {
        return NextResponse.redirect(new URL("/dashboard", request.url));
      }
      return NextResponse.redirect(getRootAuthRouteUrl(request));
    }

    // Redirect to main domain login if not authenticated
    if (!token) {
      const mainDomain = getRootDomainUrl(request);
      return NextResponse.redirect(new URL("/login", mainDomain));
    }

    // If logged in but not a deliveryman, redirect to main domain
    if (role && role !== "deliveryman") {
      const mainDomain = getRootDomainUrl(request);
      return NextResponse.redirect(new URL("/", mainDomain));
    }

    if (pathname === "/") {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    if (pathname.startsWith("/delivery/dashboard")) {
      const suffix = pathname.slice("/delivery/dashboard".length);
      return NextResponse.redirect(
        new URL(
          `/dashboard${suffix || ""}${request.nextUrl.search}`,
          request.url,
        ),
      );
    }

    if (pathname.startsWith("/dashboard")) {
      const suffix = pathname.slice("/dashboard".length);
      const rewritePath = `/delivery/dashboard${suffix}`;
      const rewriteUrl = new URL(rewritePath, request.url);
      rewriteUrl.search = request.nextUrl.search;
      return NextResponse.rewrite(rewriteUrl);
    }

    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // === SALES SUBDOMAIN (Warehouse Sales Portal — requires salesman auth) ===
  if (isSalesSubdomain) {
    // Auth routes - redirect logged-in users away from login/sign-up
    if (isAuthRoute) {
      if (token) {
        return NextResponse.redirect(new URL("/dashboard", request.url));
      }
      return NextResponse.redirect(getRootAuthRouteUrl(request));
    }

    // Redirect to main domain login if not authenticated
    if (!token) {
      const mainDomain = getRootDomainUrl(request);
      return NextResponse.redirect(new URL("/login", mainDomain));
    }

    // If logged in but not a salesman, redirect to main domain
    if (role && role !== "salesman") {
      const mainDomain = getRootDomainUrl(request);
      return NextResponse.redirect(new URL("/", mainDomain));
    }

    if (pathname === "/") {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    if (pathname.startsWith("/sales/dashboard")) {
      const suffix = pathname.slice("/sales/dashboard".length);
      return NextResponse.redirect(
        new URL(
          `/dashboard${suffix || ""}${request.nextUrl.search}`,
          request.url,
        ),
      );
    }

    if (pathname.startsWith("/dashboard")) {
      const suffix = pathname.slice("/dashboard".length);
      const rewritePath = `/sales/dashboard${suffix}`;
      const rewriteUrl = new URL(rewritePath, request.url);
      rewriteUrl.search = request.nextUrl.search;
      return NextResponse.rewrite(rewriteUrl);
    }

    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // === MAIN DOMAIN ===

  if (pathname.startsWith("/sales/dashboard")) {
    const salesDomain =
      process.env.NEXT_PUBLIC_SALES_SUBDOMAIN_URL ||
      "http://sales.bikalpo.localhost:3001";
    const suffix = pathname.slice("/sales/dashboard".length);
    return NextResponse.redirect(
      new URL(
        `/dashboard${suffix || ""}${request.nextUrl.search}`,
        salesDomain,
      ),
    );
  }

  if (pathname.startsWith("/delivery/dashboard")) {
    const deliveryDomain =
      process.env.NEXT_PUBLIC_DELIVERY_SUBDOMAIN_URL ||
      "http://delivery.bikalpo.localhost:3001";
    const suffix = pathname.slice("/delivery/dashboard".length);
    return NextResponse.redirect(
      new URL(
        `/dashboard${suffix || ""}${request.nextUrl.search}`,
        deliveryDomain,
      ),
    );
  }

  // Auth routes - redirect logged-in users away from login/sign-up
  if (isAuthRoute) {
    if (token && role) {
      if (isShopPortalRole(role)) {
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
      if (role === "salesman") {
        // Sales users go to sales subdomain
        const salesDomain =
          process.env.NEXT_PUBLIC_SALES_SUBDOMAIN_URL ||
          "http://sales.bikalpo.localhost:3001";
        return NextResponse.redirect(new URL("/dashboard", salesDomain));
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
    // Deliverymen must only access /deliveryman/* routes
    if (pathname.startsWith("/deliveryman") && role !== "deliveryman") {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
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

  // Let shop owners inspect the customer-facing store and product journey in
  // an explicitly read-only preview. Cart and checkout routes remain blocked.
  const isCustomerPreview =
    request.nextUrl.searchParams.get("preview") === "customer";
  if (
    token &&
    role === "shop_owner" &&
    isCustomerPreview &&
    (isPathAtOrBelow(pathname, "/stores") ||
      isPathAtOrBelow(pathname, "/products"))
  ) {
    return NextResponse.next();
  }

  // If logged in as staff trying to access public pages, redirect to dashboard
  const staffRoles = [
    "admin",
    "salesman",
    "deliveryman",
    "shop_owner",
    "shop_staff",
    "warehouse",
  ];
  if (token && role && staffRoles.includes(role)) {
    if (isShopPortalRole(role)) {
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
    if (role === "salesman") {
      const salesDomain =
        process.env.NEXT_PUBLIC_SALES_SUBDOMAIN_URL ||
        "http://sales.bikalpo.localhost:3001";
      return NextResponse.redirect(new URL("/dashboard", salesDomain));
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
