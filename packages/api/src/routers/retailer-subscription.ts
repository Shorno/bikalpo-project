import { db } from "@bikalpo-project/db";
import {
  subscriptionAction,
  subscriptionExpiry,
  subscriptionStatus,
  validateSubscriptionCatalog,
} from "@bikalpo-project/db/retailer-subscription-policy";
import {
  lockSubscriptionCatalog,
  retailerSubscriptionEligibility,
  type SubscriptionTransaction,
} from "@bikalpo-project/db/retailer-subscription-provisioning";
import {
  retailerSubscription as terms,
  retailerSubscriptionPlan as plans,
  retailerSubscriptionPurchase as purchases,
} from "@bikalpo-project/db/schema";
import { ORPCError } from "@orpc/server";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { adminProcedure, shopOwnerProcedure } from "../index";

export const subscriptionPlanInput = z
  .object({
    code: z
      .string()
      .trim()
      .min(2)
      .max(60)
      .regex(/^[a-z][a-z0-9_]*$/),
    name: z.string().trim().min(2).max(100),
    description: z.string().trim().max(500),
    durationMonths: z
      .union([z.literal(1), z.literal(6), z.literal(12)])
      .nullable(),
    amountMinor: z.number().int().min(0).max(100000000),
    active: z.boolean(),
    sortOrder: z.number().int().min(0).max(1000),
  })
  .superRefine((p, ctx) => {
    if (
      p.code === "free"
        ? p.durationMonths !== null || p.amountMinor !== 0 || !p.active
        : p.durationMonths === null || p.amountMinor <= 0
    ) {
      ctx.addIssue({
        code: "custom",
        message:
          "Free must remain active at zero cost with no expiry. Paid plans require a positive price and duration.",
      });
    }
  });

function currentWhere(shopId: string) {
  return and(eq(terms.shopId, shopId), eq(terms.isCurrent, true));
}
export function retailerSubscriptionDto(
  term: typeof terms.$inferSelect,
  now = new Date(),
) {
  return {
    ...term,
    status: subscriptionStatus(term, now),
    paymentStatus: term.purchaseId ? "Paid (Dummy)" : "Not required",
  };
}

async function requireEligibleOwner(
  tx: SubscriptionTransaction,
  shopId: string,
  lock = false,
) {
  if ((await retailerSubscriptionEligibility(tx, shopId, lock)) !== "eligible")
    throw new ORPCError("FORBIDDEN", {
      message: "An approved retail shop owner account is required.",
    });
}

function catalogError(error: unknown): never {
  throw new ORPCError("BAD_REQUEST", {
    message:
      error instanceof Error ? error.message : "Invalid subscription prices",
  });
}

export const adminRetailerSubscriptionRouter = {
  listPlans: adminProcedure
    .route({
      method: "GET",
      path: "/admin/retailer-subscriptions/plans",
      tags: ["Retailer Subscriptions"],
    })
    .handler(() =>
      db
        .select()
        .from(plans)
        .orderBy(asc(plans.sortOrder), asc(plans.createdAt)),
    ),
  createPlan: adminProcedure
    .route({
      method: "POST",
      path: "/admin/retailer-subscriptions/plans",
      tags: ["Retailer Subscriptions"],
    })
    .input(subscriptionPlanInput)
    .handler(({ input, context }) =>
      db.transaction(async (tx) => {
        await lockSubscriptionCatalog(tx);
        const all = await tx.select().from(plans);
        if (all.some((p) => p.code === input.code))
          throw new ORPCError("CONFLICT", {
            message: "This plan code already exists.",
          });
        try {
          validateSubscriptionCatalog([...all, input]);
        } catch (error) {
          catalogError(error);
        }
        const [plan] = await tx
          .insert(plans)
          .values({ ...input, updatedBy: context.session.user.id })
          .returning();
        return plan!;
      }),
    ),
  updatePlan: adminProcedure
    .route({
      method: "PATCH",
      path: "/admin/retailer-subscriptions/plans/{id}",
      tags: ["Retailer Subscriptions"],
    })
    .input(
      z.object({
        id: z.string(),
        version: z.number().int().positive(),
        data: subscriptionPlanInput,
      }),
    )
    .handler(({ input, context }) =>
      db.transaction(async (tx) => {
        await lockSubscriptionCatalog(tx);
        const all = await tx.select().from(plans);
        const old = all.find((p) => p.id === input.id);
        if (!old) throw new ORPCError("NOT_FOUND");
        if (old.version !== input.version)
          throw new ORPCError("CONFLICT", {
            message: "This plan changed. Reload before saving.",
          });
        if (
          old.code !== input.data.code ||
          old.durationMonths !== input.data.durationMonths
        )
          throw new ORPCError("BAD_REQUEST", {
            message:
              "Plan code and duration cannot change. Create a new offer instead.",
          });
        try {
          validateSubscriptionCatalog(
            all.map((p) => (p.id === old.id ? input.data : p)),
          );
        } catch (error) {
          catalogError(error);
        }
        const [plan] = await tx
          .update(plans)
          .set({
            ...input.data,
            version: old.version + 1,
            updatedBy: context.session.user.id,
            updatedAt: new Date(),
          })
          .where(eq(plans.id, old.id))
          .returning();
        return plan!;
      }),
    ),
};

