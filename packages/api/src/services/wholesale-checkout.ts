import { db } from "@bikalpo-project/db";
import { checkoutPromotion, checkoutSetting } from "@bikalpo-project/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";

import {
  buildCheckoutQuote,
  type CheckoutPromotionRecord,
  type CheckoutQuoteLine,
  normalizePromotionCode,
} from "./checkout-quote";

export const wholesaleCheckoutSelectionSchema = z.object({
  deliveryMode: z.enum(["self_pickup", "courier"]).default("courier"),
  paymentPlan: z.enum(["pay_now", "partial", "pay_later"]).default("pay_later"),
  partialAmount: z.coerce.number().positive().optional(),
  promotionCode: z.string().trim().max(40).optional(),
});

export const wholesaleCheckoutSubmissionSchema =
  wholesaleCheckoutSelectionSchema.extend({
    quoteVersion: z.string().min(10).max(80).optional(),
    quoteExpiresAt: z.coerce.date().optional(),
    idempotencyKey: z.string().trim().min(8).max(100).optional(),
    invoiceContact: z
      .object({
        name: z.string().trim().min(1).max(150),
        phone: z.string().trim().min(5).max(30),
        email: z.string().trim().email().optional().or(z.literal("")),
      })
      .optional(),
  });

export async function getSellerCheckoutConfiguration(ownerId: string) {
  const setting = await db.query.checkoutSetting.findFirst({
    where: eq(checkoutSetting.ownerId, ownerId),
  });
  return {
    allowSelfPickup: setting?.allowSelfPickup ?? true,
    allowCourier: setting?.allowCourier ?? true,
    defaultShippingFee: Number(setting?.defaultShippingFee ?? 0),
    taxPercentage: Number(setting?.taxPercentage ?? 0),
    wholesaleCreditDays: setting?.wholesaleCreditDays ?? 0,
  };
}

export async function getSellerCheckoutPromotion(input: {
  sellerId: string;
  code?: string | null;
}): Promise<CheckoutPromotionRecord | null> {
  const normalizedCode = normalizePromotionCode(input.code);
  if (!normalizedCode) return null;

  const promotion = await db.query.checkoutPromotion.findFirst({
    where: and(
      eq(checkoutPromotion.ownerId, input.sellerId),
      sql`upper(${checkoutPromotion.code}) = ${normalizedCode}`,
    ),
  });
  if (!promotion) {
    throw new Error("Promotion code was not found for this supplier");
  }

  return {
    id: promotion.id,
    ownerId: promotion.ownerId,
    code: promotion.code,
    audience: promotion.audience,
    isActive: promotion.isActive,
    type: promotion.type,
    value: Number(promotion.value),
    minimumSubtotal: Number(promotion.minimumSubtotal),
    maximumDiscount:
      promotion.maximumDiscount == null
        ? null
        : Number(promotion.maximumDiscount),
    startsAt: promotion.startsAt,
    endsAt: promotion.endsAt,
    usageLimit: promotion.usageLimit,
    usedCount: promotion.usedCount,
  };
}

export async function buildWholesaleCheckoutQuote(input: {
  sellerId: string;
  lines: CheckoutQuoteLine[];
  selection: z.infer<typeof wholesaleCheckoutSelectionSchema>;
}) {
  const [configuration, promotion] = await Promise.all([
    getSellerCheckoutConfiguration(input.sellerId),
    getSellerCheckoutPromotion({
      sellerId: input.sellerId,
      code: input.selection.promotionCode,
    }),
  ]);

  if (
    (input.selection.deliveryMode === "self_pickup" &&
      !configuration.allowSelfPickup) ||
    (input.selection.deliveryMode === "courier" && !configuration.allowCourier)
  ) {
    throw new Error("The selected delivery method is not available");
  }

  const quote = buildCheckoutQuote({
    audience: "wholesale",
    sellerId: input.sellerId,
    lines: input.lines,
    deliveryMode: input.selection.deliveryMode,
    paymentPlan: input.selection.paymentPlan,
    partialAmount: input.selection.partialAmount,
    shippingFee: configuration.defaultShippingFee,
    taxPercentage: configuration.taxPercentage,
    promotion,
  });

  return { quote, configuration, promotion };
}

export function getWholesalePaymentDueAt(input: {
  paymentPlan: "pay_now" | "partial" | "pay_later";
  creditDays: number;
  now?: Date;
}) {
  if (input.paymentPlan !== "pay_later" || input.creditDays <= 0) return null;
  const dueAt = new Date(input.now ?? new Date());
  dueAt.setDate(dueAt.getDate() + input.creditDays);
  return dueAt;
}
