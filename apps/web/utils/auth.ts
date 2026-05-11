import type { Session as AuthSession } from "@bikalpo-project/auth";

export type UserRole =
  | "guest"
  | "shop_owner"
  | "consumer"
  | "admin"
  | "salesman"
  | "deliveryman"
  | "warehouse";

type SessionPayload = AuthSession | null;

function getAuthBaseUrl(): string {
  const base = process.env.NEXT_PUBLIC_AUTH_URL;
  if (!base) {
    throw new Error("NEXT_PUBLIC_AUTH_URL is not configured");
  }
  return base.replace(/\/$/, "");
}

export async function getSession() {
  // During build/pre-render, the auth backend may not be running (e.g. local port 3000),
  // so avoid throwing a fetch error and treat as unauthenticated.
  if (
    process.env.NODE_ENV === "production" &&
    process.env.NEXT_PUBLIC_AUTH_URL?.includes("localhost")
  ) {
    return null;
  }

  try {
    const cookie =
      typeof window === "undefined"
        ? (await (await import("next/headers")).headers()).get("cookie")
        : undefined;
    const response = await fetch(`${getAuthBaseUrl()}/auth/get-session`, {
      method: "GET",
      headers: cookie ? { cookie } : {},
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    const session = (await response.json()) as SessionPayload;
    if (!session?.user) {
      return null;
    }

    return {
      session: session.session ?? {},
      user: session.user,
      isAuthenticated: true,
    };
  } catch {
    return null;
  }
}

export async function checkAuth() {
  return getSession();
}

export async function requireAuth() {
  const session = await getSession();
  if (!session) {
    if (typeof window === "undefined") {
      const { redirect } = await import("next/navigation");
      redirect("/");
    } else {
      window.location.href = "/";
    }
    // redirect() throws, so this is unreachable, but satisfies TypeScript
    throw new Error("Redirecting to login");
  }
  return session;
}

export async function requireRole(allowedRoles: UserRole[]) {
  const session = await requireAuth();
  const userRole = session.user.role as UserRole | undefined;

  if (!userRole || !allowedRoles.includes(userRole)) {
    if (typeof window === "undefined") {
      const { unauthorized } = await import("next/navigation");
      return unauthorized();
    }
    throw new Error("Unauthorized");
  }

  return session;
}

export async function requireAdmin() {
  return requireRole(["admin"]);
}

export async function requireSalesman() {
  return requireRole(["salesman"]);
}

export async function requireDeliveryman() {
  return requireRole(["deliveryman"]);
}

export async function requireShopOwner() {
  return requireRole(["shop_owner"]);
}

export async function requireCustomer() {
  return requireRole(["consumer"]);
}

export async function checkRole(allowedRoles: UserRole[]) {
  const session = await getSession();
  if (!session) return null;

  const userRole = session.user.role as UserRole | undefined;
  return userRole && allowedRoles.includes(userRole) ? session : null;
}

export async function checkIsAdmin() {
  return checkRole(["admin"]);
}
