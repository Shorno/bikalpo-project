import { ORPCError } from "@orpc/server";
import { db } from "@bikalpo-project/db";
import {
  invite,
  sellerApplication,
  user,
  warehouseApplication,
} from "@bikalpo-project/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { ensurePendingKycForUser } from "./kyc-verification";

type ApproveOptions = {
  adminId: string;
  adminNotes?: string | null;
};

async function generateUniqueShopSlug(shopName: string): Promise<string> {
  const base = shopName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 50);

  const existing = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.shopSlug, base))
    .limit(1);

  if (existing.length === 0) return base;

  const suffix = Math.random().toString(36).slice(2, 6);
  return `${base}-${suffix}`;
}

async function generateUniqueWarehouseSlug(
  warehouseName: string,
): Promise<string> {
  const base = warehouseName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 50);

  const existing = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.warehouseSlug, base))
    .limit(1);

  if (existing.length === 0) return base;

  const suffix = Math.random().toString(36).slice(2, 6);
  return `${base}-${suffix}`;
}

export async function approveSellerApplicationById(
  applicationId: string,
  { adminId, adminNotes }: ApproveOptions,
) {
  const application = await db.query.sellerApplication.findFirst({
    where: eq(sellerApplication.id, applicationId),
  });

  if (!application) {
    throw new ORPCError("NOT_FOUND", { message: "Application not found" });
  }

  if (application.status !== "pending") {
    throw new ORPCError("CONFLICT", {
      message: `Application is already ${application.status}`,
    });
  }

  const isSeller = application.businessType === "retail";

  await db
    .update(sellerApplication)
    .set({
      status: "approved",
      adminNotes: adminNotes || null,
      reviewedBy: adminId,
      reviewedAt: new Date(),
    })
    .where(eq(sellerApplication.id, applicationId));

  const shopSlug = await generateUniqueShopSlug(application.shopName);

  await db
    .update(user)
    .set({
      role: "shop_owner",
      isSeller,
      sellerStatus: "approved",
      businessType: application.businessType,
      shopAddress: application.shopAddress,
      shopName: application.shopName,
      shopSlug,
      ownerName: application.ownerName,
      shopLat: application.latitude || undefined,
      shopLng: application.longitude || undefined,
    })
    .where(eq(user.id, application.userId));

  try {
    const matchingInvite = await db.query.invite.findFirst({
      where: and(
        eq(invite.invitedUserId, application.userId),
        sql`${invite.status} IN ('joined', 'invited', 'subscribed', 'rewarded')`,
      ),
    });

    if (matchingInvite) {
      const existingRewardResult = await db.execute(
        sql`SELECT id FROM reward WHERE invite_id = ${matchingInvite.id} LIMIT 1`,
      );
      const existingRewardRows = Array.isArray(existingRewardResult)
        ? existingRewardResult
        : ((existingRewardResult as { rows?: unknown[] }).rows ?? []);

      if (existingRewardRows.length === 0) {
        await db
          .update(invite)
          .set({
            status: "subscribed",
            updatedAt: new Date(),
          })
          .where(eq(invite.id, matchingInvite.id));

        const actualUserType = (application.selectedPlan || "")
          .toLowerCase()
          .includes("wholesal")
          ? "wholesaler"
          : "retailer";

        await db
          .update(invite)
          .set({ userType: actualUserType })
          .where(eq(invite.id, matchingInvite.id));

        const rewardAmount = actualUserType === "wholesaler" ? 150 : 100;

        let fraudCheck = "pending";
        let fraudReason: string | null = null;

        const inviterPhoneResult = await db.execute(
          sql`SELECT phone_number FROM "user" WHERE id = ${matchingInvite.inviterUserId}`,
        );
        const inviterRows = Array.isArray(inviterPhoneResult)
          ? inviterPhoneResult
          : ((inviterPhoneResult as { rows?: { phone_number?: string }[] })
              .rows ?? []);
        const inviterPhone = (inviterRows[0]?.phone_number || "").replace(
          /^\+880/,
          "0",
        );
        const invitedPhone = (application.phoneNumber || "").replace(
          /^\+880/,
          "0",
        );

        if (inviterPhone && invitedPhone && inviterPhone === invitedPhone) {
          fraudCheck = "flagged";
          fraudReason =
            "Self-referral: inviter and invited user have the same phone number";
        }

        if (!fraudReason && matchingInvite.createdAt) {
          const inviteTime = new Date(matchingInvite.createdAt).getTime();
          const appTime = new Date(application.createdAt).getTime();
          const timeDiffMinutes = (appTime - inviteTime) / (1000 * 60);
          if (timeDiffMinutes < 2) {
            fraudCheck = "flagged";
            fraudReason =
              "Suspicious timing: registration happened within 2 minutes of invite";
          }
        }

        if (!fraudReason) {
          const rewardCountResult = await db.execute(
            sql`SELECT count(*) as cnt FROM reward WHERE user_id = ${matchingInvite.inviterUserId}`,
          );
          const rewardRows = Array.isArray(rewardCountResult)
            ? rewardCountResult
            : ((rewardCountResult as { rows?: { cnt?: number }[] }).rows ?? []);
          const existingRewards = Number(rewardRows[0]?.cnt ?? 0);
          if (existingRewards >= 5) {
            fraudCheck = "flagged";
            fraudReason =
              "Multiple accounts detected: inviter has excessive referral rewards";
          }
        }

        if (!fraudReason) {
          const inviterSessionResult = await db.execute(
            sql`SELECT ip_address, "userAgent" FROM session WHERE "userId" = ${matchingInvite.inviterUserId} ORDER BY "createdAt" DESC LIMIT 1`,
          );
          const inviterSessions = Array.isArray(inviterSessionResult)
            ? inviterSessionResult
            : ((inviterSessionResult as { rows?: { ip_address?: string; userAgent?: string }[] })
                .rows ?? []);

          const invitedSessionResult = await db.execute(
            sql`SELECT ip_address, "userAgent" FROM session WHERE "userId" = ${application.userId} ORDER BY "createdAt" DESC LIMIT 1`,
          );
          const invitedSessions = Array.isArray(invitedSessionResult)
            ? invitedSessionResult
            : ((invitedSessionResult as { rows?: { ip_address?: string; userAgent?: string }[] })
                .rows ?? []);

          const inviterIP = inviterSessions[0]?.ip_address;
          const invitedIP = invitedSessions[0]?.ip_address;
          const inviterUA = inviterSessions[0]?.userAgent;
          const invitedUA = invitedSessions[0]?.userAgent;

          if (inviterIP && invitedIP && inviterIP === invitedIP) {
            fraudCheck = "flagged";
            fraudReason = `Same device detected: both accounts logged in from IP ${inviterIP}`;
            if (inviterUA && invitedUA && inviterUA === invitedUA) {
              fraudReason = `Same device & browser: both accounts share IP ${inviterIP} and identical browser fingerprint`;
            }
          }
        }

        const rCode =
          "RWD-" + Math.random().toString(36).slice(2, 8).toUpperCase();
        const rewardStatus = fraudCheck === "flagged" ? "rejected" : "approved";
        await db.execute(
          sql`INSERT INTO reward (reward_code, user_id, invite_id, amount, reward_type, source, status, fraud_check, fraud_reason, created_at, updated_at)
              VALUES (
                  ${rCode},
                  ${matchingInvite.inviterUserId},
                  ${matchingInvite.id},
                  ${rewardAmount},
                  'referral',
                  'referral',
                  ${rewardStatus},
                  ${fraudCheck},
                  ${fraudReason},
                  NOW(),
                  NOW()
              )`,
        );

        if (fraudCheck !== "flagged") {
          await db.execute(
            sql`INSERT INTO wallet (user_id, balance, created_at, updated_at)
                VALUES (${matchingInvite.inviterUserId}, ${rewardAmount}, NOW(), NOW())
                ON CONFLICT (user_id) DO UPDATE SET
                    balance = wallet.balance + ${rewardAmount},
                    updated_at = NOW()`,
          );

          await db
            .update(invite)
            .set({ status: "rewarded", updatedAt: new Date() })
            .where(eq(invite.id, matchingInvite.id));
        } else {
          await db
            .update(invite)
            .set({ status: "fraud", updatedAt: new Date() })
            .where(eq(invite.id, matchingInvite.id));
        }
      }
    }
  } catch (rewardError) {
    console.error("[Auto-Reward] Error creating reward:", rewardError);
  }

  await ensurePendingKycForUser(application.userId);

  return { success: true as const, isSeller };
}

