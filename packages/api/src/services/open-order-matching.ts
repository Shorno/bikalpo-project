/** Atomic Open Order matching, offer, deadline, and stock-hold services. */

import { db } from "@bikalpo-project/db";
import {
  inventory,
  openOrderBid,
  openOrderBidItem,
  order,
  orderItem,
  productVariant,
  sellerAreaMapping,
  user,
} from "@bikalpo-project/db/schema";
import { haversineDistance } from "@bikalpo-project/db/spatial-helpers";
import { and, asc, eq, inArray, isNull, lte, or, sql } from "drizzle-orm";
import { findAreasForPoint } from "./location-service";
import {
  calculateOfferTotals,
  type OfferDiscountType,
} from "./open-order-domain";

export const OPEN_ORDER_RADIUS_KM = 5;
export const OFFER_WINDOW_SECONDS = positiveSeconds(
  process.env.OPEN_ORDER_OFFER_WINDOW_SECONDS,
  300,
);
export const SELECTION_WINDOW_SECONDS = positiveSeconds(
  process.env.OPEN_ORDER_SELECTION_WINDOW_SECONDS,
  300,
);

function positiveSeconds(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

export interface CartItemForOpenOrder {
  productId: number;
  variantId: number;
  catalogVariantId: number;
  globalSkuSnapshot: string | null;
  sourceSkuSnapshot: string | null;
  productName: string;
  productImage: string;
  productSize: string;
  quantity: number;
  unitPrice: string;
  totalPrice: string;
}

export interface MatchedInventory {
  inventoryId: number;
  retailerVariantId: number;
  catalogVariantId: number;
  availableQty: number;
  retailPrice: string | null;
}

export interface EligibleSeller {
  shopId: string;
  shopName: string;
  distanceKm: number;
  areaId: number;
  matchedInventory: MatchedInventory[];
}

export interface PersistedOpenOrderItem {
  id: number;
  catalogVariantId: number;
  quantity: number;
  unitPrice: string;
}

type DatabaseClient = typeof db | any;

export async function findEligibleSellers(
  consumerLat: number,
  consumerLng: number,
  requestedItems: CartItemForOpenOrder[],
  selectedAreaId?: number,
): Promise<EligibleSeller[]> {
  const pointAreas = await findAreasForPoint(consumerLat, consumerLng);
  const areaIds = selectedAreaId
    ? pointAreas.some((entry) => entry.areaId === selectedAreaId)
      ? [selectedAreaId]
      : []
    : pointAreas.map((entry) => entry.areaId);
  if (areaIds.length === 0 || requestedItems.length === 0) return [];

  const required = new Map<number, number>();
  for (const item of requestedItems) {
    required.set(
      item.catalogVariantId,
      (required.get(item.catalogVariantId) ?? 0) + item.quantity,
    );
  }
  const catalogVariantIds = [...required.keys()];

  const shops = await db
    .select({
      id: user.id,
      name: user.name,
      shopName: user.shopName,
      shopLat: user.shopLat,
      shopLng: user.shopLng,
    })
    .from(user)
    .where(
      and(
        eq(user.role, "shop_owner"),
        eq(user.sellerStatus, "approved"),
        eq(user.banned, false),
      ),
    );
  const locatedShops = shops.filter((shop) => shop.shopLat && shop.shopLng);
  if (locatedShops.length === 0) return [];

  const shopIds = locatedShops.map((shop) => shop.id);
  const [areaMappings, stock] = await Promise.all([
    db
      .select({
        sellerId: sellerAreaMapping.sellerId,
        areaId: sellerAreaMapping.areaId,
      })
      .from(sellerAreaMapping)
      .where(
        and(
          inArray(sellerAreaMapping.sellerId, shopIds),
          inArray(sellerAreaMapping.areaId, areaIds),
          eq(sellerAreaMapping.isActive, true),
        ),
      ),
    db
      .select({
        inventoryId: inventory.id,
        shopId: inventory.ownerId,
        retailerVariantId: inventory.variantId,
        catalogVariantId: productVariant.catalogVariantId,
        availableQty: inventory.availableQty,
        retailPrice: inventory.retailPrice,
      })
      .from(inventory)
      .innerJoin(productVariant, eq(productVariant.id, inventory.variantId))
      .where(
        and(
          eq(inventory.ownerType, "shop"),
          inArray(inventory.ownerId, shopIds),
          inArray(productVariant.catalogVariantId, catalogVariantIds),
          eq(productVariant.isActive, true),
        ),
      ),
  ]);

  const areaByShop = new Map<string, number>();
  for (const mapping of areaMappings) {
    if (!areaByShop.has(mapping.sellerId))
      areaByShop.set(mapping.sellerId, mapping.areaId);
  }
  const stockByShop = new Map<string, MatchedInventory[]>();
  for (const row of stock) {
    if (!row.catalogVariantId) continue;
    const rows = stockByShop.get(row.shopId) ?? [];
    rows.push({
      inventoryId: row.inventoryId,
      retailerVariantId: row.retailerVariantId,
      catalogVariantId: row.catalogVariantId,
      availableQty: Number(row.availableQty),
      retailPrice: row.retailPrice,
    });
    stockByShop.set(row.shopId, rows);
  }

  const eligible: EligibleSeller[] = [];
  for (const shop of locatedShops) {
    const areaId = areaByShop.get(shop.id);
    if (!areaId) continue;
    const distanceKm = haversineDistance(
      consumerLat,
      consumerLng,
      Number(shop.shopLat),
      Number(shop.shopLng),
    );
    if (!Number.isFinite(distanceKm) || distanceKm > OPEN_ORDER_RADIUS_KM)
      continue;

    const candidateRows = stockByShop.get(shop.id) ?? [];
    const matchedInventory: MatchedInventory[] = [];
    for (const [catalogVariantId, quantity] of required) {
      const row = candidateRows.find(
        (candidate) =>
          candidate.catalogVariantId === catalogVariantId &&
          candidate.availableQty >= quantity,
      );
      if (!row) break;
      matchedInventory.push(row);
    }
    if (matchedInventory.length !== required.size) continue;

    eligible.push({
      shopId: shop.id,
      shopName: shop.shopName ?? shop.name,
      distanceKm: Math.round(distanceKm * 100) / 100,
      areaId,
      matchedInventory,
    });
  }

  return eligible.sort((left, right) => left.distanceKm - right.distanceKm);
}

export async function createOffersForOrder(
  database: DatabaseClient,
  orderId: number,
  sellers: EligibleSeller[],
  items: PersistedOpenOrderItem[],
) {
  for (const [index, seller] of sellers.entries()) {
    const [offer] = await database
      .insert(openOrderBid)
      .values({
        subOrderId: orderId,
        shopId: seller.shopId,
        rank: index + 1,
        distanceKm: seller.distanceKm.toFixed(2),
        status: "available",
      })
      .returning({ id: openOrderBid.id });
    if (!offer) continue;

    await database.insert(openOrderBidItem).values(
      items.map((item) => {
        const matched = seller.matchedInventory.find(
          (entry) => entry.catalogVariantId === item.catalogVariantId,
        );
        if (!matched)
          throw new Error("Eligible retailer lost its exact inventory match.");
        return {
          bidId: offer.id,
          orderItemId: item.id,
          inventoryId: matched.inventoryId,
          platformPrice: item.unitPrice,
          sellerPrice: null,
        };
      }),
    );
  }
}

async function getOfferLines(database: DatabaseClient, bidId: number) {
  return database
    .select({
      bidItemId: openOrderBidItem.id,
      orderItemId: orderItem.id,
      quantity: orderItem.quantity,
      inventoryId: inventory.id,
      retailerVariantId: inventory.variantId,
      availableQty: inventory.availableQty,
      reservedQty: inventory.reservedQty,
      retailPrice: inventory.retailPrice,
      sellerPrice: openOrderBidItem.sellerPrice,
      retailerSku: productVariant.sku,
    })
    .from(openOrderBidItem)
    .innerJoin(orderItem, eq(orderItem.id, openOrderBidItem.orderItemId))
    .innerJoin(inventory, eq(inventory.id, openOrderBidItem.inventoryId))
    .innerJoin(productVariant, eq(productVariant.id, inventory.variantId))
    .where(eq(openOrderBidItem.bidId, bidId));
}

async function releaseOfferHold(
  database: DatabaseClient,
  bid: any,
  now = new Date(),
) {
  if (!bid.reservationHeld) return false;
  const claimed = await database
    .update(openOrderBid)
    .set({
      reservationHeld: false,
      reservationState: "released",
      reservationReleasedAt: now,
    })
    .where(
      and(eq(openOrderBid.id, bid.id), eq(openOrderBid.reservationHeld, true)),
    )
    .returning({ id: openOrderBid.id });
  if (claimed.length === 0) return false;
  const lines = await getOfferLines(database, bid.id);
  for (const line of lines) {
    const released = await database
      .update(inventory)
      .set({
        availableQty: sql`${inventory.availableQty} + ${line.quantity}`,
        reservedQty: sql`${inventory.reservedQty} - ${line.quantity}`,
      })
      .where(
        and(
          eq(inventory.id, line.inventoryId),
          sql`CAST(${inventory.reservedQty} AS numeric) >= ${line.quantity}`,
        ),
      )
      .returning({ id: inventory.id });
    if (released.length === 0) {
      throw new Error("The offer's stock hold is inconsistent.");
    }
  }
  return true;
}

export async function submitRetailerOffer(input: {
  bidId: number;
  shopId: string;
  discountType: OfferDiscountType;
  discountValue: number;
  deliveryCharge: number;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  return db.transaction(async (tx) => {
    const bidReference = await tx.query.openOrderBid.findFirst({
      where: and(
        eq(openOrderBid.id, input.bidId),
        eq(openOrderBid.shopId, input.shopId),
      ),
    });
    if (!bidReference) throw new Error("Offer not found.");
    await tx.execute(
      sql`SELECT id FROM "order" WHERE id = ${bidReference.subOrderId} FOR UPDATE`,
    );
    const bid = await tx.query.openOrderBid.findFirst({
      where: and(
        eq(openOrderBid.id, input.bidId),
        eq(openOrderBid.shopId, input.shopId),
      ),
    });
    if (!bid) throw new Error("Offer not found.");
    if (!inArrayValue(bid.status, ["available", "submitted"])) {
      throw new Error("This offer can no longer be submitted.");
    }
    const wasRevision = bid.status === "submitted";
    const request = await tx.query.order.findFirst({
      where: eq(order.id, bid.subOrderId),
    });
    if (!request?.broadcastExpiresAt || now >= request.broadcastExpiresAt) {
      throw new Error("The offer window has closed.");
    }

    const lines = await getOfferLines(tx, bid.id);
    if (lines.length === 0)
      throw new Error("Offer has no matched inventory lines.");
    const pricedLines = lines.map((line: any) => ({
      quantity: line.quantity,
      unitPrice: Number(line.retailPrice),
    }));
    const totals = calculateOfferTotals({
      lines: pricedLines,
      discountType: input.discountType,
      discountValue: input.discountValue,
      deliveryCharge: input.deliveryCharge,
    });

    let shouldReserve = false;
    if (!bid.reservationHeld) {
      const claim = await tx
        .update(openOrderBid)
        .set({
          reservationHeld: true,
          reservationState: "held",
          reservationReleasedAt: null,
        })
        .where(
          and(
            eq(openOrderBid.id, bid.id),
            eq(openOrderBid.reservationHeld, false),
          ),
        )
        .returning({ id: openOrderBid.id });
      shouldReserve = claim.length > 0;
      if (!shouldReserve) {
        throw new Error("The offer's reservation state changed. Please retry.");
      }
    }
    if (shouldReserve) {
      for (const line of lines) {
        const reserved = await tx
          .update(inventory)
          .set({
            availableQty: sql`${inventory.availableQty} - ${line.quantity}`,
            reservedQty: sql`${inventory.reservedQty} + ${line.quantity}`,
          })
          .where(
            and(
              eq(inventory.id, line.inventoryId),
              sql`CAST(${inventory.availableQty} AS numeric) >= ${line.quantity}`,
            ),
          )
          .returning({ id: inventory.id });
        if (reserved.length === 0) {
          throw new Error("Required stock is no longer available.");
        }
      }
    }

    for (const line of lines) {
      await tx
        .update(openOrderBidItem)
        .set({ sellerPrice: Number(line.retailPrice).toFixed(2) })
        .where(eq(openOrderBidItem.id, line.bidItemId));
    }
    const [updated] = await tx
      .update(openOrderBid)
      .set({
        status: "submitted",
        submittedAt: now,
        itemSubtotal: totals.itemSubtotal.toFixed(2),
        discountType: input.discountType,
        discountValue: input.discountValue.toFixed(2),
        discountAmount: totals.discountAmount.toFixed(2),
        deliveryCharge: totals.deliveryCharge.toFixed(2),
        totalBid: totals.finalTotal.toFixed(2),
        reservationHeld: true,
        reservationState: "held",
        reservationReleasedAt: null,
      })
      .where(eq(openOrderBid.id, bid.id))
      .returning();
    await tx
      .update(order)
      .set({ status: "negotiating" })
      .where(eq(order.id, bid.subOrderId));
    return { ...updated!, wasRevision };
  });
}

export async function withdrawRetailerOffer(input: {
  bidId: number;
  shopId: string;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  return db.transaction(async (tx) => {
    const bidReference = await tx.query.openOrderBid.findFirst({
      where: and(
        eq(openOrderBid.id, input.bidId),
        eq(openOrderBid.shopId, input.shopId),
      ),
    });
    if (!bidReference) throw new Error("Offer not found.");
    await tx.execute(
      sql`SELECT id FROM "order" WHERE id = ${bidReference.subOrderId} FOR UPDATE`,
    );
    const bid = await tx.query.openOrderBid.findFirst({
      where: and(
        eq(openOrderBid.id, input.bidId),
        eq(openOrderBid.shopId, input.shopId),
      ),
    });
    if (!bid) throw new Error("Offer not found.");
    const request = await tx.query.order.findFirst({
      where: eq(order.id, bid.subOrderId),
    });
    if (!request?.broadcastExpiresAt || now >= request.broadcastExpiresAt) {
      throw new Error("The offer window has closed.");
    }
    if (!inArrayValue(bid.status, ["available", "submitted"])) {
      throw new Error("This offer can no longer be withdrawn.");
    }
    await releaseOfferHold(tx, bid, now);
    await tx
      .update(openOrderBid)
      .set({ status: "released", reservationHeld: false })
      .where(eq(openOrderBid.id, bid.id));
    return { orderId: bid.subOrderId };
  });
}

async function recalculateOffer(database: DatabaseClient, bid: any) {
  if (bid.status !== "submitted" || bid.priceFrozenAt) return null;
  const lines = await getOfferLines(database, bid.id);
  const totals = calculateOfferTotals({
    lines: lines.map((line: any) => ({
      quantity: line.quantity,
      unitPrice: Number(line.retailPrice),
    })),
    discountType: bid.discountType ?? "fixed",
    discountValue: Number(bid.discountValue ?? 0),
    deliveryCharge: Number(bid.deliveryCharge ?? 0),
  });
  for (const line of lines) {
    await database
      .update(openOrderBidItem)
      .set({ sellerPrice: Number(line.retailPrice).toFixed(2) })
      .where(eq(openOrderBidItem.id, line.bidItemId));
  }
  await database
    .update(openOrderBid)
    .set({
      itemSubtotal: totals.itemSubtotal.toFixed(2),
      discountAmount: totals.discountAmount.toFixed(2),
      totalBid: totals.finalTotal.toFixed(2),
    })
    .where(eq(openOrderBid.id, bid.id));
  return bid.subOrderId as number;
}

export async function recalculateOffersForInventory(
  inventoryId: number,
  shopId: string,
  nextRetailPrice?: number,
) {
  const now = new Date();
  return db.transaction(async (tx) => {
    if (nextRetailPrice !== undefined) {
      const updatedInventory = await tx
        .update(inventory)
        .set({
          retailPrice: nextRetailPrice.toFixed(2),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(inventory.id, inventoryId),
            eq(inventory.ownerType, "shop"),
            eq(inventory.ownerId, shopId),
          ),
        )
        .returning({ id: inventory.id });
      if (updatedInventory.length === 0) {
        throw new Error("Retail inventory not found.");
      }
    }
    const bids = await tx
      .selectDistinct({
        id: openOrderBid.id,
        orderId: openOrderBid.subOrderId,
      })
      .from(openOrderBid)
      .innerJoin(openOrderBidItem, eq(openOrderBidItem.bidId, openOrderBid.id))
      .innerJoin(order, eq(order.id, openOrderBid.subOrderId))
      .where(
        and(
          eq(openOrderBid.shopId, shopId),
          eq(openOrderBid.status, "submitted"),
          isNull(openOrderBid.priceFrozenAt),
          eq(openOrderBidItem.inventoryId, inventoryId),
          sql`${order.broadcastExpiresAt} > ${now}`,
        ),
      )
      .orderBy(asc(openOrderBid.subOrderId), asc(openOrderBid.id));
    const orderIds = new Set<number>();
    for (const row of bids) {
      const bidReference = await tx.query.openOrderBid.findFirst({
        where: eq(openOrderBid.id, row.id),
      });
      if (!bidReference) continue;
      await tx.execute(
        sql`SELECT id FROM "order" WHERE id = ${bidReference.subOrderId} FOR UPDATE`,
      );
      const request = await tx.query.order.findFirst({
        where: eq(order.id, bidReference.subOrderId),
      });
      const bid = await tx.query.openOrderBid.findFirst({
        where: eq(openOrderBid.id, row.id),
      });
      if (
        !request?.broadcastExpiresAt ||
        new Date() >= request.broadcastExpiresAt ||
        !bid
      ) {
        continue;
      }
      const orderId = await recalculateOffer(tx, bid);
      if (orderId) orderIds.add(orderId);
    }
    return [...orderIds];
  });
}

export async function reconcileOpenOrder(orderId: number, now = new Date()) {
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`SELECT id FROM "order" WHERE id = ${orderId} FOR UPDATE`,
    );
    const request = await tx.query.order.findFirst({
      where: eq(order.id, orderId),
    });
    if (
      !request?.isOpenOrder ||
      request.status === "confirmed" ||
      request.status === "cancelled"
    ) {
      return "unchanged" as const;
    }
    const bids = await tx.query.openOrderBid.findMany({
      where: eq(openOrderBid.subOrderId, orderId),
    });

    if (request.selectionExpiresAt && now >= request.selectionExpiresAt) {
      const cancelled = await tx
        .update(order)
        .set({
          status: "cancelled",
          cancelledAt: now,
          openOrderOutcome: "selection_expired",
        })
        .where(
          and(
            eq(order.id, orderId),
            inArray(order.status, ["matching_shop", "negotiating"]),
          ),
        )
        .returning({ id: order.id });
      if (cancelled.length === 0) return "unchanged" as const;
      for (const bid of bids) await releaseOfferHold(tx, bid, now);
      await tx
        .update(openOrderBid)
        .set({ status: "expired", reservationHeld: false })
        .where(
          and(
            eq(openOrderBid.subOrderId, orderId),
            inArray(openOrderBid.status, ["available", "locked", "submitted"]),
          ),
        );
      return "expired" as const;
    }

    if (request.broadcastExpiresAt && now >= request.broadcastExpiresAt) {
      const submitted = bids.filter((bid) => bid.status === "submitted");
      if (submitted.length === 0) {
        await tx
          .update(openOrderBid)
          .set({ status: "lost" })
          .where(
            and(
              eq(openOrderBid.subOrderId, orderId),
              inArray(openOrderBid.status, ["available", "locked"]),
            ),
          );
        await tx
          .update(order)
          .set({
            status: "cancelled",
            cancelledAt: now,
            openOrderOutcome: "no_offers",
          })
          .where(
            and(
              eq(order.id, orderId),
              inArray(order.status, ["matching_shop", "negotiating"]),
            ),
          );
        return "no_offers" as const;
      }
      const frozen = await tx
        .update(openOrderBid)
        .set({ priceFrozenAt: request.broadcastExpiresAt })
        .where(
          and(
            eq(openOrderBid.subOrderId, orderId),
            eq(openOrderBid.status, "submitted"),
            isNull(openOrderBid.priceFrozenAt),
          ),
        )
        .returning({ id: openOrderBid.id });
      await tx
        .update(openOrderBid)
        .set({ status: "lost" })
        .where(
          and(
            eq(openOrderBid.subOrderId, orderId),
            inArray(openOrderBid.status, ["available", "locked"]),
          ),
        );
      await tx
        .update(order)
        .set({ status: "negotiating" })
        .where(eq(order.id, orderId));
      return frozen.length > 0
        ? ("offer_window_closed" as const)
        : ("unchanged" as const);
    }
    return "unchanged" as const;
  });
}

