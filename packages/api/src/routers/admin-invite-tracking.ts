import { and, count, desc, eq, ilike, or, sql } from "drizzle-orm";
import { ORPCError } from "@orpc/server";
import { z } from "zod";
import { db } from "@bikalpo-project/db";
import { invite, user, reward } from "@bikalpo-project/db/schema";
import { adminProcedure } from "../index";

/**
 * Generate a unique invite code like INV-7001
 */
async function generateInviteCode(): Promise<string> {
  const [result] = await db
    .select({ maxId: sql<number>`coalesce(max(${invite.id}), 0)` })
    .from(invite);
  const nextNum = (result?.maxId ?? 0) + 1;
  return `INV-${String(nextNum).padStart(4, "0")}`;
}

export const adminInviteTrackingRouter = {
  /**
   * List all invites with search, filters, and pagination
   */
  list: adminProcedure
    .route({
      method: "GET",
      path: "/admin/invite-tracking",
      tags: ["Admin Invite Tracking"],
      summary: "List all invites",
    })
    .input(
      z.object({
        search: z.string().optional(),
        status: z.string().optional(),
        userType: z.string().optional(),
        page: z.coerce.number().default(1),
        limit: z.coerce.number().default(20),
      }),
    )
    .handler(async ({ input }) => {
      const { search, status, userType, page, limit } = input;
      const offset = (page - 1) * limit;

      const conditions = [];

      if (status && status !== "all") {
        conditions.push(eq(invite.status, status));
      }
      if (userType && userType !== "all") {
        conditions.push(eq(invite.userType, userType));
      }
      if (search) {
        conditions.push(
          or(
            ilike(invite.inviteCode, `%${search}%`),
            ilike(invite.invitedPhone, `%${search}%`),
          ),
        );
      }

      const where = conditions.length > 0 ? and(...conditions) : undefined;

      const inviterUser = db
        .select({ id: user.id, name: user.name, phoneNumber: user.phoneNumber, email: user.email })
        .from(user)
        .as("inviter_user");

      const invitedUser = db
        .select({ id: user.id, name: user.name, email: user.email })
        .from(user)
        .as("invited_user");

      const [items, [countResult]] = await Promise.all([
        db
          .select({
            id: invite.id,
            inviteCode: invite.inviteCode,
            inviterUserId: invite.inviterUserId,
            inviterName: inviterUser.name,
            inviterPhone: inviterUser.phoneNumber,
            inviterEmail: inviterUser.email,
            invitedPhone: invite.invitedPhone,
            invitedUserId: invite.invitedUserId,
            invitedName: invitedUser.name,
            invitedEmail: invitedUser.email,
            userType: invite.userType,
            status: invite.status,
            createdAt: invite.createdAt,
            updatedAt: invite.updatedAt,
          })
          .from(invite)
          .leftJoin(inviterUser, eq(invite.inviterUserId, inviterUser.id))
          .leftJoin(invitedUser, eq(invite.invitedUserId, invitedUser.id))
          .where(where)
          .orderBy(desc(invite.createdAt))
          .limit(limit)
          .offset(offset),
        db.select({ count: count() }).from(invite).where(where),
      ]);

      return {
        items,
        total: countResult?.count ?? 0,
        page,
        limit,
        totalPages: Math.ceil((countResult?.count ?? 0) / limit),
      };
    }),

  /**
   * Get KPI summary stats
   */
  stats: adminProcedure
    .route({
      method: "GET",
      path: "/admin/invite-tracking/stats",
      tags: ["Admin Invite Tracking"],
      summary: "Get invite tracking KPIs",
    })
    .handler(async () => {
      const [totalInvites] = await db.select({ count: count() }).from(invite);
      const [joinedUsers] = await db
        .select({ count: count() })
        .from(invite)
        .where(
          or(
            eq(invite.status, "joined"),
            eq(invite.status, "subscribed"),
            eq(invite.status, "rewarded"),
          ),
        );
      const [subscribedUsers] = await db
        .select({ count: count() })
        .from(invite)
        .where(or(eq(invite.status, "subscribed"), eq(invite.status, "rewarded")));
      const [fraudCount] = await db
        .select({ count: count() })
        .from(invite)
        .where(eq(invite.status, "fraud"));

      // Total rewards issued amount
      const [rewardsIssued] = await db
        .select({ total: sql<number>`coalesce(sum(${reward.amount}), 0)` })
        .from(reward)
        .where(or(eq(reward.status, "approved"), eq(reward.status, "paid")));

      return {
        totalInvites: totalInvites?.count ?? 0,
        joinedUsers: joinedUsers?.count ?? 0,
        subscribedUsers: subscribedUsers?.count ?? 0,
        rewardsIssued: rewardsIssued?.total ?? 0,
        fraudDetected: fraudCount?.count ?? 0,
      };
    }),

  /**
   * Get single invite details
   */
  getById: adminProcedure
    .route({
      method: "GET",
      path: "/admin/invite-tracking/{id}",
      tags: ["Admin Invite Tracking"],
      summary: "Get invite details",
    })
    .input(z.object({ id: z.coerce.number() }))
    .handler(async ({ input }) => {
      const inviterUser = db
        .select({
          id: user.id,
          name: user.name,
          phoneNumber: user.phoneNumber,
          email: user.email,
          role: user.role,
        })
        .from(user)
        .as("inviter_user");

      const invitedUser = db
        .select({
          id: user.id,
          name: user.name,
          phoneNumber: user.phoneNumber,
          email: user.email,
        })
        .from(user)
        .as("invited_user");

      const [result] = await db
        .select({
          id: invite.id,
          inviteCode: invite.inviteCode,
          inviterUserId: invite.inviterUserId,
          inviterName: inviterUser.name,
          inviterPhone: inviterUser.phoneNumber,
          inviterEmail: inviterUser.email,
          inviterRole: inviterUser.role,
          invitedPhone: invite.invitedPhone,
          invitedUserId: invite.invitedUserId,
          invitedName: invitedUser.name,
          invitedEmail: invitedUser.email,
          userType: invite.userType,
          status: invite.status,
          createdAt: invite.createdAt,
          updatedAt: invite.updatedAt,
        })
        .from(invite)
        .leftJoin(inviterUser, eq(invite.inviterUserId, inviterUser.id))
        .leftJoin(invitedUser, eq(invite.invitedUserId, invitedUser.id))
        .where(eq(invite.id, input.id));

      if (!result) {
        throw new ORPCError("NOT_FOUND", { message: "Invite not found" });
      }

      // Get associated reward if any
      const [linkedReward] = await db
        .select()
        .from(reward)
        .where(eq(reward.inviteId, input.id));

      return { ...result, reward: linkedReward ?? null };
    }),

  /**
   * Mark an invite as fraud
   */
  markFraud: adminProcedure
    .route({
      method: "POST",
      path: "/admin/invite-tracking/mark-fraud",
      tags: ["Admin Invite Tracking"],
      summary: "Mark invite as fraud",
    })
    .input(z.object({ id: z.number().int() }))
    .handler(async ({ input }) => {
      await db
        .update(invite)
        .set({ status: "fraud", updatedAt: new Date() })
        .where(eq(invite.id, input.id));
      return { message: "Invite marked as fraud" };
    }),

  /**
   * Update invite status (e.g., joined, subscribed, rewarded)
   */
  updateStatus: adminProcedure
    .route({
      method: "POST",
      path: "/admin/invite-tracking/update-status",
      tags: ["Admin Invite Tracking"],
      summary: "Update invite status",
    })
    .input(
      z.object({
        id: z.number().int(),
        status: z.enum(["invited", "joined", "subscribed", "rewarded", "fraud"]),
      }),
    )
    .handler(async ({ input }) => {
      await db
        .update(invite)
        .set({ status: input.status, updatedAt: new Date() })
        .where(eq(invite.id, input.id));
      return { message: `Invite status updated to ${input.status}` };
    }),

  /**
   * Create a new invite (for testing/seeding)
   */
  create: adminProcedure
    .route({
      method: "POST",
      path: "/admin/invite-tracking/create",
      tags: ["Admin Invite Tracking"],
      summary: "Create invite",
    })
    .input(
      z.object({
        inviterUserId: z.string(),
        invitedPhone: z.string().min(10),
        userType: z.enum(["retailer", "wholesaler"]).default("retailer"),
      }),
    )
    .handler(async ({ input }) => {
      const inviteCode = await generateInviteCode();
      const [result] = await db
        .insert(invite)
        .values({
          inviteCode,
          inviterUserId: input.inviterUserId,
          invitedPhone: input.invitedPhone,
          userType: input.userType,
          status: "invited",
        })
        .returning();
      return { message: "Invite created", invite: result };
    }),
};
