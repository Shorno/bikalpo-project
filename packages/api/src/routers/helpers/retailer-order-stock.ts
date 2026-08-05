import type { db } from "@bikalpo-project/db";
import {
  inventory,
  product,
  productVariant,
  user,
} from "@bikalpo-project/db/schema";
import { and, eq, sql } from "drizzle-orm";

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type DbClient = typeof db | DbTransaction;

export type RetailerOrderStockLine = {
  productId: number;
  variantId: number | null;
  productName: string;
  quantity: number;
  inventoryQty?: string | null;
};

export type RetailerOrderStockMutation = {
  shopId: string;
  productId: number;
  variantId: number;
  quantity: number;
};

export interface RetailerOrderStockWriter {
  reserve(input: RetailerOrderStockMutation): Promise<boolean>;
  release(input: RetailerOrderStockMutation): Promise<boolean>;
  consume(input: RetailerOrderStockMutation): Promise<boolean>;
}

export class RetailerOrderStockError extends Error {
  constructor(
    readonly operation: "reserve" | "release" | "consume",
    readonly line: RetailerOrderStockLine,
  ) {
    super(
      operation === "reserve"
        ? `Insufficient retailer stock for ${line.productName}`
        : operation === "release"
          ? `Retailer inventory reservation could not be released for ${line.productName}`
          : `Retailer inventory reservation could not be completed for ${line.productName}`,
    );
    this.name = "RetailerOrderStockError";
  }
}

/**
 * The only database adapter used to mutate consumer-facing retailer stock.
 * Product identity is checked as well as the shop and variant so a stale or
 * malformed order line can never mutate another inventory row.
 */
export function createRetailerOrderStockWriter(
  database: DbClient,
): RetailerOrderStockWriter {
  const exactInventoryRow = (input: RetailerOrderStockMutation) =>
    and(
      eq(inventory.ownerType, "shop"),
      eq(inventory.ownerId, input.shopId),
      eq(inventory.variantId, input.variantId),
      sql`EXISTS (
        SELECT 1
        FROM ${productVariant}
        WHERE ${productVariant.id} = ${input.variantId}
          AND ${productVariant.productId} = ${input.productId}
      )`,
    );
  const sellableInventoryRow = (input: RetailerOrderStockMutation) =>
    and(
      exactInventoryRow(input),
      sql`${inventory.retailPrice} IS NOT NULL`,
      sql`${inventory.retailPrice}::numeric > 0`,
      sql`EXISTS (
        SELECT 1
        FROM ${productVariant}
        INNER JOIN ${product} ON ${product.id} = ${productVariant.productId}
        INNER JOIN ${user} ON ${user.id} = ${input.shopId}
        WHERE ${productVariant.id} = ${input.variantId}
          AND ${productVariant.productId} = ${input.productId}
          AND ${productVariant.isActive} IS TRUE
          AND ${product.status} = 'active'
          AND ${product.visibility} = 'public'
          AND ${user.role} = 'shop_owner'
          AND ${user.sellerStatus} = 'approved'
      )`,
    );

  return {
    async reserve(input) {
      const updated = await database
        .update(inventory)
        .set({
          availableQty: sql`${inventory.availableQty}::numeric - ${input.quantity}`,
          reservedQty: sql`${inventory.reservedQty}::numeric + ${input.quantity}`,
          updatedAt: new Date(),
        })
        .where(
          and(
            sellableInventoryRow(input),
            sql`${inventory.availableQty}::numeric >= ${input.quantity}`,
          ),
        )
        .returning({ id: inventory.id });
      return updated.length === 1;
    },

    async release(input) {
      const updated = await database
        .update(inventory)
        .set({
          availableQty: sql`${inventory.availableQty}::numeric + ${input.quantity}`,
          reservedQty: sql`${inventory.reservedQty}::numeric - ${input.quantity}`,
          updatedAt: new Date(),
        })
        .where(
          and(
            exactInventoryRow(input),
            sql`${inventory.reservedQty}::numeric >= ${input.quantity}`,
          ),
        )
        .returning({ id: inventory.id });
      return updated.length === 1;
    },

    async consume(input) {
      const updated = await database
        .update(inventory)
        .set({
          reservedQty: sql`${inventory.reservedQty}::numeric - ${input.quantity}`,
          updatedAt: new Date(),
        })
        .where(
          and(
            exactInventoryRow(input),
            sql`${inventory.reservedQty}::numeric >= ${input.quantity}`,
          ),
        )
        .returning({ id: inventory.id });
      return updated.length === 1;
    },
  };
}

export async function reserveRetailerOrderStock(
  writer: RetailerOrderStockWriter,
  shopId: string,
  lines: RetailerOrderStockLine[],
) {
  for (const line of lines) {
    const mutation = toMutation(shopId, line);
    if (!mutation || !(await writer.reserve(mutation))) {
      throw new RetailerOrderStockError("reserve", line);
    }
  }
}

export async function releaseRetailerOrderStock(
  writer: RetailerOrderStockWriter,
  shopId: string,
  lines: RetailerOrderStockLine[],
) {
  for (const line of lines) {
    const mutation = toMutation(shopId, line);
    if (!mutation || !(await writer.release(mutation))) {
      throw new RetailerOrderStockError("release", line);
    }
  }
}

export async function consumeRetailerOrderStock(
  writer: RetailerOrderStockWriter,
  shopId: string,
  lines: RetailerOrderStockLine[],
) {
  for (const line of lines) {
    const mutation = toMutation(shopId, line);
    if (!mutation || !(await writer.consume(mutation))) {
      throw new RetailerOrderStockError("consume", line);
    }
  }
}

/** @deprecated Use reserveRetailerOrderStock. */
export const deductRetailerOrderStock = reserveRetailerOrderStock;
/** @deprecated Use releaseRetailerOrderStock. */
export const restoreRetailerOrderStock = releaseRetailerOrderStock;

function toMutation(
  shopId: string,
  line: RetailerOrderStockLine,
): RetailerOrderStockMutation | null {
  if (!line.variantId) return null;

  const quantity = Number(line.inventoryQty ?? line.quantity);
  if (!Number.isFinite(quantity) || quantity <= 0) return null;

  return {
    shopId,
    productId: line.productId,
    variantId: line.variantId,
    quantity,
  };
}
