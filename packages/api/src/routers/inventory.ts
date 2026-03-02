import { db } from "@bikalpo-project/db";
import { inventory, stockLedger } from "@bikalpo-project/db/schema";
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { adminProcedure } from "../index";

const ownerTypeSchema = z.enum(["super_seller", "shop"]);

export const inventoryRouter = {
    /**
     * Get inventory for an owner (super_seller or shop)
     */
    getByOwner: adminProcedure
        .route({
            method: "POST",
            path: "/inventory/by-owner",
            tags: ["Inventory"],
            summary: "Get inventory by owner",
            description: "Get all inventory records for a specific owner",
        })
        .input(z.object({
            ownerType: ownerTypeSchema,
            ownerId: z.string(),
        }))
        .handler(async ({ input }) => {
            return db.query.inventory.findMany({
                where: and(
                    eq(inventory.ownerType, input.ownerType),
                    eq(inventory.ownerId, input.ownerId),
                ),
                with: {
                    variant: {
                        with: {
                            product: {
                                columns: {
                                    id: true,
                                    name: true,
                                    slug: true,
                                    image: true,
                                },
                            },
                        },
                    },
                },
            });
        }),

    /**
     * Get inventory for a specific variant across all owners
     */
    getByVariant: adminProcedure
        .route({
            method: "POST",
            path: "/inventory/by-variant",
            tags: ["Inventory"],
            summary: "Get inventory by variant",
            description: "Get inventory for a variant across all owners",
        })
        .input(z.object({ variantId: z.number().int() }))
        .handler(async ({ input }) => {
            return db.query.inventory.findMany({
                where: eq(inventory.variantId, input.variantId),
            });
        }),

    /**
     * Set/update inventory for a specific owner + variant
     */
    upsert: adminProcedure
        .route({
            method: "POST",
            path: "/inventory/upsert",
            tags: ["Inventory"],
            summary: "Upsert inventory",
            description: "Set or update inventory for an owner + variant",
        })
        .input(z.object({
            ownerType: ownerTypeSchema,
            ownerId: z.string(),
            variantId: z.number().int(),
            availableQty: z.string(),
            reason: z.string().optional(),
        }))
        .handler(async ({ context, input }) => {
            // Check if inventory record exists
            const existing = await db.query.inventory.findFirst({
                where: and(
                    eq(inventory.ownerType, input.ownerType),
                    eq(inventory.ownerId, input.ownerId),
                    eq(inventory.variantId, input.variantId),
                ),
            });

            let newBalance: string;

            if (existing) {
                // Update existing
                const [updated] = await db
                    .update(inventory)
                    .set({ availableQty: input.availableQty })
                    .where(eq(inventory.id, existing.id))
                    .returning();
                newBalance = updated!.availableQty;
            } else {
                // Create new
                const [created] = await db
                    .insert(inventory)
                    .values({
                        ownerType: input.ownerType,
                        ownerId: input.ownerId,
                        variantId: input.variantId,
                        availableQty: input.availableQty,
                        reservedQty: "0",
                    })
                    .returning();
                newBalance = created!.availableQty;
            }

            // Create ledger entry
            const qtyDiff = existing
                ? (parseFloat(input.availableQty) - parseFloat(existing.availableQty)).toString()
                : input.availableQty;

            const changeType = parseFloat(qtyDiff) >= 0 ? "in" : "adjust";

            await db.insert(stockLedger).values({
                variantId: input.variantId,
                ownerType: input.ownerType,
                ownerId: input.ownerId,
                changeType: changeType as "in" | "adjust",
                qty: Math.abs(parseFloat(qtyDiff)).toString(),
                reason: input.reason || "Manual inventory update",
                referenceType: "manual",
                balanceAfter: newBalance,
                createdById: context.session.user.id,
            });

            return { success: true, availableQty: newBalance };
        }),

    /**
     * Get stock ledger (audit trail) for an owner
     */
    getLedger: adminProcedure
        .route({
            method: "POST",
            path: "/inventory/ledger",
            tags: ["Inventory"],
            summary: "Get stock ledger",
            description: "Get immutable stock ledger (audit trail)",
        })
        .input(z.object({
            ownerType: ownerTypeSchema.optional(),
            ownerId: z.string().optional(),
            variantId: z.number().int().optional(),
            page: z.number().min(1).default(1),
            limit: z.number().min(1).max(100).default(50),
        }))
        .handler(async ({ input }) => {
            const conditions = [];
            if (input.ownerType) conditions.push(eq(stockLedger.ownerType, input.ownerType));
            if (input.ownerId) conditions.push(eq(stockLedger.ownerId, input.ownerId));
            if (input.variantId) conditions.push(eq(stockLedger.variantId, input.variantId));

            const where = conditions.length > 0 ? and(...conditions) : undefined;
            const offset = (input.page - 1) * input.limit;

            const [entries, countResult] = await Promise.all([
                db.query.stockLedger.findMany({
                    where,
                    orderBy: [desc(stockLedger.createdAt)],
                    offset,
                    limit: input.limit,
                    with: {
                        variant: {
                            columns: { id: true, sku: true, unitLabel: true },
                        },
                        createdBy: {
                            columns: { name: true },
                        },
                    },
                }),
                db.select({ count: sql<number>`count(*)::int` }).from(stockLedger).where(where),
            ]);

            return {
                entries,
                total: countResult[0]?.count ?? 0,
            };
        }),
};