export async function approveWarehouseApplicationById(
  applicationId: string,
  { adminId, adminNotes }: ApproveOptions,
) {
  const application = await db.query.warehouseApplication.findFirst({
    where: eq(warehouseApplication.id, applicationId),
  });

  if (!application) {
    throw new ORPCError("NOT_FOUND", {
      message: "Warehouse application not found",
    });
  }

  if (application.status !== "pending") {
    throw new ORPCError("CONFLICT", {
      message: `Application is already ${application.status}`,
    });
  }

  await db
    .update(warehouseApplication)
    .set({
      status: "approved",
      adminNotes: adminNotes || null,
      reviewedBy: adminId,
      reviewedAt: new Date(),
    })
    .where(eq(warehouseApplication.id, applicationId));

  const warehouseSlug = await generateUniqueWarehouseSlug(
    application.warehouseName,
  );

  await db
    .update(user)
    .set({
      role: "warehouse",
      warehouseName: application.warehouseName,
      warehouseSlug,
      warehouseAddress: application.warehouseAddress,
      ownerName: application.ownerName,
      warehouseLat: application.latitude || undefined,
      warehouseLng: application.longitude || undefined,
    })
    .where(eq(user.id, application.userId));

  await ensurePendingKycForUser(application.userId);

  return { success: true as const };
}
