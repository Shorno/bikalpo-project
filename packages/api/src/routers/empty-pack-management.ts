import { db } from "@bikalpo-project/db";
import {
  brand,
  category,
  emptyPackMovement,
  emptyPackStock,
  inventory,
  order,
  orderItem,
  product,
  productType,
  productVariant,
  user,
} from "@bikalpo-project/db/schema";
import { ORPCError } from "@orpc/server";
import { and, eq, inArray, or, sql } from "drizzle-orm";
import { z } from "zod";
import { protectedProcedure } from "../index";
import { shopOrWarehouseOwnerScope } from "../shop-portal-scope";

function resolveOwner(user: { id: string; role?: string | null }) {
  return shopOrWarehouseOwnerScope(user, "inventory");
}

const actionSchema = z.enum(["damage", "supplier_return", "sale_application"]);

export const emptyPackManagementRouter = {
  getSummary: protectedProcedure.handler(async ({ context }) => {
    const { ownerId, ownerType } = resolveOwner(context.session.user);
    const [owner] = await db
      .select({
        name: user.name,
        shopName: user.shopName,
        warehouseName: user.warehouseName,
      })
      .from(user)
      .where(eq(user.id, ownerId))
      .limit(1);

    const [fullRows, emptyRows] = await Promise.all([
      db
        .select({
          variantId: productVariant.id,
          productId: product.id,
          productName: product.name,
          productImage: product.image,
          sku: productVariant.sku,
          unitLabel: productVariant.unitLabel,
          weightKg: productVariant.weightKg,
          brandName: brand.name,
          availableQty: inventory.availableQty,
          reservedQty: inventory.reservedQty,
        })
        .from(inventory)
        .innerJoin(productVariant, eq(inventory.variantId, productVariant.id))
        .innerJoin(product, eq(productVariant.productId, product.id))
        .leftJoin(category, eq(product.categoryId, category.id))
        .leftJoin(productType, eq(category.typeId, productType.id))
        .leftJoin(
          brand,
          eq(
            brand.id,
            sql`COALESCE(${productVariant.brandId}, ${product.brandId})`,
          ),
        )
        .where(
          and(
            eq(inventory.ownerType, ownerType),
            eq(inventory.ownerId, ownerId),
            or(
              eq(product.isReturnablePack, true),
              sql`lower(coalesce(${productType.family}::text, '')) = 'lpg'`,
            ),
          ),
        ),
      db
        .select({
          variantId: productVariant.id,
          productId: product.id,
          productName: product.name,
          productImage: product.image,
          sku: productVariant.sku,
          unitLabel: productVariant.unitLabel,
          weightKg: productVariant.weightKg,
          brandName: brand.name,
          availableQty: emptyPackStock.availableQty,
          damagedQty: emptyPackStock.damagedQty,
          returnedQty: emptyPackStock.returnedQty,
          appliedToSalesQty: emptyPackStock.appliedToSalesQty,
        })
        .from(emptyPackStock)
        .innerJoin(
          productVariant,
          eq(emptyPackStock.variantId, productVariant.id),
        )
        .innerJoin(product, eq(productVariant.productId, product.id))
        .leftJoin(
          brand,
          eq(
            brand.id,
            sql`COALESCE(${productVariant.brandId}, ${product.brandId})`,
          ),
        )
        .where(
          and(
            eq(emptyPackStock.ownerType, ownerType),
            eq(emptyPackStock.ownerId, ownerId),
          ),
        ),
    ]);

    const variantIds = Array.from(
      new Set([...fullRows, ...emptyRows].map((row) => row.variantId)),
    );
    const marketRows =
      variantIds.length === 0
        ? []
        : await db
            .select({
              variantId: orderItem.variantId,
              orderNumber: order.orderNumber,
              saleMode: orderItem.cylinderSaleMode,
              quantity: orderItem.quantity,
              modifiedQty: orderItem.modifiedQty,
              deliveredQty: orderItem.deliveredQty,
              convertedToNewQty: orderItem.convertedToNewQty,
            })
            .from(orderItem)
            .innerJoin(order, eq(orderItem.orderId, order.id))
            .where(
              and(
                inArray(orderItem.variantId, variantIds),
                eq(order.status, "delivered"),
                ownerType === "shop"
                  ? and(eq(order.shopId, ownerId), eq(order.orderType, "b2c"))
                  : and(
                      eq(order.warehouseId, ownerId),
                      eq(order.orderType, "b2b"),
                    ),
              ),
            );

    type VariantSummary = {
      variantId: number;
      productId: number;
      productName: string;
      productImage: string | null;
      sku: string;
      unitLabel: string;
      brandName: string;
      fullQty: number;
      emptyQty: number;
      inMarketQty: number;
      totalQty: number;
      orderIds: string[];
      damagedQty: number;
      returnedQty: number;
      appliedToSalesQty: number;
    };
    const variants = new Map<number, VariantSummary>();
    const ensureVariant = (
      row: (typeof fullRows)[number] | (typeof emptyRows)[number],
    ) => {
      let current = variants.get(row.variantId);
      if (!current) {
        current = {
          variantId: row.variantId,
          productId: row.productId,
          productName: row.productName,
          productImage: row.productImage,
          sku: row.sku || `VAR-${row.variantId}`,
          unitLabel:
            row.unitLabel ||
            (Number(row.weightKg || 0) > 0
              ? `${Number(row.weightKg)} KG`
              : "Cylinder"),
          brandName: row.brandName || "Unbranded",
          fullQty: 0,
          emptyQty: 0,
          inMarketQty: 0,
          totalQty: 0,
          orderIds: [],
          damagedQty: 0,
          returnedQty: 0,
          appliedToSalesQty: 0,
        };
        variants.set(row.variantId, current);
      }
      return current;
    };
    for (const row of fullRows) {
      ensureVariant(row).fullQty =
        Number(row.availableQty || 0) + Number(row.reservedQty || 0);
    }
    for (const row of emptyRows) {
      const current = ensureVariant(row);
      current.emptyQty = row.availableQty;
      current.damagedQty = row.damagedQty;
      current.returnedQty = row.returnedQty;
      current.appliedToSalesQty = row.appliedToSalesQty;
    }
    for (const row of marketRows) {
      if (!row.variantId) continue;
      const current = variants.get(row.variantId);
      if (!current) continue;
      const soldQty = Number(
        row.deliveredQty ?? row.modifiedQty ?? row.quantity,
      );
      const outstanding =
        row.saleMode === "exchange"
          ? Number(row.convertedToNewQty || 0)
          : soldQty;
      if (outstanding <= 0) continue;
      current.inMarketQty += outstanding;
      current.orderIds.push(row.orderNumber);
    }
    for (const current of variants.values()) {
      current.totalQty =
        current.fullQty + current.emptyQty + current.inMarketQty;
      current.orderIds = Array.from(new Set(current.orderIds));
    }

    const productMap = new Map<
      number,
      {
        productId: number;
        productName: string;
        productImage: string | null;
        sku: string;
        variants: VariantSummary[];
        fullQty: number;
        emptyQty: number;
        inMarketQty: number;
        totalQty: number;
        orderIds: string[];
      }
    >();
    for (const variant of variants.values()) {
      const current = productMap.get(variant.productId) ?? {
        productId: variant.productId,
        productName: variant.productName,
        productImage: variant.productImage,
        sku: variant.sku,
        variants: [],
        fullQty: 0,
        emptyQty: 0,
        inMarketQty: 0,
        totalQty: 0,
        orderIds: [],
      };
      current.variants.push(variant);
      current.fullQty += variant.fullQty;
      current.emptyQty += variant.emptyQty;
      current.inMarketQty += variant.inMarketQty;
      current.totalQty += variant.totalQty;
      current.orderIds.push(...variant.orderIds);
      current.orderIds = Array.from(new Set(current.orderIds));
      productMap.set(variant.productId, current);
    }
    const products = Array.from(productMap.values()).sort((a, b) =>
      a.productName.localeCompare(b.productName),
    );

    return {
      ownerType,
      storeName:
        ownerType === "warehouse"
          ? owner?.warehouseName || owner?.name || "Warehouse"
          : owner?.shopName || owner?.name || "Retail Store",
      asOf: new Date(),
      summary: {
        fullQty: products.reduce((sum, item) => sum + item.fullQty, 0),
        emptyQty: products.reduce((sum, item) => sum + item.emptyQty, 0),
        inMarketQty: products.reduce((sum, item) => sum + item.inMarketQty, 0),
        totalQty: products.reduce((sum, item) => sum + item.totalQty, 0),
      },
      products,
    };
  }),

  recordAction: protectedProcedure
    .input(
      z.object({
        variantId: z.number().int().positive(),
        action: actionSchema,
        quantity: z.number().int().positive(),
        notes: z.string().trim().max(300).optional(),
      }),
    )
    .handler(async ({ context, input }) => {
      const { ownerId, ownerType } = resolveOwner(context.session.user);
      await db.transaction(async (tx) => {
        const counter =
          input.action === "damage"
            ? {
                damagedQty: sql`${emptyPackStock.damagedQty} + ${input.quantity}`,
              }
            : input.action === "supplier_return"
              ? {
                  returnedQty: sql`${emptyPackStock.returnedQty} + ${input.quantity}`,
                }
              : {
                  appliedToSalesQty: sql`${emptyPackStock.appliedToSalesQty} + ${input.quantity}`,
                };
        const updated = await tx
          .update(emptyPackStock)
          .set({
            availableQty: sql`${emptyPackStock.availableQty} - ${input.quantity}`,
            ...counter,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(emptyPackStock.ownerType, ownerType),
              eq(emptyPackStock.ownerId, ownerId),
              eq(emptyPackStock.variantId, input.variantId),
              sql`${emptyPackStock.availableQty} >= ${input.quantity}`,
            ),
          )
          .returning({ id: emptyPackStock.id });
        if (updated.length === 0) {
          throw new ORPCError("BAD_REQUEST", {
            message: "Not enough empty cylinders for this action",
          });
        }
        await tx.insert(emptyPackMovement).values({
          ownerType,
          ownerId,
          variantId: input.variantId,
          movementType: input.action,
          quantity: input.quantity,
          notes: input.notes,
          createdBy: ownerId,
        });
      });
      return { success: true };
    }),
};
