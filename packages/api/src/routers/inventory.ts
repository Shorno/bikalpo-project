import { db } from "@bikalpo-project/db";
import { inventory } from "@bikalpo-project/db/schema";
import { and, eq, sql } from "drizzle-orm";
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

            return { success: true, availableQty: newBalance };
        }),

};
