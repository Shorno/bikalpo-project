import type { Session as AuthSession } from "@bikalpo-project/auth";

export type UserRole =
  | "guest"
  | "customer"
  | "admin"
  | "salesman"
  | "deliveryman";

type SessionPayload = AuthSession | null;

function getAuthBaseUrl(): string {
  const base = process.env.NEXT_PUBLIC_AUTH_URL;
  if (!base) {
    throw new Error("NEXT_PUBLIC_AUTH_URL is not configured");
  }
  return base.replace(/\/$/, "");
}

export async function getSession() {
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
      redirect("/login");
    } else {
      window.location.href = "/login";
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

export async function requireCustomer() {
  return requireRole(["customer"]);
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
