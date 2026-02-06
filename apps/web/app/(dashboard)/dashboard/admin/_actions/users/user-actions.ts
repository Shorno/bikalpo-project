"use server";

import { desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { db } from "@/db/config";
import { session, user } from "@/db/schema/auth-schema";
import { auth } from "@/lib/auth";

export type UserRole =
  | "guest"
  | "customer"
  | "admin"
  | "salesman"
  | "deliveryman";

/**
 * Get all users from the database
 */
export async function getUsers() {
  return db.select().from(user).orderBy(desc(user.createdAt));
}

/**
 * Get all users with their active sessions
 */
export async function getUsersWithSessions() {
  const users = await db.select().from(user).orderBy(desc(user.createdAt));

  // Fetch sessions for all users
  const allSessions = await db.select().from(session);

  // Group sessions by userId
  const sessionsByUser = allSessions.reduce(
    (acc, s) => {
      if (!acc[s.userId]) {
        acc[s.userId] = [];
      }
      acc[s.userId].push(s);
      return acc;
    },
    {} as Record<string, typeof allSessions>,
  );

  // Combine users with their sessions
  return users.map((u) => ({
    ...u,
    sessions: sessionsByUser[u.id] || [],
  }));
}

/**
 * Get users by role (for filtering)
 */
export async function getUsersByRole(role: UserRole) {
  return db
    .select()
    .from(user)
    .where(eq(user.role, role))
    .orderBy(desc(user.createdAt));
}

/**
 * Approve a guest user (change role to customer)
 * Only admins can perform this action
 */
export async function approveUser(userId: string) {
  const currentSession = await auth.api.getSession({
    headers: await headers(),
  });

  if (!currentSession) {
    throw new Error("Unauthorized");
  }

  // Check if current user is admin
  if (currentSession.user.role !== "admin") {
    throw new Error("Only admins can approve users");
  }

  await db.update(user).set({ role: "customer" }).where(eq(user.id, userId));

  revalidatePath("/dashboard/users");
  return { success: true };
}

export async function setUserRole(userId: string, role: UserRole) {
  const currentSession = await auth.api.getSession({
    headers: await headers(),
  });

  if (!currentSession) {
    throw new Error("Unauthorized");
  }

  // Check if current user is admin
  if (currentSession.user.role !== "admin") {
    throw new Error("Only admins can set user roles");
  }

  // Prevent admin from demoting themselves
  if (userId === currentSession.user.id && role !== "admin") {
    throw new Error("Cannot demote yourself");
  }

  await db.update(user).set({ role }).where(eq(user.id, userId));

  revalidatePath("/dashboard/users");
  return { success: true };
}

export async function banUser(userId: string, reason?: string) {
  const currentSession = await auth.api.getSession({
    headers: await headers(),
  });

  if (!currentSession) {
    throw new Error("Unauthorized");
  }

  if (currentSession.user.role !== "admin") {
    throw new Error("Only admins can ban users");
  }

  if (userId === currentSession.user.id) {
    throw new Error("Cannot ban yourself");
  }

  await db
    .update(user)
    .set({ banned: true, banReason: reason || "No reason provided" })
    .where(eq(user.id, userId));

  revalidatePath("/dashboard/users");
  return { success: true };
}

export async function unbanUser(userId: string) {
  const currentSession = await auth.api.getSession({
    headers: await headers(),
  });

  if (!currentSession) {
    throw new Error("Unauthorized");
  }

  if (currentSession.user.role !== "admin") {
    throw new Error("Only admins can unban users");
  }

  await db
    .update(user)
    .set({ banned: false, banReason: null })
    .where(eq(user.id, userId));

  revalidatePath("/dashboard/users");
  return { success: true };
}

/**
 * Revoke a specific session for a user (admin only)
 */
export async function revokeUserSession(sessionId: string) {
  const currentSession = await auth.api.getSession({
    headers: await headers(),
  });

  if (!currentSession) {
    throw new Error("Unauthorized");
  }

  if (currentSession.user.role !== "admin") {
    throw new Error("Only admins can revoke sessions");
  }

  await db.delete(session).where(eq(session.id, sessionId));

  revalidatePath("/dashboard/users");
  return { success: true };
}

/**
 * Revoke all sessions for a user (admin only)
 */
export async function revokeAllUserSessions(userId: string) {
  const currentSession = await auth.api.getSession({
    headers: await headers(),
  });

  if (!currentSession) {
    throw new Error("Unauthorized");
  }

  if (currentSession.user.role !== "admin") {
    throw new Error("Only admins can revoke sessions");
  }

  // Prevent admin from revoking their own sessions
  if (userId === currentSession.user.id) {
    throw new Error("Cannot revoke your own sessions");
  }

  await db.delete(session).where(eq(session.userId, userId));

  revalidatePath("/dashboard/users");
  return { success: true };
}
