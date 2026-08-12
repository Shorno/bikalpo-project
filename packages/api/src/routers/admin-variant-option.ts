import { db } from "@bikalpo-project/db";
import {
  order,
  orderItem,
  product,
  productVariant,
  productVariantPrice,
  variantOption,
} from "@bikalpo-project/db/schema";
import { ORPCError } from "@orpc/server";
import {
  and,
  asc,
  countDistinct,
  eq,
  ilike,
  inArray,
  isNull,
  type SQL,
  sql,
} from "drizzle-orm";
import { z } from "zod";
import { adminProcedure } from "../index";
import {
  createStructuredVariantOption,
  prepareStructuredVariantOption,
  structuredVariantOptionInputSchema,
} from "./helpers/structured-variant-option";
import { resyncGeneratedVariantsForOption } from "./helpers/sync-generated-variants";

const updateInput = structuredVariantOptionInputSchema.extend({
  id: z.number().int(),
  isActive: z.boolean().default(true),
});

const filtersInput = z.object({
  search: z.string().optional(),
  typeId: z.number().int().optional(),
  categoryId: z.number().int().optional(),
  unit: z.string().optional(),
  variantType: z.enum(["all", "pack", "loose"]).default("all"),
  status: z.enum(["all", "active", "disabled"]).default("all"),
});