export const retailerSubscriptionRouter = {
  current: shopOwnerProcedure
    .route({
      method: "GET",
      path: "/retailer-subscriptions/current",
      tags: ["Retailer Subscriptions"],
    })
    .handler(({ context }) =>
      db.transaction(async (tx) => {
        const shopId = context.session.user.id;
        await requireEligibleOwner(tx, shopId);
        const current = await tx.query.retailerSubscription.findFirst({
          where: currentWhere(shopId),
        });
        const available = await tx
          .select()
          .from(plans)
          .where(eq(plans.active, true))
          .orderBy(asc(plans.sortOrder));
        const now = new Date();
        return {
          current: current ? retailerSubscriptionDto(current, now) : null,
          serverTime: now,
          plans: available.map((p) => ({
            ...p,
            action: subscriptionAction(current ?? null, p.durationMonths, now),
          })),
        };
      }),
    ),
  quote: shopOwnerProcedure
    .route({
      method: "POST",
      path: "/retailer-subscriptions/quotes",
      tags: ["Retailer Subscriptions"],
    })
    .input(z.object({ planId: z.string() }))
    .handler(({ input, context }) =>
      db.transaction(async (tx) => {
        const shopId = context.session.user.id;
        await requireEligibleOwner(tx, shopId, true);
        const current = await tx.query.retailerSubscription.findFirst({
          where: currentWhere(shopId),
        });
        const plan = await tx.query.retailerSubscriptionPlan.findFirst({
          where: eq(plans.id, input.planId),
        });
        const now = new Date();
        if (!current)
          throw new ORPCError("CONFLICT", {
            message:
              "Your subscription has not been initialized. Contact support.",
          });
        if (
          !plan?.active ||
          plan.durationMonths === null ||
          !subscriptionAction(current, plan.durationMonths, now)
        )
          throw new ORPCError("BAD_REQUEST", {
            message: "This plan is not available for upgrade or renewal.",
          });
        const [quote] = await tx
          .insert(purchases)
          .values({
            shopId,
            planId: plan.id,
            planCode: plan.code,
            planName: plan.name,
            planVersion: plan.version,
            durationMonths: plan.durationMonths,
            amountMinor: plan.amountMinor,
            previousTermId: current.id,
            quoteExpiresAt: new Date(now.getTime() + 10 * 60_000),
          })
          .returning();
        return {
          ...quote!,
          previewStartsAt: now,
          previewExpiresAt: subscriptionExpiry(now, plan.durationMonths),
          replacesPaidTerm:
            current.purchaseId !== null &&
            subscriptionStatus(current, now) === "Active",
          previousExpiry: current.expiresAt,
        };
      }),
    ),
  confirm: shopOwnerProcedure
    .route({
      method: "POST",
      path: "/retailer-subscriptions/confirm",
      tags: ["Retailer Subscriptions"],
    })
    .input(
      z.object({
        quoteId: z.string(),
        idempotencyKey: z.string().uuid(),
        acceptDummyPayment: z.literal(true),
      }),
    )
    .handler(({ input, context }) =>
      db.transaction(async (tx) => {
        const shopId = context.session.user.id;
        await requireEligibleOwner(tx, shopId, true);
        const quote = await tx.query.retailerSubscriptionPurchase.findFirst({
          where: and(
            eq(purchases.id, input.quoteId),
            eq(purchases.shopId, shopId),
          ),
        });
        if (!quote)
          throw new ORPCError("NOT_FOUND", {
            message: "Payment confirmation not found.",
          });
        const priorKey = await tx.query.retailerSubscriptionPurchase.findFirst({
          where: and(
            eq(purchases.shopId, shopId),
            eq(purchases.idempotencyKey, input.idempotencyKey),
          ),
        });
        if (priorKey && priorKey.id !== quote.id)
          throw new ORPCError("CONFLICT", {
            message:
              "This confirmation key was already used for a different purchase.",
          });
        if (quote.confirmedAt) {
          if (quote.idempotencyKey !== input.idempotencyKey)
            throw new ORPCError("CONFLICT", {
              message:
                "This payment was already confirmed. Refresh your subscription.",
            });
          const saved = await tx.query.retailerSubscription.findFirst({
            where: and(
              eq(terms.purchaseId, quote.id),
              eq(terms.shopId, shopId),
            ),
          });
          if (!saved) throw new ORPCError("INTERNAL_SERVER_ERROR");
          return retailerSubscriptionDto(saved);
        }
        const [plan] = await tx
          .select()
          .from(plans)
          .where(eq(plans.id, quote.planId))
          .for("update");
        const current = await tx.query.retailerSubscription.findFirst({
          where: currentWhere(shopId),
        });
        const now = new Date();
        if (
          quote.quoteExpiresAt <= now ||
          !plan?.active ||
          plan.version !== quote.planVersion ||
          current?.id !== quote.previousTermId ||
          !subscriptionAction(current ?? null, quote.durationMonths, now)
        ) {
          throw new ORPCError("CONFLICT", {
            message:
              "The offer or your subscription changed, or the confirmation expired. Choose a plan again.",
          });
        }
        await tx
          .update(terms)
          .set({ isCurrent: false, supersededAt: now })
          .where(eq(terms.id, current.id));
        await tx
          .update(purchases)
          .set({ confirmedAt: now, idempotencyKey: input.idempotencyKey })
          .where(eq(purchases.id, quote.id));
        const [activated] = await tx
          .insert(terms)
          .values({
            shopId,
            planId: quote.planId,
            purchaseId: quote.id,
            planCode: quote.planCode,
            planName: quote.planName,
            durationMonths: quote.durationMonths,
            amountMinor: quote.amountMinor,
            startsAt: now,
            expiresAt: subscriptionExpiry(now, quote.durationMonths),
            source: "dummy_purchase",
          })
          .returning();
        return retailerSubscriptionDto(activated!);
      }),
    ),
};
