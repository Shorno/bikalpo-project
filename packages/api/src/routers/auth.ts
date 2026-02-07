import { z } from "zod";

import { adminProcedure, protectedProcedure, publicProcedure } from "../index";

// Role type for validation
const roleSchema = z.enum(["guest", "customer", "admin", "salesman", "deliveryman"]);

export const authRouter = {
    /**
     * Get current session - returns user info if logged in, null otherwise
     * REST: GET /auth/session
     */
    getSession: publicProcedure
        .route({
            method: "GET",
            path: "/auth/session",
            tags: ["Auth"],
            summary: "Get current session",
            description: "Get the current user session. Returns null if not authenticated.",
        })
        .handler(({ context }) => {
            if (!context.session?.user) {
                return { session: null, user: null, isAuthenticated: false };
            }

            return {
                session: context.session,
                user: context.session.user,
                isAuthenticated: true,
            };
        }),

    /**
     * Get current user (requires authentication)
     * REST: GET /auth/me
     */
    me: protectedProcedure
        .route({
            method: "GET",
            path: "/auth/me",
            tags: ["Auth"],
            summary: "Get current user",
            description: "Get the current authenticated user. Throws UNAUTHORIZED if not logged in.",
        })
        .handler(({ context }) => {
            return {
                user: context.session.user,
            };
        }),

    /**
     * Check if user has specific role
     * REST: POST /auth/check-role
     */
    checkRole: protectedProcedure
        .route({
            method: "POST",
            path: "/auth/check-role",
            tags: ["Auth"],
            summary: "Check user role",
            description: "Check if the current user has one of the allowed roles.",
        })
        .input(
            z.object({
                allowedRoles: z.array(roleSchema),
            })
        )
        .handler(({ context, input }) => {
            const userRole = context.session.user.role as string;
            const hasRole = input.allowedRoles.includes(userRole as any);

            return {
                hasRole,
                userRole,
                allowedRoles: input.allowedRoles,
            };
        }),

    /**
     * Check if user is admin
     * REST: GET /auth/is-admin
     */
    isAdmin: protectedProcedure
        .route({
            method: "GET",
            path: "/auth/is-admin",
            tags: ["Auth"],
            summary: "Check if user is admin",
            description: "Check if the current user has admin role.",
        })
        .handler(({ context }) => {
            const isAdmin = context.session.user.role === "admin";
            return { isAdmin };
        }),

    /**
     * Get admin session - throws if not admin
     * REST: GET /auth/admin-session
     */
    getAdminSession: adminProcedure
        .route({
            method: "GET",
            path: "/auth/admin-session",
            tags: ["Auth"],
            summary: "Get admin session",
            description: "Get session for admin users only. Throws FORBIDDEN if not admin.",
        })
        .handler(({ context }) => {
            return {
                session: context.session,
                user: context.session.user,
            };
        }),
};