export const adminVariantOptionRouter = {
  /**
   * List all variant options with type/category info.
   */
  getAll: adminProcedure
    .input(filtersInput.optional())
    .handler(async ({ input }) => {
      const filters: Partial<z.infer<typeof filtersInput>> = input ?? {};
      const conditions: SQL[] = [];

      // Search filter
      if (filters.search?.trim()) {
        conditions.push(
          ilike(variantOption.name, `%${filters.search.trim()}%`),
        );
      }

      // Type filter: "global" is handled as typeId === null
      if (filters.typeId !== undefined) {
        conditions.push(eq(variantOption.typeId, filters.typeId));
      }

      // Category filter
      if (filters.categoryId !== undefined) {
        conditions.push(eq(variantOption.categoryId, filters.categoryId));
      }

      // Unit filter
      if (filters.unit) {
        conditions.push(eq(variantOption.unit, filters.unit));
      }

      // Variant type filter
      if (filters.variantType && filters.variantType !== "all") {
        conditions.push(eq(variantOption.variantType, filters.variantType));
      }

      // Status filter
      if (filters.status === "active") {
        conditions.push(eq(variantOption.isActive, true));
      } else if (filters.status === "disabled") {
        conditions.push(eq(variantOption.isActive, false));
      }

      const options = await db.query.variantOption.findMany({
        where: conditions.length > 0 ? and(...conditions) : undefined,
        with: {
          type: { columns: { id: true, name: true } },
          category: { columns: { id: true, name: true } },
        },
        orderBy: [asc(variantOption.sortOrder), asc(variantOption.name)],
      });
      const usage = await Promise.all(
        options.map(async (option) => {
          const [priceRefs, generatedRefs] = await Promise.all([
            db
              .select({ productId: productVariantPrice.productId })
              .from(productVariantPrice)
              .where(eq(productVariantPrice.variantOptionId, option.id)),
            db
              .select({ productId: productVariant.productId })
              .from(productVariant)
              .where(eq(productVariant.sourceVariantOptionId, option.id)),
          ]);
          const productIds = [
            ...new Set([
              ...priceRefs.map((row) => row.productId),
              ...generatedRefs.map((row) => row.productId),
            ]),
          ];
          const productRows = productIds.length
            ? await db
                .select({
                  id: product.id,
                  coreProductId: product.coreProductId,
                })
                .from(product)
                .where(inArray(product.id, productIds))
            : [];
          return {
            ...option,
            structuralLocked: productIds.length > 0,
            productUsageCount: productRows.length,
            coreIdentityUsageCount: new Set(
              productRows.map((row) => row.coreProductId).filter(Boolean),
            ).size,
          };
        }),
      );
      return usage;
    }),

  /**
   * Get all global variant options (typeId=null) — used for pickers.
   */
  getGlobal: adminProcedure.handler(async () => {
    return db.query.variantOption.findMany({
      where: and(
        isNull(variantOption.typeId),
        eq(variantOption.isActive, true),
      ),
      orderBy: [asc(variantOption.sortOrder), asc(variantOption.name)],
    });
  }),

  /**
   * Get a single variant option by ID.
   */
  getById: adminProcedure
    .input(z.object({ id: z.number().int() }))
    .handler(async ({ input }) => {
      const option = await db.query.variantOption.findFirst({
        where: eq(variantOption.id, input.id),
        with: {
          type: { columns: { id: true, name: true } },
          category: { columns: { id: true, name: true } },
        },
      });

      if (!option) throw new Error("Variant option not found");

      const [priceRefs, generatedVariants] = await Promise.all([
        db
          .select({ productId: productVariantPrice.productId })
          .from(productVariantPrice)
          .where(eq(productVariantPrice.variantOptionId, input.id)),
        db
          .select({
            id: productVariant.id,
            productId: productVariant.productId,
          })
          .from(productVariant)
          .where(eq(productVariant.sourceVariantOptionId, input.id)),
      ]);
      const productIds = [
        ...new Set([
          ...priceRefs.map((row) => row.productId),
          ...generatedVariants.map((row) => row.productId),
        ]),
      ];
      const configuredProducts = productIds.length
        ? await db.query.product.findMany({
            where: inArray(product.id, productIds),
            columns: {
              id: true,
              name: true,
              status: true,
              coreProductId: true,
            },
            with: {
              category: { columns: { id: true, name: true } },
              coreProduct: { columns: { id: true, name: true, sku: true } },
            },
          })
        : [];
      const coreIdentities = [
        ...new Map(
          configuredProducts
            .filter((item) => item.coreProduct)
            .map((item) => [item.coreProduct!.id, item.coreProduct!]),
        ).values(),
      ];
      const variantIds = generatedVariants.map((row) => row.id);
      const [salesUsage] = variantIds.length
        ? await db
            .select({
              deliveredOrders: countDistinct(orderItem.orderId),
              deliveredUnits: sql<number>`coalesce(sum(coalesce(${orderItem.deliveredQty}, ${orderItem.quantity})), 0)::int`,
            })
            .from(orderItem)
            .innerJoin(order, eq(order.id, orderItem.orderId))
            .where(
              and(
                inArray(orderItem.variantId, variantIds),
                eq(order.status, "delivered"),
              ),
            )
        : [{ deliveredOrders: 0, deliveredUnits: 0 }];

      return {
        variantOption: {
          ...option,
          structuralLocked: productIds.length > 0,
          configuredProducts,
          coreIdentities,
          productUsageCount: configuredProducts.length,
          coreIdentityUsageCount: coreIdentities.length,
          salesUsage: salesUsage ?? { deliveredOrders: 0, deliveredUnits: 0 },
        },
      };
    }),

  /**
   * Create a new variant option.
   */
  create: adminProcedure
    .input(structuredVariantOptionInputSchema)
    .handler(async ({ input }) => createStructuredVariantOption(input)),

  /**
   * Update an existing variant option.
   */
  update: adminProcedure.input(updateInput).handler(async ({ input }) => {
    const existing = await db.query.variantOption.findFirst({
      where: eq(variantOption.id, input.id),
    });

    if (!existing) throw new Error("Variant option not found");

    const { definition, name, signature } =
      await prepareStructuredVariantOption(input);
    const [priceRef, generatedRef] = await Promise.all([
      db.query.productVariantPrice.findFirst({
        where: eq(productVariantPrice.variantOptionId, input.id),
        columns: { id: true },
      }),
      db.query.productVariant.findFirst({
        where: eq(productVariant.sourceVariantOptionId, input.id),
        columns: { id: true },
      }),
    ]);
    const structuralLocked = Boolean(priceRef || generatedRef);
    const isLegacyUpgrade =
      existing.needsReview && existing.canonicalSignature === null;
    if (
      structuralLocked &&
      !isLegacyUpgrade &&
      (existing.canonicalSignature !== signature ||
        existing.typeId !== input.typeId ||
        existing.categoryId !== input.categoryId)
    ) {
      throw new ORPCError("BAD_REQUEST", {
        message:
          "This variant is already in use. Clone it to change its structure or scope.",
      });
    }

    // Check uniqueness (exclude self)
    const dupConditions: SQL[] = [
      eq(variantOption.canonicalSignature, signature),
      sql`${variantOption.id} != ${input.id}`,
    ];

    dupConditions.push(eq(variantOption.typeId, input.typeId));

    if (input.categoryId === null) {
      dupConditions.push(isNull(variantOption.categoryId));
    } else {
      dupConditions.push(eq(variantOption.categoryId, input.categoryId));
    }

    const duplicate = await db.query.variantOption.findFirst({
      where: and(...dupConditions),
    });

    if (duplicate) {
      throw new Error(
        `The same structured variant already exists in this scope`,
      );
    }

    await db.transaction(async (tx) => {
      const [updated] = await tx
        .update(variantOption)
        .set({
          name,
          unit:
            "measurementUnit" in definition
              ? definition.measurementUnit
              : definition.operationalUnit || "unit",
          size: "value" in definition ? definition.value : null,
          variantType: definition.kind === "loose" ? "loose" : "pack",
          definitionKind: definition.kind,
          definition,
          displayAlias: input.displayAlias || null,
          canonicalSignature: signature,
          needsReview: false,
          typeId: input.typeId,
          categoryId: input.categoryId,
          isActive: input.isActive,
          sortOrder: input.sortOrder,
          updatedAt: new Date(),
        })
        .where(eq(variantOption.id, input.id))
        .returning();
      if (!updated) {
        throw new ORPCError("NOT_FOUND", {
          message: "Variant option not found",
        });
      }
      await resyncGeneratedVariantsForOption(tx, updated);
    });

    return { message: "Variant option updated successfully" };
  }),

  toggleActive: adminProcedure
    .input(z.object({ id: z.number().int() }))
    .handler(async ({ input }) => {
      const existing = await db.query.variantOption.findFirst({
        where: eq(variantOption.id, input.id),
        columns: { id: true, name: true, isActive: true },
      });
      if (!existing) {
        throw new ORPCError("NOT_FOUND", {
          message: "Variant option not found",
        });
      }
      const [updated] = await db
        .update(variantOption)
        .set({ isActive: !existing.isActive, updatedAt: new Date() })
        .where(eq(variantOption.id, input.id))
        .returning({ isActive: variantOption.isActive });
      return {
        isActive: updated!.isActive,
        message: `${existing.name} ${updated!.isActive ? "enabled" : "disabled"}`,
      };
    }),

  /**
   * Delete a variant option.
   */
  delete: adminProcedure
    .input(z.object({ id: z.number().int() }))
    .handler(async ({ input }) => {
      const existing = await db.query.variantOption.findFirst({
        where: eq(variantOption.id, input.id),
      });

      if (!existing) throw new Error("Variant option not found");

      const [priceRef, generatedRef] = await Promise.all([
        db.query.productVariantPrice.findFirst({
          where: eq(productVariantPrice.variantOptionId, input.id),
          columns: { id: true },
        }),
        db.query.productVariant.findFirst({
          where: eq(productVariant.sourceVariantOptionId, input.id),
          columns: { id: true },
        }),
      ]);
      if (priceRef || generatedRef) {
        throw new ORPCError("BAD_REQUEST", {
          message:
            "This variant is in use and cannot be deleted. Disable it instead.",
        });
      }

      await db.delete(variantOption).where(eq(variantOption.id, input.id));

      return { message: "Variant option deleted successfully" };
    }),
};