export async function cancelOpenOrder(userId: string, orderId: number) {
  return db.transaction(async (tx) => {
    const request = await tx.query.order.findFirst({
      where: and(
        eq(order.id, orderId),
        eq(order.userId, userId),
        eq(order.isOpenOrder, true),
      ),
    });
    if (!request) throw new Error("Open order not found.");
    if (!inArrayValue(request.status, ["matching_shop", "negotiating"])) {
      throw new Error("This open order can no longer be cancelled.");
    }
    const now = new Date();
    const cancelled = await tx
      .update(order)
      .set({
        status: "cancelled",
        cancelledAt: now,
        openOrderOutcome: "consumer_cancelled",
      })
      .where(
        and(
          eq(order.id, orderId),
          eq(order.userId, userId),
          inArray(order.status, ["matching_shop", "negotiating"]),
        ),
      )
      .returning({ id: order.id });
    if (cancelled.length === 0) {
      throw new Error("This open order was already completed or cancelled.");
    }
    const bids = await tx.query.openOrderBid.findMany({
      where: eq(openOrderBid.subOrderId, orderId),
    });
    for (const bid of bids) await releaseOfferHold(tx, bid, now);
    await tx
      .update(openOrderBid)
      .set({ status: "lost", reservationHeld: false })
      .where(
        and(
          eq(openOrderBid.subOrderId, orderId),
          inArray(openOrderBid.status, ["available", "locked", "submitted"]),
        ),
      );
    return request;
  });
}

