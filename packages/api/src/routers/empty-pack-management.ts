import { db } from "@bikalpo-project/db";
import {
  category,
  emptyPackMovement,
  emptyPackStock,
  inventory,
  order,
  orderItem,
  product,
  productType,
  productVariant,
} from "@bikalpo-project/db/schema";
import { resolveVariantStockSemantics } from "@bikalpo-project/db/variant-definition";
import { ORPCError } from "@orpc/server";
import { and, eq, inArray, or, sql } from "drizzle-orm";
import { z } from "zod";
import { shopOrWarehousePermissionProcedure } from "../index";
import { shopOrWarehouseOwnerScope } from "../shop-portal-scope";
import { buildEmptyPackList, type EmptyPackSize } from "./helpers/empty-pack-list";

function resolveOwner(user: { id: string; role?: string | null }) {
  return shopOrWarehouseOwnerScope(user, "inventory");
}

const actionSchema = z.enum(["damage", "supplier_return", "sale_application"]);

export const emptyPackManagementRouter = {
  /**
   * Empty Pack page (client, 2026-11-25): every returnable-pack product
   * (LPG cylinders) with each size's total and how many empties are still
   * owed by customers on Exchange sales (In Market).
   */
  getSummary: shopOrWarehousePermissionProcedure(
    "shop_stock",
    "view",
    "inventory",
  ).handler(async ({ context }) => {
    const { ownerId, ownerType } = resolveOwner(context.session.user);
    const [fullRows, emptyRows] = await Promise.all([
      db
        .select({
          variantId: inventory.variantId,
          availableQty: inventory.availableQty,
          reservedQty: inventory.reservedQty,
        })
        .from(inventory)
        .innerJoin(productVariant, eq(inventory.variantId, productVariant.id))
        .innerJoin(product, eq(productVariant.productId, product.id))
        .leftJoin(category, eq(product.categoryId, category.id))
        .leftJoin(productType, eq(category.typeId, productType.id))
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
          variantId: emptyPackStock.variantId,
          availableQty: emptyPackStock.availableQty,
        })
        .from(emptyPackStock)
        .where(
          and(
            eq(emptyPackStock.ownerType, ownerType),
            eq(emptyPackStock.ownerId, ownerId),
          ),
        ),
    ]);

    const fullByVariant = new Map(
      fullRows.map((row) => [
        row.variantId,
        Number(row.availableQty || 0) + Number(row.reservedQty || 0),
      ]),
    );
    const emptyByVariant = new Map(
      emptyRows.map((row) => [row.variantId, Number(row.availableQty || 0)]),
    );
    const variantIds = [
      ...new Set([...fullByVariant.keys(), ...emptyByVariant.keys()]),
    ];
    if (variantIds.length === 0) return { products: [] };

    const [variantRows, sales] = await Promise.all([
      db.query.productVariant.findMany({
        where: inArray(productVariant.id, variantIds),
        with: {
          sourceVariantOption: true,
          product: {
            with: {
              coreProduct: { columns: { catalogCode: true } },
              category: { columns: { id: true, name: true } },
              subCategory: { columns: { id: true, name: true } },
            },
          },
        },
      }),
      db
        .select({
          variantId: orderItem.variantId,
          orderNumber: order.orderNumber,
          saleMode: orderItem.cylinderSaleMode,
          missingEmptyQty: orderItem.convertedToNewQty,
        })
        .from(orderItem)
        .innerJoin(order, eq(orderItem.orderId, order.id))
        .where(
          and(
            inArray(orderItem.variantId, variantIds),
            eq(order.status, "delivered"),
            eq(orderItem.cylinderSaleMode, "exchange"),
            ownerType === "shop"
              ? and(eq(order.shopId, ownerId), eq(order.orderType, "b2c"))
              : and(eq(order.warehouseId, ownerId), eq(order.orderType, "b2b")),
          ),
        ),
    ]);

    const sizes: EmptyPackSize[] = [];
    for (const variant of variantRows) {
      const item = variant.product;
      if (!item) continue;
      let label = variant.unitLabel || `${Number(variant.weightKg || 0)} KG`;
      if (variant.sourceVariantOption) {
        try {
          label = resolveVariantStockSemantics(variant.sourceVariantOption)
            .displayLabel;
        } catch {
          // Keep the stored label for an option that no longer resolves.
        }
      }
      sizes.push({
        variantId: variant.id,
        productId: item.id,
        productCode:
          item.coreProduct?.catalogCode ?? item.catalogCode ?? item.sku ?? null,
        productName: item.name,
        label,
        categoryId: item.category?.id ?? null,
        categoryName: item.category?.name ?? null,
        subCategoryId: item.subCategory?.id ?? null,
        subCategoryName: item.subCategory?.name ?? null,
        fullQty: fullByVariant.get(variant.id) ?? 0,
        emptyQty: emptyByVariant.get(variant.id) ?? 0,
      });
    }

    return { products: buildEmptyPackList(sizes, sales) };
  }),

  recordAction: shopOrWarehousePermissionProcedure(
    "shop_stock",
    "update",
    "inventory",
  )
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
