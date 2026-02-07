import { db } from "@bikalpo-project/db";
import { session, user } from "@bikalpo-project/db/schema";
import { ORPCError } from "@orpc/server";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";

import { adminProcedure } from "../index";

// Role schema for validation
const roleSchema = z.enum(["guest", "customer", "admin", "salesman", "deliveryman"]);

// Input schemas
const userIdSchema = z.object({
    userId: z.string().min(1),
});

const setRoleSchema = z.object({
    userId: z.string().min(1),
    role: roleSchema,
});

const banUserSchema = z.object({
    userId: z.string().min(1),
    reason: z.string().optional(),
});

const sessionIdSchema = z.object({
    sessionId: z.string().min(1),
});

export const userRouter = {
    /**
     * Get all users
     * REST: GET /users
     */
    getAll: adminProcedure
        .route({
            method: "GET",
            path: "/users",
            tags: ["Users"],
            summary: "Get all users",
            description: "Get all users ordered by creation date",
        })
        .handler(async () => {
            const users = await db
                .select()
                .from(user)
                .orderBy(desc(user.createdAt));

            return { users };
        }),

    /**
     * Get all users with their active sessions
     * REST: GET /users/with-sessions
     */
    getAllWithSessions: adminProcedure
        .route({
            method: "GET",
            path: "/users/with-sessions",
            tags: ["Users"],
            summary: "Get all users with sessions",
            description: "Get all users with their active sessions",
        })
        .handler(async () => {
            const users = await db
                .select()
                .from(user)
                .orderBy(desc(user.createdAt));

            const allSessions = await db.select().from(session);

            // Group sessions by userId
            const sessionsByUser = allSessions.reduce(
                (acc, s) => {
                    if (!acc[s.userId]) {
                        acc[s.userId] = [];
                    }
                    acc[s.userId]!.push(s);
                    return acc;
                },
                {} as Record<string, typeof allSessions>,
            );

            // Combine users with their sessions
            const usersWithSessions = users.map((u) => ({
                ...u,
                sessions: sessionsByUser[u.id] || [],
            }));

            return { users: usersWithSessions };
        }),

    /**
     * Get users by role
     * REST: GET /users/by-role/:role
     */
    getByRole: adminProcedure
        .route({
            method: "GET",
            path: "/users/by-role/{role}",
            tags: ["Users"],
            summary: "Get users by role",
            description: "Get all users with a specific role",
        })
        .input(z.object({ role: roleSchema }))
        .handler(async ({ input }) => {
            const users = await db
                .select()
                .from(user)
                .where(eq(user.role, input.role))
                .orderBy(desc(user.createdAt));

            return { users };
        }),

    /**
     * Approve a guest user (change role to customer)
     * REST: POST /users/:userId/approve
     */
    approve: adminProcedure
        .route({
            method: "POST",
            path: "/users/{userId}/approve",
            tags: ["Users"],
            summary: "Approve guest user",
            description: "Approve a guest user by changing their role to customer",
        })
        .input(userIdSchema)
        .handler(async ({ input }) => {
            await db
                .update(user)
                .set({ role: "customer" })
                .where(eq(user.id, input.userId));

            return { success: true };
        }),

    /**
     * Set user role
     * REST: POST /users/:userId/set-role
     */
    setRole: adminProcedure
        .route({
            method: "POST",
            path: "/users/{userId}/set-role",
            tags: ["Users"],
            summary: "Set user role",
            description: "Set the role for a user",
        })
        .input(setRoleSchema)
        .handler(async ({ context, input }) => {
            // Prevent admin from demoting themselves
            if (input.userId === context.session.user.id && input.role !== "admin") {
                throw new ORPCError("BAD_REQUEST", { message: "Cannot demote yourself" });
            }

            await db
                .update(user)
                .set({ role: input.role })
                .where(eq(user.id, input.userId));

            return { success: true };
        }),

    /**
     * Ban a user
     * REST: POST /users/:userId/ban
     */
    ban: adminProcedure
        .route({
            method: "POST",
            path: "/users/{userId}/ban",
            tags: ["Users"],
            summary: "Ban user",
            description: "Ban a user with an optional reason",
        })
        .input(banUserSchema)
        .handler(async ({ context, input }) => {
            // Prevent self-ban
            if (input.userId === context.session.user.id) {
                throw new ORPCError("BAD_REQUEST", { message: "Cannot ban yourself" });
            }

            await db
                .update(user)
                .set({
                    banned: true,
                    banReason: input.reason || "No reason provided",
                })
                .where(eq(user.id, input.userId));

            return { success: true };
        }),

    /**
     * Unban a user
     * REST: POST /users/:userId/unban
     */
    unban: adminProcedure
        .route({
            method: "POST",
            path: "/users/{userId}/unban",
            tags: ["Users"],
            summary: "Unban user",
            description: "Remove ban from a user",
        })
        .input(userIdSchema)
        .handler(async ({ input }) => {
            await db
                .update(user)
                .set({ banned: false, banReason: null })
                .where(eq(user.id, input.userId));

            return { success: true };
        }),

    /**
     * Revoke a specific session
     * REST: DELETE /users/sessions/:sessionId
     */
    revokeSession: adminProcedure
        .route({
            method: "DELETE",
            path: "/users/sessions/{sessionId}",
            tags: ["Users"],
            summary: "Revoke session",
            description: "Revoke a specific user session",
        })
        .input(sessionIdSchema)
        .handler(async ({ input }) => {
            await db.delete(session).where(eq(session.id, input.sessionId));

            return { success: true };
        }),

    /**
     * Revoke all sessions for a user
     * REST: DELETE /users/:userId/sessions
     */
    revokeAllSessions: adminProcedure
        .route({
            method: "DELETE",
            path: "/users/{userId}/sessions",
            tags: ["Users"],
            summary: "Revoke all user sessions",
            description: "Revoke all sessions for a specific user",
        })
        .input(userIdSchema)
        .handler(async ({ context, input }) => {
            // Prevent admin from revoking their own sessions
            if (input.userId === context.session.user.id) {
                throw new ORPCError("BAD_REQUEST", { message: "Cannot revoke your own sessions" });
            }

            await db.delete(session).where(eq(session.userId, input.userId));

            return { success: true };
        }),
};