export async function acceptOpenOrderOffer(input: {
  userId: string;
  orderId: number;
  bidId: number;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  await reconcileOpenOrder(input.orderId, now);
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`SELECT id FROM "order" WHERE id = ${input.orderId} FOR UPDATE`,
    );
    const request = await tx.query.order.findFirst({
      where: and(eq(order.id, input.orderId), eq(order.userId, input.userId)),
    });
    if (!request) throw new Error("Open order not found.");
    const selected = await tx.query.openOrderBid.findFirst({
      where: and(
        eq(openOrderBid.id, input.bidId),
        eq(openOrderBid.subOrderId, input.orderId),
        eq(openOrderBid.status, "submitted"),
      ),
    });
    if (!selected?.reservationHeld || !selected.priceFrozenAt) {
      throw new Error("The selected offer is not available.");
    }
    const lines = await getOfferLines(tx, selected.id);
    const [confirmed] = await tx
      .update(order)
      .set({
        shopId: selected.shopId,
        status: "confirmed",
        subtotal: selected.itemSubtotal!,
        shippingCost: selected.deliveryCharge!,
        discount: selected.discountAmount!,
        total: selected.totalBid!,
        previousTotal: request.subtotal,
        confirmedSubtotal: selected.itemSubtotal!,
        confirmedTotal: selected.totalBid!,
        confirmedAt: now,
      })
      .where(
        and(
          eq(order.id, input.orderId),
          eq(order.userId, input.userId),
          eq(order.isOpenOrder, true),
          inArray(order.status, ["matching_shop", "negotiating"]),
          isNull(order.shopId),
          lte(order.broadcastExpiresAt, now),
          sql`${order.selectionExpiresAt} > ${now}`,
        ),
      )
      .returning();
    if (!confirmed) {
      throw new Error(
        "The offer was already accepted, expired, or is not selectable yet.",
      );
    }

    for (const line of lines) {
      const unitPrice = Number(line.sellerPrice).toFixed(2);
      await tx
        .update(orderItem)
        .set({
          variantId: line.retailerVariantId,
          unitPrice,
          totalPrice: (Number(unitPrice) * line.quantity).toFixed(2),
          targetSkuSnapshot: line.retailerSku,
        })
        .where(eq(orderItem.id, line.orderItemId));
      const consumed = await tx
        .update(inventory)
        .set({ reservedQty: sql`${inventory.reservedQty} - ${line.quantity}` })
        .where(
          and(
            eq(inventory.id, line.inventoryId),
            sql`CAST(${inventory.reservedQty} AS numeric) >= ${line.quantity}`,
          ),
        )
        .returning({ id: inventory.id });
      if (consumed.length === 0) {
        throw new Error("The selected offer's stock hold is no longer valid.");
      }
    }
    await tx
      .update(openOrderBid)
      .set({
        isWinner: true,
        reservationHeld: false,
        reservationState: "consumed",
        reservationReleasedAt: now,
      })
      .where(eq(openOrderBid.id, selected.id));

    const losers = await tx.query.openOrderBid.findMany({
      where: and(
        eq(openOrderBid.subOrderId, input.orderId),
        sql`${openOrderBid.id} <> ${selected.id}`,
      ),
    });
    for (const loser of losers) await releaseOfferHold(tx, loser, now);
    await tx
      .update(openOrderBid)
      .set({ status: "lost", reservationHeld: false })
      .where(
        and(
          eq(openOrderBid.subOrderId, input.orderId),
          sql`${openOrderBid.id} <> ${selected.id}`,
        ),
      );
    return {
      order: confirmed,
      winningOffer: selected,
      losingShopIds: losers.map((bid) => bid.shopId),
    };
  });
}

