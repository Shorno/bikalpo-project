import { and, count, desc, eq, ilike, or, sql } from "drizzle-orm";
import { ORPCError } from "@orpc/server";
import { z } from "zod";
import { db } from "@bikalpo-project/db";
import { adminInvite, invite, user } from "@bikalpo-project/db/schema";
import { adminProcedure, publicProcedure } from "../index";

/**
 * Generate a unique admin invite code like AINV-8001
 */
async function generateAdminInviteCode(): Promise<string> {
  const [result] = await db
    .select({ maxId: sql<number>`coalesce(max(${adminInvite.id}), 0)` })
    .from(adminInvite);
  const nextNum = (result?.maxId ?? 0) + 1;
  return `AINV-${String(nextNum).padStart(4, "0")}`;
}

export const adminAssistedInviteRouter = {
  /**
   * List admin invites with search, filters, and pagination
   */
  list: adminProcedure
    .route({
      method: "GET",
      path: "/admin/admin-invites",
      tags: ["Admin Assisted Invite"],
      summary: "List admin invites",
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
        conditions.push(eq(adminInvite.status, status));
      }
      if (userType && userType !== "all") {
        conditions.push(eq(adminInvite.userType, userType));
      }
      if (search) {
        conditions.push(
          or(
            ilike(adminInvite.inviteCode, `%${search}%`),
            ilike(adminInvite.invitedPhone, `%${search}%`),
            ilike(adminInvite.invitedName, `%${search}%`),
          ),
        );
      }

      const where = conditions.length > 0 ? and(...conditions) : undefined;

      const adminUser = db
        .select({ id: user.id, name: user.name, phoneNumber: user.phoneNumber, email: user.email })
        .from(user)
        .as("admin_user");

      const invitedUser = db
        .select({ id: user.id, name: user.name, email: user.email })
        .from(user)
        .as("invited_user");

      const [items, [countResult]] = await Promise.all([
        db
          .select({
            id: adminInvite.id,
            inviteCode: adminInvite.inviteCode,
            adminUserId: adminInvite.adminUserId,
            adminName: adminUser.name,
            adminPhone: adminUser.phoneNumber,
            inviteMethod: adminInvite.inviteMethod,
            invitedPhone: adminInvite.invitedPhone,
            invitedName: adminInvite.invitedName,
            invitedUserId: adminInvite.invitedUserId,
            invitedRegisteredName: sql<string | null>`COALESCE(
              ${invitedUser.name},
              (SELECT u.name FROM "user" u WHERE u.phone_number = ${adminInvite.invitedPhone} OR u.phone_number = CONCAT('+880', SUBSTRING(${adminInvite.invitedPhone} FROM 2)) OR u.phone_number = CONCAT('880', SUBSTRING(${adminInvite.invitedPhone} FROM 2)) LIMIT 1)
            )`.as("invitedRegisteredName"),
            invitedEmail: invitedUser.email,
            userType: adminInvite.userType,
            status: adminInvite.status,
            createdAt: adminInvite.createdAt,
            updatedAt: adminInvite.updatedAt,
          })
          .from(adminInvite)
          .leftJoin(adminUser, eq(adminInvite.adminUserId, adminUser.id))
          .leftJoin(invitedUser, eq(adminInvite.invitedUserId, invitedUser.id))
          .where(where)
          .orderBy(desc(adminInvite.createdAt))
          .limit(limit)
          .offset(offset),
        db.select({ count: count() }).from(adminInvite).where(where),
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
   * Get KPI stats + conversion funnel
   */
  stats: adminProcedure
    .route({
      method: "GET",
      path: "/admin/admin-invites/stats",
      tags: ["Admin Assisted Invite"],
      summary: "Get admin invite KPIs and conversion stats",
    })
    .handler(async () => {
      const [totalInvites] = await db.select({ count: count() }).from(adminInvite);
      const [joinedUsers] = await db
        .select({ count: count() })
        .from(adminInvite)
        .where(or(eq(adminInvite.status, "joined"), eq(adminInvite.status, "converted")));
      const [convertedUsers] = await db
        .select({ count: count() })
        .from(adminInvite)
        .where(eq(adminInvite.status, "converted"));

      const total = totalInvites?.count ?? 0;
      const joined = joinedUsers?.count ?? 0;
      const converted = convertedUsers?.count ?? 0;

      return {
        totalInvites: total,
        joinedUsers: joined,
        convertedUsers: converted,
        conversionRate: total > 0 ? Math.round((converted / total) * 100) : 0,
        // Conversion funnel
        funnel: {
          inviteSent: { count: total, rate: 100 },
          joined: { count: joined, rate: total > 0 ? Math.round((joined / total) * 100) : 0 },
          subscribed: {
            count: converted,
            rate: joined > 0 ? Math.round((converted / joined) * 100) : 0,
          },
        },
      };
    }),

  /**
   * Get single admin invite details
   */
  getById: adminProcedure
    .route({
      method: "GET",
      path: "/admin/admin-invites/{id}",
      tags: ["Admin Assisted Invite"],
      summary: "Get admin invite details",
    })
    .input(z.object({ id: z.coerce.number() }))
    .handler(async ({ input }) => {
      const adminUser = db
        .select({
          id: user.id,
          name: user.name,
          phoneNumber: user.phoneNumber,
          email: user.email,
          role: user.role,
        })
        .from(user)
        .as("admin_user");

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
          id: adminInvite.id,
          inviteCode: adminInvite.inviteCode,
          adminUserId: adminInvite.adminUserId,
          adminName: adminUser.name,
          adminPhone: adminUser.phoneNumber,
          adminEmail: adminUser.email,
          inviteMethod: adminInvite.inviteMethod,
          invitedPhone: adminInvite.invitedPhone,
          invitedName: adminInvite.invitedName,
          invitedUserId: adminInvite.invitedUserId,
          invitedRegisteredName: sql<string | null>`COALESCE(
              ${invitedUser.name},
              (SELECT u.name FROM "user" u WHERE u.phone_number = ${adminInvite.invitedPhone} OR u.phone_number = CONCAT('+880', SUBSTRING(${adminInvite.invitedPhone} FROM 2)) OR u.phone_number = CONCAT('880', SUBSTRING(${adminInvite.invitedPhone} FROM 2)) LIMIT 1)
            )`.as("invitedRegisteredName"),
          invitedRegisteredPhone: invitedUser.phoneNumber,
          invitedEmail: invitedUser.email,
          userType: adminInvite.userType,
          status: adminInvite.status,
          createdAt: adminInvite.createdAt,
          updatedAt: adminInvite.updatedAt,
        })
        .from(adminInvite)
        .leftJoin(adminUser, eq(adminInvite.adminUserId, adminUser.id))
        .leftJoin(invitedUser, eq(adminInvite.invitedUserId, invitedUser.id))
        .where(eq(adminInvite.id, input.id));

      if (!result) {
        throw new ORPCError("NOT_FOUND", { message: "Admin invite not found" });
      }

      return result;
    }),

  /**
   * Create a new admin invite
   */
  create: adminProcedure
    .route({
      method: "POST",
      path: "/admin/admin-invites/create",
      tags: ["Admin Assisted Invite"],
      summary: "Create admin invite",
    })
    .input(
      z.object({
        invitedPhone: z.string().min(10),
        invitedName: z.string().optional(),
        userType: z.enum(["retailer", "wholesaler", "pending"]).default("pending"),
        inviteMethod: z.enum(["direct_call", "campaign"]).default("direct_call"),
      }),
    )
    .handler(async ({ input, context }) => {
      // Check if already invited by another admin
      const [existingAdminInvite] = await db
        .select({ id: adminInvite.id, inviteCode: adminInvite.inviteCode })
        .from(adminInvite)
        .where(eq(adminInvite.invitedPhone, input.invitedPhone));

      if (existingAdminInvite) {
        throw new ORPCError("CONFLICT", {
          message: `This phone number was already invited by admin (${existingAdminInvite.inviteCode})`,
        });
      }

      // Check if already invited by a user (user-to-user invite)
      const [existingUserInvite] = await db
        .select({ id: invite.id, inviterUserId: invite.inviterUserId })
        .from(invite)
        .where(eq(invite.invitedPhone, input.invitedPhone));

      if (existingUserInvite) {
        throw new ORPCError("CONFLICT", {
          message: "This phone number was already invited by a user referral",
        });
      }

      // Check if this phone already has an account
      const normalizedPhone = input.invitedPhone.replace(/^\+880/, "0").replace(/^880/, "0");
      const phoneVariants = [
        normalizedPhone,
        `+880${normalizedPhone.replace(/^0/, "")}`,
        `880${normalizedPhone.replace(/^0/, "")}`,
      ];
      const [existingAccount] = await db
        .select({ id: user.id })
        .from(user)
        .where(
          or(
            ...phoneVariants.map((p) => eq(user.phoneNumber, p)),
          ),
        );

      if (existingAccount) {
        throw new ORPCError("CONFLICT", {
          message: "This phone number already has an account and cannot be invited",
        });
      }

      const inviteCode = await generateAdminInviteCode();
      const [result] = await db
        .insert(adminInvite)
        .values({
          inviteCode,
          adminUserId: context.session.user.id,
          invitedPhone: input.invitedPhone,
          invitedName: input.invitedName,
          userType: input.userType,
          inviteMethod: input.inviteMethod,
          status: "invited",
        })
        .returning();
      return { message: "Admin invite created", invite: result };
    }),

  /**
   * Mark as converted
   */
  markConverted: adminProcedure
    .route({
      method: "POST",
      path: "/admin/admin-invites/mark-converted",
      tags: ["Admin Assisted Invite"],
      summary: "Mark invite as converted",
    })
    .input(z.object({ id: z.number().int() }))
    .handler(async ({ input }) => {
      await db
        .update(adminInvite)
        .set({ status: "converted", updatedAt: new Date() })
        .where(eq(adminInvite.id, input.id));
      return { message: "Invite marked as converted" };
    }),

  /**
   * Mark as invalid
   */
  markInvalid: adminProcedure
    .route({
      method: "POST",
      path: "/admin/admin-invites/mark-invalid",
      tags: ["Admin Assisted Invite"],
      summary: "Mark invite as invalid",
    })
    .input(z.object({ id: z.number().int() }))
    .handler(async ({ input }) => {
      await db
        .delete(adminInvite)
        .where(eq(adminInvite.id, input.id));
      return { message: "Invite removed" };
    }),

  /**
   * Update invite status
   */
  updateStatus: adminProcedure
    .route({
      method: "POST",
      path: "/admin/admin-invites/update-status",
      tags: ["Admin Assisted Invite"],
      summary: "Update admin invite status",
    })
    .input(
      z.object({
        id: z.number().int(),
        status: z.enum(["invited", "joined", "converted"]),
      }),
    )
    .handler(async ({ input }) => {
      await db
        .update(adminInvite)
        .set({ status: input.status, updatedAt: new Date() })
        .where(eq(adminInvite.id, input.id));
      return { message: `Status updated to ${input.status}` };
    }),

  /**
   * Check if a phone has an admin invite (public — called during registration)
   */
  checkInviteType: publicProcedure
    .route({
      method: "GET",
      path: "/admin-invites/check-invite-type",
      tags: ["Admin Assisted Invite"],
      summary: "Check if phone has admin invite",
    })
    .input(z.object({ phone: z.string().min(10) }))
    .handler(async ({ input }) => {
      const normalizedPhone = input.phone.replace(/^\+880/, "0").replace(/^880/, "0");
      const phoneVariants = [
        normalizedPhone,
        `+880${normalizedPhone.replace(/^0/, "")}`,
        `880${normalizedPhone.replace(/^0/, "")}`,
      ];

      // Check admin_invite table
      const [adminInv] = await db
        .select({ userType: adminInvite.userType })
        .from(adminInvite)
        .where(
          or(
            ...phoneVariants.map((p) => eq(adminInvite.invitedPhone, p)),
          ),
        );

      if (adminInv && adminInv.userType && adminInv.userType !== "pending") {
        // Map admin userType to business type
        const businessTypeMap: Record<string, string> = {
          retailer: "retail",
          wholesaler: "warehouse",
        };
        return {
          locked: true,
          userType: adminInv.userType,
          businessType: businessTypeMap[adminInv.userType] || "retail",
        };
      }

      // Check user invite table too
      const [userInv] = await db
        .select({ userType: invite.userType })
        .from(invite)
        .where(
          or(
            ...phoneVariants.map((p) => eq(invite.invitedPhone, p)),
          ),
        );

      if (userInv && userInv.userType && userInv.userType !== "pending") {
        const businessTypeMap: Record<string, string> = {
          retailer: "retail",
          wholesaler: "warehouse",
        };
        return {
          locked: true,
          userType: userInv.userType,
          businessType: businessTypeMap[userInv.userType] || "retail",
        };
      }

      return { locked: false, userType: null, businessType: null };
    }),
};
