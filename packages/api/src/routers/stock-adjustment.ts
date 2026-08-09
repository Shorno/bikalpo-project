/**
 * Stock Adjustment Router
 *
 * Provides CRUD + workflow operations for warehouse stock adjustments:
 *   - List adjustments with filters
 *   - Get single adjustment detail
 *   - Create new adjustment (draft or submitted)
 *   - Submit a draft (applies stock changes to inventory)
 *   - Search warehouse variants for the product picker
 */

import { db } from "@bikalpo-project/db";
import { resolveVariantOperations } from "@bikalpo-project/db/variant-definition";
import {
    stockAdjustment,
    stockAdjustmentItem,
    inventory,
    productVariant,
    product,
    brand,
} from "@bikalpo-project/db/schema";
import { and, eq, sql, desc, ilike, inArray, or, type SQL } from "drizzle-orm";
import { z } from "zod";
import { ORPCError } from "@orpc/server";
import { warehouseProcedure } from "../index";

// ── Helpers ──

/** Generate next adjustment number: ADJ-0001, ADJ-0002, ... */
async function generateAdjustmentNo(warehouseId: string): Promise<string> {
    const [result] = await db
        .select({ maxNo: sql<string>`MAX(${stockAdjustment.adjustmentNo})` })
        .from(stockAdjustment)
        .where(eq(stockAdjustment.warehouseId, warehouseId));

    const lastNum = result?.maxNo
        ? parseInt(result.maxNo.replace("ADJ-", ""), 10)
        : 0;
    const next = lastNum + 1;
    return `ADJ-${String(next).padStart(4, "0")}`;
}

function normalizeAdjustmentQty(
    type: "increase" | "decrease" | "damage" | "loss" | "correction",
    quantity: number,
) {
    if (type === "decrease" || type === "damage" || type === "loss") {
        return -Math.abs(quantity);
    }
    if (type === "increase") return Math.abs(quantity);
    return quantity;
}

// ── Router ──

