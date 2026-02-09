import { headers } from "next/headers";
import { redirect, unauthorized } from "next/navigation";

import { auth } from "@/lib/auth";

/**
 * Server-side auth utilities using Better Auth directly
 * Use these in Server Components and Server Actions
 * 
 * Using Better Auth directly is more efficient than ORPC for server-side auth
 * because it avoids HTTP round-trips and serialization overhead.
 */

export type UserRole = "guest" | "customer" | "admin" | "salesman" | "deliveryman";

/**
 * Get current session - returns null if not authenticated
 */
export async function getSession() {
    try {
        const session = await auth.api.getSession({
            headers: await headers(),
        });

        if (!session?.user) {
            return null;
        }

        return {
            session,
            user: session.user,
            isAuthenticated: true,
        };
    } catch {
        return null;
    }
}

/**
 * Check if user is authenticated
 */
export async function checkAuth() {
    return getSession();
}

/**
 * Require authentication - redirects to sign-in if not authenticated
 */
export async function requireAuth() {
    const session = await getSession();
    if (!session) {
        redirect("/sign-in");
    }
    return session;
}

/**
 * Require specific roles - returns unauthorized if role doesn't match
 */
export async function requireRole(allowedRoles: UserRole[]) {
    const session = await requireAuth();
    const userRole = session.user?.role as UserRole;

    if (!allowedRoles.includes(userRole)) {
        return unauthorized();
    }

    return session;
}

/**
 * Require admin role
 */
export async function requireAdmin() {
    return requireRole(["admin"]);
}

/**
 * Require salesman role
 */
export async function requireSalesman() {
    return requireRole(["salesman"]);
}

/**
 * Require deliveryman role
 */
export async function requireDeliveryman() {
    return requireRole(["deliveryman"]);
}

/**
 * Require customer role
 */
export async function requireCustomer() {
    return requireRole(["customer"]);
}

/**
 * Check role without redirect - useful for conditional logic
 */
export async function checkRole(allowedRoles: UserRole[]) {
    const session = await getSession();
    if (!session) return null;

    const userRole = session.user?.role as UserRole;
    return allowedRoles.includes(userRole) ? session : null;
}

/**
 * Check if user is admin (without redirect)
 */
export async function checkIsAdmin() {
    return checkRole(["admin"]);
}
