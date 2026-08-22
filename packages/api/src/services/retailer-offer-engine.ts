import { db } from "@bikalpo-project/db";
import {
  retailerOffer,
  retailerOfferApplication,
} from "@bikalpo-project/db/schema";
import { and, eq, inArray, sql } from "drizzle-orm";

import { getOwnerPosCatalog } from "./owner-pos-store";

export type OfferBasketLine = {
  variantId: number;
  productId: number;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

export type AppliedRetailerOffer = {
  offerId: number;
  code: string;
  name: string;
  discountAmount: number;
  salesAmount: number;
};

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function dhakaTime(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Dhaka",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function isInCustomTime(
  now: Date,
  startTime: string | null,
  endTime: string | null,
) {
  if (!startTime || !endTime) return false;
  const current = dhakaTime(now);
  if (startTime <= endTime) return current >= startTime && current <= endTime;
  return current >= startTime || current <= endTime;
}

/**
 * Returns the single best eligible retailer offer for a basket. Choosing one
 * offer avoids undocumented stacking while still guaranteeing automatic use.
 */
export async function evaluateRetailerOffer(input: {
  shopId: string;
  lines: OfferBasketLine[];
  customerKey?: string | null;
  areaId?: number | null;
  now?: Date;
}): Promise<AppliedRetailerOffer | null> {
  const now = input.now ?? new Date();
  const offers = await db
    .select()
    .from(retailerOffer)
    .where(
      and(
        eq(retailerOffer.shopId, input.shopId),
        inArray(retailerOffer.status, ["active", "scheduled"]),
        sql`${retailerOffer.startDate} <= ${now}`,
        sql`${retailerOffer.endDate} > ${now}`,
        sql`${retailerOffer.deactivatedAt} IS NULL`,
      ),
    );
  if (offers.length === 0) return null;

  const [catalog, usage] = await Promise.all([
    getOwnerPosCatalog({ kind: "shop", id: input.shopId }),
    db
      .select({
        offerId: retailerOfferApplication.retailerOfferId,
        count: sql<number>`count(*)::int`,
      })
      .from(retailerOfferApplication)
      .where(eq(retailerOfferApplication.shopId, input.shopId))
      .groupBy(retailerOfferApplication.retailerOfferId),
  ]);
  const categoryByVariant = new Map(
    catalog.map((row) => [row.variantId, row.categoryId]),
  );
  const useCount = new Map(usage.map((row) => [row.offerId, row.count]));
  const candidates: AppliedRetailerOffer[] = [];

  for (const offer of offers) {
    if (!offer.allDay && !isInCustomTime(now, offer.startTime, offer.endTime)) {
      continue;
    }
    if (
      offer.maximumLimit != null &&
      (useCount.get(offer.id) ?? 0) >= offer.maximumLimit
    ) {
      continue;
    }
    if (
      offer.targetType === "specific_customers" &&
      (!input.customerKey ||
        !offer.targetCustomerKeys.includes(input.customerKey))
    ) {
      continue;
    }
    if (
      offer.targetType === "area" &&
      (!input.areaId || !offer.targetAreaIds.includes(input.areaId))
    ) {
      continue;
    }

    const qualifying = input.lines.filter((line) => {
      if (offer.applyTo === "all_products") return true;
      if (offer.applyTo === "product") {
        return offer.variantId
          ? line.variantId === offer.variantId
          : line.productId === offer.productId;
      }
      return categoryByVariant.get(line.variantId) === offer.categoryId;
    });
    const quantity = qualifying.reduce((sum, line) => sum + line.quantity, 0);
    const salesAmount = qualifying.reduce(
      (sum, line) => sum + line.lineTotal,
      0,
    );
    if (quantity < Number(offer.minimumQuantity) || salesAmount <= 0) continue;

    let discountAmount = 0;
    if (offer.offerType === "percentage") {
      discountAmount =
        salesAmount * Math.min(Number(offer.discountValue ?? 0), 100) * 0.01;
    } else if (offer.offerType === "flat") {
      discountAmount = Math.min(Number(offer.discountValue ?? 0), salesAmount);
    } else {
      const buyQuantity = Math.max(Number(offer.minimumQuantity), 1);
      const getQuantity = Math.max(
        offer.templateSnapshot.getProducts.reduce(
          (sum, product) => sum + product.quantity,
          0,
        ),
        1,
      );
      const applications = Math.max(Math.floor(quantity / buyQuantity), 1);
      const lowestPrice = Math.min(...qualifying.map((line) => line.unitPrice));
      const freeValue = lowestPrice * getQuantity * applications;
      if (offer.discountType === "percentage_discount") {
        discountAmount =
          freeValue * Math.min(Number(offer.discountValue ?? 0), 100) * 0.01;
      } else if (offer.discountType === "fixed_price") {
        discountAmount = Math.max(
          freeValue - Number(offer.discountValue ?? 0) * getQuantity,
          0,
        );
      } else {
        discountAmount = freeValue;
      }
    }
    discountAmount = roundMoney(Math.min(discountAmount, salesAmount));
    if (discountAmount <= 0) continue;
    candidates.push({
      offerId: offer.id,
      code: offer.code,
      name: offer.name,
      discountAmount,
      salesAmount: roundMoney(salesAmount),
    });
  }

  return (
    candidates.sort(
      (left, right) => right.discountAmount - left.discountAmount,
    )[0] ?? null
  );
}