export const stockAdjustmentRouter = {
    /**
     * List adjustments with filters and pagination.
     */
    list: warehouseProcedure
        .input(
            z.object({
                search: z.string().optional(),
                adjustmentType: z
                    .enum(["increase", "decrease", "damage", "loss", "correction"])
                    .optional(),
                status: z
                    .enum(["draft", "submitted", "approved", "rejected"])
                    .optional(),
                page: z.number().int().min(1).optional().default(1),
                pageSize: z.number().int().min(1).max(100).optional().default(20),
            }),
        )
        .handler(async ({ context, input }) => {
            const warehouseId = context.session.user.id;
            const offset = (input.page - 1) * input.pageSize;

            const conditions: SQL[] = [
                eq(stockAdjustment.warehouseId, warehouseId),
            ];

            if (input.adjustmentType) {
                conditions.push(
                    eq(stockAdjustment.adjustmentType, input.adjustmentType),
                );
            }
            if (input.status) {
                conditions.push(eq(stockAdjustment.status, input.status));
            }
            if (input.search?.trim()) {
                const term = `%${input.search.trim()}%`;
                conditions.push(
                    ilike(stockAdjustment.adjustmentNo, term),
                );
            }

            const where = and(...conditions);

            const [rows, countResult] = await Promise.all([
                db
                    .select({
                        id: stockAdjustment.id,
                        adjustmentNo: stockAdjustment.adjustmentNo,
                        adjustmentType: stockAdjustment.adjustmentType,
                        reason: stockAdjustment.reason,
                        status: stockAdjustment.status,
                        adjustmentDate: stockAdjustment.adjustmentDate,
                        totalItems: stockAdjustment.totalItems,
                        totalQtyChange: stockAdjustment.totalQtyChange,
                        referenceNote: stockAdjustment.referenceNote,
                        createdAt: stockAdjustment.createdAt,
                    })
                    .from(stockAdjustment)
                    .where(where)
                    .orderBy(desc(stockAdjustment.createdAt))
                    .limit(input.pageSize)
                    .offset(offset),
                db
                    .select({ count: sql<number>`COUNT(*)::int` })
                    .from(stockAdjustment)
                    .where(where),
            ]);

            const totalCount = countResult[0]?.count ?? 0;

            return {
                items: rows,
                totalCount,
                page: input.page,
                pageSize: input.pageSize,
                totalPages: Math.ceil(totalCount / input.pageSize),
            };
        }),

    /**
     * Get a single adjustment with all line items and variant/product details.
     */
    getById: warehouseProcedure
        .input(z.object({ id: z.number().int() }))
        .handler(async ({ context, input }) => {
            const warehouseId = context.session.user.id;

            const adj = await db
                .select()
                .from(stockAdjustment)
                .where(
                    and(
                        eq(stockAdjustment.id, input.id),
                        eq(stockAdjustment.warehouseId, warehouseId),
                    ),
                )
                .limit(1);

            if (!adj[0]) {
                throw new ORPCError("NOT_FOUND", {
                    message: "Adjustment not found",
                });
            }

            const items = await db
                .select({
                    id: stockAdjustmentItem.id,
                    variantId: stockAdjustmentItem.variantId,
                    currentQty: stockAdjustmentItem.currentQty,
                    adjustQty: stockAdjustmentItem.adjustQty,
                    afterQty: stockAdjustmentItem.afterQty,
                    note: stockAdjustmentItem.note,
                    // Variant info
                    sku: productVariant.sku,
                    unitLabel: productVariant.unitLabel,
                    packagingType: productVariant.packagingType,
                    weightKg: productVariant.weightKg,
                    color: productVariant.color,
                    size: productVariant.size,
                    // Product info
                    productId: product.id,
                    productName: product.name,
                    productImage: product.image,
                    // Brand info
                    brandName: brand.name,
                })
                .from(stockAdjustmentItem)
                .innerJoin(
                    productVariant,
                    eq(stockAdjustmentItem.variantId, productVariant.id),
                )
                .innerJoin(product, eq(productVariant.productId, product.id))
                .leftJoin(brand, eq(productVariant.brandId, brand.id))
                .where(eq(stockAdjustmentItem.adjustmentId, input.id))
                .orderBy(stockAdjustmentItem.id);

            return {
                ...adj[0],
                items,
            };
        }),

    /**
     * Create a new stock adjustment.
     * When status = "submitted", immediately applies changes to inventory.
     */
    create: warehouseProcedure
        .input(
            z.object({
                adjustmentType: z.enum([
                    "increase",
                    "decrease",
                    "damage",
                    "loss",
                    "correction",
                ]),
                reason: z.enum([
                    "physical_count",
                    "damage",
                    "expired",
                    "theft",
                    "system_error",
                    "other",
                ]),
                referenceNote: z.string().optional(),
                adjustmentDate: z.string(), // ISO date string
                status: z.enum(["draft", "submitted"]).default("draft"),
                items: z
                    .array(
                        z.object({
                            variantId: z.number().int(),
                            adjustQty: z.number(), // signed: +10 or -20
                            note: z.string().optional(),
                        }),
                    )
                    .min(1, "At least one item is required"),
            }),
        )
        .handler(async ({ context, input }) => {
            const warehouseId = context.session.user.id;
            const adjustmentNo = await generateAdjustmentNo(warehouseId);
            const normalizedItems = input.items.map((item) => ({
                ...item,
                adjustQty: normalizeAdjustmentQty(
                    input.adjustmentType,
                    item.adjustQty,
                ),
            }));

            // Fetch current inventory quantities for all variants
            const variantIds = normalizedItems.map((i) => i.variantId);

            const variantRows = await db.query.productVariant.findMany({
                where: inArray(productVariant.id, variantIds),
                columns: { id: true },
                with: {
                    sourceVariantOption: true,
                },
            });
            const movementByVariant = new Map(
                variantRows
                    .filter((row) => row.sourceVariantOption)
                    .map((row) => {
                        const operations = resolveVariantOperations(
                            row.sourceVariantOption!,
                        );
                        return [row.id, operations] as const;
                    }),
            );

            if (variantRows.length !== new Set(variantIds).size) {
                throw new ORPCError("BAD_REQUEST", {
                    message: "One or more selected variants no longer exist",
                });
            }

            for (const item of normalizedItems) {
                const operations = movementByVariant.get(item.variantId);
                if (operations && !operations.allowsDecimal && !Number.isInteger(item.adjustQty)) {
                    throw new ORPCError("BAD_REQUEST", {
                        message: `Variant ${item.variantId}: adjustments must use whole ${operations.operationalUnit} quantities`,
                    });
                }
            }

            const inventoryRows = await db
                .select({
                    variantId: inventory.variantId,
                    availableQty: inventory.availableQty,
                })
                .from(inventory)
                .where(
                    and(
                        eq(inventory.ownerType, "warehouse"),
                        eq(inventory.ownerId, warehouseId),
                        sql`${inventory.variantId} IN (${sql.join(
                            variantIds.map((id) => sql`${id}`),
                            sql`, `,
                        )})`,
                    ),
                );

            const inventoryMap = new Map<number, number>();
            for (const row of inventoryRows) {
                inventoryMap.set(
                    row.variantId,
                    parseFloat(row.availableQty || "0"),
                );
            }

            // Validate: no negative stock
            for (const item of normalizedItems) {
                const currentQty = inventoryMap.get(item.variantId) ?? 0;
                const afterQty = currentQty + item.adjustQty;
                if (afterQty < 0 && input.status === "submitted") {
                    throw new ORPCError("BAD_REQUEST", {
                        message: `Variant ${item.variantId}: adjustment would result in negative stock (${currentQty} + ${item.adjustQty} = ${afterQty})`,
                    });
                }
            }

            // Build line items
            const lineItems = normalizedItems.map((item) => {
                const currentQty = inventoryMap.get(item.variantId) ?? 0;
                return {
                    variantId: item.variantId,
                    currentQty: String(currentQty),
                    adjustQty: String(item.adjustQty),
                    afterQty: String(currentQty + item.adjustQty),
                    quantityUnit:
                        movementByVariant.get(item.variantId)?.operationalUnit ?? null,
                    note: item.note || null,
                };
            });

            const totalQtyChange = normalizedItems.reduce(
                (sum, i) => sum + i.adjustQty,
                0,
            );

            // Use transaction for atomicity
            const result = await db.transaction(async (tx) => {
                // 1. Create header
                const [header] = await tx
                    .insert(stockAdjustment)
                    .values({
                        adjustmentNo,
                        warehouseId,
                        adjustmentType: input.adjustmentType,
                        reason: input.reason,
                        referenceNote: input.referenceNote || null,
                        adjustmentDate: input.adjustmentDate,
                        status: input.status,
                        totalItems: normalizedItems.length,
                        totalQtyChange: String(totalQtyChange),
                        createdById: warehouseId,
                    })
                    .returning();

                // 2. Create line items
                await tx.insert(stockAdjustmentItem).values(
                    lineItems.map((li) => ({
                        ...li,
                        adjustmentId: header!.id,
                    })),
                );

                // 3. If submitted, apply to inventory immediately
                if (input.status === "submitted") {
                    for (const item of normalizedItems) {
                        const updated = await tx
                            .update(inventory)
                            .set({
                                availableQty: sql`CAST(${inventory.availableQty} AS numeric) + ${item.adjustQty}`,
                            })
                            .where(
                                and(
                                    eq(inventory.ownerType, "warehouse"),
                                    eq(inventory.ownerId, warehouseId),
                                    eq(inventory.variantId, item.variantId),
                                    sql`CAST(${inventory.availableQty} AS numeric) + ${item.adjustQty} >= 0`,
                                ),
                            )
                            .returning({ id: inventory.id });
                        if (updated.length === 0) {
                            throw new ORPCError("BAD_REQUEST", {
                                message: `Variant ${item.variantId}: inventory changed or the adjustment would make stock negative`,
                            });
                        }
                    }
                }

                return header!;
            });

            return {
                success: true,
                adjustmentId: result.id,
                adjustmentNo: result.adjustmentNo,
                status: result.status,
            };
        }),

    /**
     * Submit a draft adjustment → applies stock changes to inventory.
     */
    submit: warehouseProcedure
        .input(z.object({ id: z.number().int() }))
        .handler(async ({ context, input }) => {
            const warehouseId = context.session.user.id;

            const adj = await db
                .select()
                .from(stockAdjustment)
                .where(
                    and(
                        eq(stockAdjustment.id, input.id),
                        eq(stockAdjustment.warehouseId, warehouseId),
                    ),
                )
                .limit(1);

            if (!adj[0]) {
                throw new ORPCError("NOT_FOUND", {
                    message: "Adjustment not found",
                });
            }
            const adjustment = adj[0];

            if (adjustment.status !== "draft") {
                throw new ORPCError("BAD_REQUEST", {
                    message: `Cannot submit: adjustment is already "${adjustment.status}"`,
                });
            }

            // Get line items
            const items = await db
                .select()
                .from(stockAdjustmentItem)
                .where(eq(stockAdjustmentItem.adjustmentId, input.id));

            if (items.length === 0) {
                throw new ORPCError("BAD_REQUEST", {
                    message: "Cannot submit an adjustment with no items",
                });
            }
            const normalizedItems = items.map((item) => ({
                ...item,
                normalizedAdjustQty: normalizeAdjustmentQty(
                    adjustment.adjustmentType,
                    parseFloat(item.adjustQty),
                ),
            }));

            for (const item of normalizedItems) {
                if (
                    item.quantityUnit === "cylinder" &&
                    !Number.isInteger(item.normalizedAdjustQty)
                ) {
                    throw new ORPCError("BAD_REQUEST", {
                        message: `Variant ${item.variantId}: LPG cylinder adjustments must use whole cylinders`,
                    });
                }
            }

            // Re-validate: fetch current inventory and check no negative stock
            for (const item of normalizedItems) {
                const [invRow] = await db
                    .select({ availableQty: inventory.availableQty })
                    .from(inventory)
                    .where(
                        and(
                            eq(inventory.ownerType, "warehouse"),
                            eq(inventory.ownerId, warehouseId),
                            eq(inventory.variantId, item.variantId),
                        ),
                    );

                const currentQty = parseFloat(invRow?.availableQty ?? "0");
                const adjustQty = item.normalizedAdjustQty;
                if (currentQty + adjustQty < 0) {
                    throw new ORPCError("BAD_REQUEST", {
                        message: `Variant ${item.variantId}: would result in negative stock (${currentQty} + ${adjustQty})`,
                    });
                }
            }

            // Apply in transaction
            await db.transaction(async (tx) => {
                // Update status
                const statusUpdate = await tx
                    .update(stockAdjustment)
                    .set({
                        status: "submitted",
                        totalQtyChange: String(
                            normalizedItems.reduce(
                                (sum, item) => sum + item.normalizedAdjustQty,
                                0,
                            ),
                        ),
                    })
                    .where(
                        and(
                            eq(stockAdjustment.id, input.id),
                            eq(stockAdjustment.status, "draft"),
                        ),
                    )
                    .returning({ id: stockAdjustment.id });
                if (statusUpdate.length === 0) {
                    throw new ORPCError("BAD_REQUEST", {
                        message: "Adjustment was already submitted by another request",
                    });
                }

                // Apply each item to inventory
                for (const item of normalizedItems) {
                    const adjustQty = item.normalizedAdjustQty;
                    const updated = await tx
                        .update(inventory)
                        .set({
                            availableQty: sql`CAST(${inventory.availableQty} AS numeric) + ${adjustQty}`,
                        })
                        .where(
                            and(
                                eq(inventory.ownerType, "warehouse"),
                                eq(inventory.ownerId, warehouseId),
                                eq(inventory.variantId, item.variantId),
                                sql`CAST(${inventory.availableQty} AS numeric) + ${adjustQty} >= 0`,
                            ),
                        )
                        .returning({ id: inventory.id });
                    if (updated.length === 0) {
                        throw new ORPCError("BAD_REQUEST", {
                            message: `Variant ${item.variantId}: inventory changed or the adjustment would make stock negative`,
                        });
                    }
                }

                // Update currentQty/afterQty snapshots
                for (const item of normalizedItems) {
                    const [invRow] = await tx
                        .select({ availableQty: inventory.availableQty })
                        .from(inventory)
                        .where(
                            and(
                                eq(inventory.ownerType, "warehouse"),
                                eq(inventory.ownerId, warehouseId),
                                eq(inventory.variantId, item.variantId),
                            ),
                        );

                    const newQty = parseFloat(invRow?.availableQty ?? "0");
                    const adjustQty = item.normalizedAdjustQty;
                    await tx
                        .update(stockAdjustmentItem)
                        .set({
                            currentQty: String(newQty - adjustQty),
                            adjustQty: String(adjustQty),
                            afterQty: String(newQty),
                        })
                        .where(eq(stockAdjustmentItem.id, item.id));
                }
            });

            return {
                success: true,
                message: `Adjustment ${adjustment.adjustmentNo} submitted and applied to inventory`,
            };
        }),

    /**
     * Search warehouse inventory variants for the product picker.
     */
    searchVariants: warehouseProcedure
        .input(
            z.object({
                search: z.string().optional(),
                limit: z.number().int().min(1).max(50).optional().default(20),
            }),
        )
        .handler(async ({ context, input }) => {
            const warehouseId = context.session.user.id;

            const conditions: SQL[] = [
                eq(inventory.ownerType, "warehouse"),
                eq(inventory.ownerId, warehouseId),
            ];

            if (input.search?.trim()) {
                const term = `%${input.search.trim()}%`;
                conditions.push(
                    or(
                        ilike(product.name, term),
                        ilike(productVariant.sku ?? "", term),
                        ilike(brand.name ?? "", term),
                    )!,
                );
            }

            const rows = await db
                .select({
                    variantId: productVariant.id,
                    sku: productVariant.sku,
                    unitLabel: productVariant.unitLabel,
                    packagingType: productVariant.packagingType,
                    weightKg: productVariant.weightKg,
                    color: productVariant.color,
                    size: productVariant.size,
                    productId: product.id,
                    productName: product.name,
                    productImage: product.image,
                    brandName: brand.name,
                    availableQty: inventory.availableQty,
                    packType: productVariant.packType,
                    orderUnit: productVariant.orderUnit,
                })
                .from(inventory)
                .innerJoin(
                    productVariant,
                    eq(inventory.variantId, productVariant.id),
                )
                .innerJoin(product, eq(productVariant.productId, product.id))
                .leftJoin(brand, eq(productVariant.brandId, brand.id))
                .where(and(...conditions))
                .orderBy(product.name)
                .limit(input.limit);

            return {
                variants: rows.map((r) => ({
                    variantId: r.variantId,
                    sku: r.sku,
                    unitLabel: r.unitLabel,
                    packagingType: r.packagingType,
                    weightKg: r.weightKg,
                    color: r.color,
                    size: r.size,
                    productId: r.productId,
                    productName: r.productName,
                    productImage: r.productImage,
                    brandName: r.brandName,
                    availableQty: parseFloat(r.availableQty || "0"),
                    quantityUnit:
                        r.packType === "cylinder" || r.orderUnit === "cylinder"
                            ? "cylinder"
                            : r.orderUnit || r.packType || "unit",
                })),
            };
        }),
};