export async function processDueOpenOrders(now = new Date()) {
  const due = await db
    .select({ id: order.id })
    .from(order)
    .where(
      and(
        eq(order.isOpenOrder, true),
        inArray(order.status, ["matching_shop", "negotiating"]),
        or(
          lte(order.broadcastExpiresAt, now),
          lte(order.selectionExpiresAt, now),
        ),
      ),
    )
    .orderBy(asc(order.id));
  const results: Array<{
    orderId: number;
    action: Awaited<ReturnType<typeof reconcileOpenOrder>>;
    shopIds: string[];
  }> = [];
  for (const row of due) {
    const action = await reconcileOpenOrder(row.id, now);
    const shops = await db
      .select({ shopId: openOrderBid.shopId })
      .from(openOrderBid)
      .where(eq(openOrderBid.subOrderId, row.id));
    results.push({
      orderId: row.id,
      action,
      shopIds: [...new Set(shops.map((shop) => shop.shopId))],
    });
  }
  return results;
}

export async function isOpenOrderOwner(orderId: number, userId: string) {
  const owned = await db.query.order.findFirst({
    where: and(
      eq(order.id, orderId),
      eq(order.userId, userId),
      eq(order.isOpenOrder, true),
    ),
    columns: { id: true },
  });
  return Boolean(owned);
}

function inArrayValue<T extends string>(
  value: string,
  values: readonly T[],
): value is T {
  return values.includes(value as T);
}
