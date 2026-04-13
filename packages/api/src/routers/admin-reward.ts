import { and, count, desc, eq, ilike, sql } from "drizzle-orm";
import { ORPCError } from "@orpc/server";
import { z } from "zod";
import { db } from "@bikalpo-project/db";
import { reward, invite, user, wallet } from "@bikalpo-project/db/schema";
import { adminProcedure } from "../index";


export const adminRewardRouter = {
  /**
   * List rewards with search, filters, and pagination
   */
  list: adminProcedure
    .route({
      method: "GET",
      path: "/admin/rewards",
      tags: ["Admin Reward System"],
      summary: "List rewards",
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
        conditions.push(eq(reward.status, status));
      }
      if (userType && userType !== "all") {
        conditions.push(sql`${reward.source} = ${userType}`);
      }
      if (search) {
        conditions.push(
          ilike(reward.rewardCode, `%${search}%`),
        );
      }

      const where = conditions.length > 0 ? and(...conditions) : undefined;

      const rewardUser = db
        .select({ id: user.id, name: user.name, phoneNumber: user.phoneNumber, email: user.email })
        .from(user)
        .as("reward_user");

      const [items, [countResult]] = await Promise.all([
        db
          .select({
            id: reward.id,
            rewardCode: reward.rewardCode,
            inviteId: reward.inviteId,
            userId: reward.userId,
            userName: rewardUser.name,
            userPhone: rewardUser.phoneNumber,
            userEmail: rewardUser.email,
            amount: reward.amount,
            userType: reward.source,
            status: reward.status,
            fraudCheck: reward.fraudCheck,
            fraudReason: reward.fraudReason,
            paidAt: reward.paidAt,
            createdAt: reward.createdAt,
          })
          .from(reward)
          .leftJoin(rewardUser, eq(reward.userId, rewardUser.id))
          .where(where)
          .orderBy(desc(reward.createdAt))
          .limit(limit)
          .offset(offset),
        db.select({ count: count() }).from(reward).where(where),
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
   * KPI stats for rewards
   */
  stats: adminProcedure
    .route({
      method: "GET",
      path: "/admin/rewards/stats",
      tags: ["Admin Reward System"],
      summary: "Get reward KPIs",
    })
    .handler(async () => {
      const [totalRewards] = await db
        .select({ total: sql<number>`coalesce(sum(${reward.amount}), 0)` })
        .from(reward);
      const [pendingRewards] = await db
        .select({ total: sql<number>`coalesce(sum(${reward.amount}), 0)` })
        .from(reward)
        .where(eq(reward.status, "pending"));
      const [approvedRewards] = await db
        .select({ total: sql<number>`coalesce(sum(${reward.amount}), 0)` })
        .from(reward)
        .where(eq(reward.status, "approved"));
      const [paidRewards] = await db
        .select({ total: sql<number>`coalesce(sum(${reward.amount}), 0)` })
        .from(reward)
        .where(eq(reward.status, "paid"));
      const [fraudBlocked] = await db
        .select({ total: sql<number>`coalesce(sum(${reward.amount}), 0)` })
        .from(reward)
        .where(eq(reward.status, "rejected"));

      return {
        totalRewards: totalRewards?.total ?? 0,
        pendingApproval: pendingRewards?.total ?? 0,
        approved: approvedRewards?.total ?? 0,
        paid: paidRewards?.total ?? 0,
        fraudBlocked: fraudBlocked?.total ?? 0,
      };
    }),

  /**
   * Get single reward details
   */
  getById: adminProcedure
    .route({
      method: "GET",
      path: "/admin/rewards/{id}",
      tags: ["Admin Reward System"],
      summary: "Get reward details",
    })
    .input(z.object({ id: z.coerce.number() }))
    .handler(async ({ input }) => {
      const rewardUser = db
        .select({
          id: user.id,
          name: user.name,
          phoneNumber: user.phoneNumber,
          email: user.email,
          role: user.role,
        })
        .from(user)
        .as("reward_user");

      const [result] = await db
        .select({
          id: reward.id,
          rewardCode: reward.rewardCode,
          inviteId: reward.inviteId,
          userId: reward.userId,
          userName: rewardUser.name,
          userPhone: rewardUser.phoneNumber,
          userEmail: rewardUser.email,
          userRole: rewardUser.role,
          amount: reward.amount,
          userType: reward.source,
          status: reward.status,
          fraudCheck: reward.fraudCheck,
          fraudReason: reward.fraudReason,
          approvedBy: reward.approvedBy,
          paidAt: reward.paidAt,
          createdAt: reward.createdAt,
          updatedAt: reward.updatedAt,
        })
        .from(reward)
        .leftJoin(rewardUser, eq(reward.userId, rewardUser.id))
        .where(eq(reward.id, input.id));

      if (!result) {
        throw new ORPCError("NOT_FOUND", { message: "Reward not found" });
      }

      // Get linked invite info if exists
      let linkedInvite = null;
      if (result.inviteId) {
        const [inv] = await db
          .select({
            id: invite.id,
            inviteCode: invite.inviteCode,
            invitedPhone: invite.invitedPhone,
            status: invite.status,
          })
          .from(invite)
          .where(eq(invite.id, result.inviteId));
        linkedInvite = inv ?? null;
      }

      return { ...result, invite: linkedInvite };
    }),

  /**
   * Approve a reward
   */
  approve: adminProcedure
    .route({
      method: "POST",
      path: "/admin/rewards/approve",
      tags: ["Admin Reward System"],
      summary: "Approve reward",
    })
    .input(z.object({ id: z.number().int() }))
    .handler(async ({ input, context }) => {
      await db
        .update(reward)
        .set({
          status: "approved",
          approvedBy: context.session.user.id,
          updatedAt: new Date(),
        })
        .where(eq(reward.id, input.id));
      return { message: "Reward approved" };
    }),

  /**
   * Reject a reward
   */
  reject: adminProcedure
    .route({
      method: "POST",
      path: "/admin/rewards/reject",
      tags: ["Admin Reward System"],
      summary: "Reject reward",
    })
    .input(
      z.object({
        id: z.number().int(),
        reason: z.string().optional(),
      }),
    )
    .handler(async ({ input }) => {
      await db
        .update(reward)
        .set({
          status: "rejected",
          fraudCheck: "flagged",
          fraudReason: input.reason || "Rejected by admin",
          updatedAt: new Date(),
        })
        .where(eq(reward.id, input.id));
      return { message: "Reward rejected" };
    }),

  /**
   * Mark a reward as paid
   */
  markPaid: adminProcedure
    .route({
      method: "POST",
      path: "/admin/rewards/mark-paid",
      tags: ["Admin Reward System"],
      summary: "Mark reward as paid",
    })
    .input(z.object({ id: z.number().int() }))
    .handler(async ({ input }) => {
      // Get the reward to find the user
      const [rewardRecord] = await db
        .select()
        .from(reward)
        .where(eq(reward.id, input.id));

      if (!rewardRecord) {
        throw new ORPCError("NOT_FOUND", { message: "Reward not found" });
      }

      // Update reward status + auto-clear fraud (admin verified by paying)
      await db
        .update(reward)
        .set({ status: "paid", fraudCheck: "clear", paidAt: new Date(), updatedAt: new Date() })
        .where(eq(reward.id, input.id));

      // Update wallet balance if user exists
      if (rewardRecord.userId) {
        const [existingWallet] = await db
          .select()
          .from(wallet)
          .where(eq(wallet.userId, rewardRecord.userId));

        if (existingWallet) {
          await db
            .update(wallet)
            .set({
              balance: sql`${wallet.balance} + ${rewardRecord.amount}`,
              updatedAt: new Date(),
            })
            .where(eq(wallet.userId, rewardRecord.userId));
        } else {
          await db.insert(wallet).values({
            userId: rewardRecord.userId,
            balance: rewardRecord.amount,
          });
        }
      }

      return { message: "Reward marked as paid and wallet updated" };
    }),

  /**
   * Flag a reward for fraud
   */
  flagFraud: adminProcedure
    .route({
      method: "POST",
      path: "/admin/rewards/flag-fraud",
      tags: ["Admin Reward System"],
      summary: "Flag reward as fraud",
    })
    .input(
      z.object({
        id: z.number().int(),
        reason: z.string().min(1),
      }),
    )
    .handler(async ({ input }) => {
      await db
        .update(reward)
        .set({
          status: "rejected",
          fraudCheck: "flagged",
          fraudReason: input.reason,
          updatedAt: new Date(),
        })
        .where(eq(reward.id, input.id));
      return { message: "Reward flagged as fraud" };
    }),

  /**
   * Update reward status
   */
  updateStatus: adminProcedure
    .route({
      method: "POST",
      path: "/admin/rewards/update-status",
      tags: ["Admin Reward System"],
      summary: "Update reward status",
    })
    .input(
      z.object({
        id: z.number().int(),
        status: z.enum(["pending", "approved", "rejected", "paid"]),
      }),
    )
    .handler(async ({ input }) => {
      await db
        .update(reward)
        .set({ status: input.status, updatedAt: new Date() })
        .where(eq(reward.id, input.id));
      return { message: `Reward status updated to ${input.status}` };
    }),
};
