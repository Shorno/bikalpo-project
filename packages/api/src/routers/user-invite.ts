import { and, count, desc, eq, inArray, or, sql } from "drizzle-orm";
import { ORPCError } from "@orpc/server";
import { z } from "zod";
import { db } from "@bikalpo-project/db";
import { invite, user } from "@bikalpo-project/db/schema";
import { protectedProcedure } from "../index";

/**
 * Generate a permanent personal referral code from user's phone number
 * Format: REF-{last6digits} — always the same for a given user
 */
function generatePersonalCode(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  const suffix = digits.slice(-6);
  return `REF-${suffix}`;
}

/**
 * Generate a unique invite code for each invite
 * Format: INV-{first4chars}-{random4digits}
 */
function generateInviteCode(userId: string): string {
  const prefix = userId.slice(0, 4).toUpperCase();
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `INV-${prefix}-${rand}`;
}

export const userInviteRouter = {
  /**
   * Get user's permanent personal referral code
   */
  getMyInviteCode: protectedProcedure
    .route({
      method: "GET",
      path: "/user/invite/my-code",
      tags: ["User Invite"],
      summary: "Get user's personal referral code",
    })
    .handler(async ({ context }) => {
      const userId = context.session.user.id;

      // Get user's phone number for the permanent code
      const [userData] = await db
        .select({ phoneNumber: user.phoneNumber })
        .from(user)
        .where(eq(user.id, userId));

      const phone = userData?.phoneNumber || userId;
      const personalCode = generatePersonalCode(phone);

      return { inviteCode: personalCode };
    }),

  /**
   * Create an invite for a specific phone number  
   */
  sendInvite: protectedProcedure
    .route({
      method: "POST",
      path: "/user/invite/send",
      tags: ["User Invite"],
      summary: "Send invite to a phone number",
    })
    .input(
      z.object({
        phone: z.string().min(10),
        userType: z.enum(["retailer", "wholesaler", "pending"]).default("pending"),
      }),
    )
    .handler(async ({ input, context }) => {
      const userId = context.session.user.id;

      // ── Fraud Check 1: Self-referral prevention ──────────────
      // Get inviter's phone number
      const [inviterData] = await db
        .select({ phoneNumber: user.phoneNumber })
        .from(user)
        .where(eq(user.id, userId));

      if (inviterData?.phoneNumber) {
        const inviterPhone = inviterData.phoneNumber.replace(/^\+880/, "0").replace(/^880/, "0");
        const inputPhone = input.phone.replace(/^\+880/, "0").replace(/^880/, "0");
        if (inviterPhone === inputPhone) {
          throw new ORPCError("BAD_REQUEST", {
            message: "You cannot invite your own phone number",
          });
        }
      }

      // ── Fraud Check 1.5: Phone already has an account ────────
      const normalizedPhone = input.phone.replace(/^\+880/, "0").replace(/^880/, "0");
      const phoneVariants = [
        normalizedPhone,
        `+880${normalizedPhone.replace(/^0/, "")}`,
        `880${normalizedPhone.replace(/^0/, "")}`,
      ];
      const [existingUser] = await db
        .select({ id: user.id })
        .from(user)
        .where(
          or(
            ...phoneVariants.map((p) => eq(user.phoneNumber, p)),
          ),
        );

      if (existingUser) {
        throw new ORPCError("CONFLICT", {
          message: "This phone number already has an account and cannot be invited",
        });
      }

      // ── Fraud Check 2: Already invited by this user ──────────
      const [existingInvite] = await db
        .select()
        .from(invite)
        .where(
          and(
            eq(invite.inviterUserId, userId),
            eq(invite.invitedPhone, input.phone),
          ),
        );

      if (existingInvite) {
        return {
          message: "Already invited this number",
          inviteCode: existingInvite.inviteCode,
          alreadyExists: true,
        };
      }

      // ── Fraud Check 3: Phone already invited by someone else ──
      const [alreadyInvitedByOthers] = await db
        .select({ id: invite.id })
        .from(invite)
        .where(eq(invite.invitedPhone, input.phone));

      if (alreadyInvitedByOthers) {
        throw new ORPCError("CONFLICT", {
          message: "This phone number has already been invited by another user",
        });
      }

      // ── Fraud Check 4: Rate limit — max 10 invites per day ──
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const [recentCount] = await db
        .select({ count: count() })
        .from(invite)
        .where(
          and(
            eq(invite.inviterUserId, userId),
            sql`${invite.createdAt} > ${oneDayAgo}`,
          ),
        );

      if ((recentCount?.count ?? 0) >= 10) {
        throw new ORPCError("TOO_MANY_REQUESTS", {
          message: "You can send a maximum of 10 invites per day",
        });
      }

      // Generate invite code
      const code = generateInviteCode(userId);

      const [newInvite] = await db
        .insert(invite)
        .values({
          inviteCode: code,
          inviterUserId: userId,
          invitedPhone: input.phone,
          userType: input.userType,
          status: "invited",
        })
        .returning();

      return {
        message: "Invite sent successfully",
        inviteCode: newInvite?.inviteCode ?? code,
        alreadyExists: false,
      };
    }),

  /**
   * Get list of people I've invited
   */
  myReferrals: protectedProcedure
    .route({
      method: "GET",
      path: "/user/invite/my-referrals",
      tags: ["User Invite"],
      summary: "List my sent referrals",
    })
    .input(
      z.object({
        page: z.coerce.number().default(1),
        limit: z.coerce.number().default(10),
      }),
    )
    .handler(async ({ input, context }) => {
      const userId = context.session.user.id;
      const offset = (input.page - 1) * input.limit;

      const invitedUser = db
        .select({ id: user.id, name: user.name, phoneNumber: user.phoneNumber })
        .from(user)
        .as("invited_user");

      const [items, [countResult]] = await Promise.all([
        db
          .select({
            id: invite.id,
            inviteCode: invite.inviteCode,
            invitedPhone: invite.invitedPhone,
            invitedName: invitedUser.name,
            userType: invite.userType,
            status: invite.status,
            createdAt: invite.createdAt,
          })
          .from(invite)
          .leftJoin(invitedUser, eq(invite.invitedUserId, invitedUser.id))
          .where(eq(invite.inviterUserId, userId))
          .orderBy(desc(invite.createdAt))
          .limit(input.limit)
          .offset(offset),
        db
          .select({ count: count() })
          .from(invite)
          .where(eq(invite.inviterUserId, userId)),
      ]);

      return {
        items,
        total: countResult?.count ?? 0,
        page: input.page,
        totalPages: Math.ceil((countResult?.count ?? 0) / input.limit),
      };
    }),

  /**
   * Get my referral stats (how many invited, joined, subscribed, earnings)
   */
  myStats: protectedProcedure
    .route({
      method: "GET",
      path: "/user/invite/my-stats",
      tags: ["User Invite"],
      summary: "Get my referral stats",
    })
    .handler(async ({ context }) => {
      const userId = context.session.user.id;

      const [totalInvites] = await db
        .select({ count: count() })
        .from(invite)
        .where(eq(invite.inviterUserId, userId));

      const [joinedCount] = await db
        .select({ count: count() })
        .from(invite)
        .where(
          and(
            eq(invite.inviterUserId, userId),
            inArray(invite.status, ["joined", "subscribed", "rewarded"]),
          ),
        );

      const [subscribedCount] = await db
        .select({ count: count() })
        .from(invite)
        .where(
          and(
            eq(invite.inviterUserId, userId),
            inArray(invite.status, ["subscribed", "rewarded"]),
          ),
        );

      // Use raw SQL for reward/wallet to avoid Drizzle schema column issues
      let totalEarnings = 0;
      let walletBal = 0;
      try {
        const earningsResult = await db.execute(
          sql`SELECT coalesce(sum(amount), 0)::text as total FROM reward WHERE user_id = ${userId} AND status IN ('paid', 'approved')`
        );
        // db.execute returns rows array directly
        const rows = Array.isArray(earningsResult) ? earningsResult : (earningsResult as any).rows ?? [];
        totalEarnings = Number(rows[0]?.total ?? 0);
      } catch { /* no rewards yet */ }

      try {
        const walletResult = await db.execute(
          sql`SELECT coalesce(balance, 0)::text as balance FROM wallet WHERE user_id = ${userId}`
        );
        const rows = Array.isArray(walletResult) ? walletResult : (walletResult as any).rows ?? [];
        walletBal = Number(rows[0]?.balance ?? 0);
      } catch { /* no wallet yet */ }

      return {
        totalInvites: totalInvites?.count ?? 0,
        joined: joinedCount?.count ?? 0,
        subscribed: subscribedCount?.count ?? 0,
        totalEarnings,
        walletBalance: walletBal,
      };
    }),

  /**
   * Validate an invite code during sign-up
   * Called when a new user enters a referral code
   */
  validateCode: protectedProcedure
    .route({
      method: "POST",
      path: "/user/invite/validate",
      tags: ["User Invite"],
      summary: "Validate referral code",
    })
    .input(z.object({ code: z.string().min(1) }))
    .handler(async ({ input }) => {
      // Find an invite with this code
      const [inv] = await db
        .select({
          id: invite.id,
          inviteCode: invite.inviteCode,
          inviterUserId: invite.inviterUserId,
          status: invite.status,
        })
        .from(invite)
        .where(eq(invite.inviteCode, input.code));

      if (!inv) {
        return { valid: false, message: "Invalid invite code" };
      }

      // Get inviter info
      const [inviter] = await db
        .select({ name: user.name })
        .from(user)
        .where(eq(user.id, inv.inviterUserId));

      return {
        valid: true,
        message: `Referred by ${inviter?.name || "a user"}`,
        inviterName: inviter?.name || null,
      };
    }),
};
