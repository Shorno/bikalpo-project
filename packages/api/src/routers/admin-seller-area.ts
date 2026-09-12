import { and, asc, count, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@bikalpo-project/db";
import { area, sellerAreaMapping, user } from "@bikalpo-project/db/schema";
import { adminProcedure } from "../index";

export const adminSellerAreaRouter = {
    /**
     * Get sellers assigned to an area.
     * REST: POST /admin/seller-areas/by-area
     */
    getAreaSellers: adminProcedure
        .route({
            method: "POST",
            path: "/admin/seller-areas/by-area",
            tags: ["Admin Seller Areas"],
            summary: "Get sellers in an area",
            description: "List all sellers assigned to a specific area",
        })
        .input(z.object({ areaId: z.number().int() }))
        .handler(async ({ input }) => {
            const sellers = await db
                .select({
                    mappingId: sellerAreaMapping.id,
                    sellerId: sellerAreaMapping.sellerId,
                    overrideRadiusKm: sellerAreaMapping.overrideRadiusKm,
                    isActive: sellerAreaMapping.isActive,
                    createdAt: sellerAreaMapping.createdAt,
                    sellerName: user.name,
                    sellerEmail: user.email,
                    shopName: user.shopName,
                    shopLat: user.shopLat,
                    shopLng: user.shopLng,
                })
                .from(sellerAreaMapping)
                .innerJoin(user, eq(sellerAreaMapping.sellerId, user.id))
                .where(eq(sellerAreaMapping.areaId, input.areaId))
                .orderBy(asc(user.name));

            return sellers;
        }),

    /**
     * Get areas assigned to a seller.
     * REST: POST /admin/seller-areas/by-seller
     */
    getSellerAreas: adminProcedure
        .route({
            method: "POST",
            path: "/admin/seller-areas/by-seller",
            tags: ["Admin Seller Areas"],
            summary: "Get areas for a seller",
            description: "List all areas assigned to a specific seller",
        })
        .input(z.object({ sellerId: z.string().min(1) }))
        .handler(async ({ input }) => {
            const areas = await db
                .select({
                    mappingId: sellerAreaMapping.id,
                    areaId: sellerAreaMapping.areaId,
                    overrideRadiusKm: sellerAreaMapping.overrideRadiusKm,
                    isActive: sellerAreaMapping.isActive,
                    areaName: area.name,
                    areaSlug: area.slug,
                })
                .from(sellerAreaMapping)
                .innerJoin(area, eq(sellerAreaMapping.areaId, area.id))
                .where(eq(sellerAreaMapping.sellerId, input.sellerId))
                .orderBy(asc(area.name));

            return areas;
        }),

    /**
     * Assign a seller to an area.
     * REST: POST /admin/seller-areas/assign
     */
    assign: adminProcedure
        .route({
            method: "POST",
            path: "/admin/seller-areas/assign",
            tags: ["Admin Seller Areas"],
            summary: "Assign seller to area",
            description: "Create a seller-to-area mapping",
        })
        .input(
            z.object({
                sellerId: z.string().min(1),
                areaId: z.number().int(),
                overrideRadiusKm: z.string().optional().nullable(),
            }),
        )
        .handler(async ({ input }) => {
            // Check if mapping already exists
            const existing = await db
                .select()
                .from(sellerAreaMapping)
                .where(
                    and(
                        eq(sellerAreaMapping.sellerId, input.sellerId),
                        eq(sellerAreaMapping.areaId, input.areaId),
                    ),
                )
                .limit(1);

            if (existing.length > 0) {
                // Re-activate if previously deactivated
                if (!existing[0]!.isActive) {
                    await db
                        .update(sellerAreaMapping)
                        .set({
                            isActive: true,
                            overrideRadiusKm: input.overrideRadiusKm,
                            updatedAt: new Date(),
                        })
                        .where(eq(sellerAreaMapping.id, existing[0]!.id));

                    return { message: "Seller area mapping reactivated" };
                }
                throw new Error("Seller is already assigned to this area");
            }

            const [result] = await db
                .insert(sellerAreaMapping)
                .values({
                    sellerId: input.sellerId,
                    areaId: input.areaId,
                    overrideRadiusKm: input.overrideRadiusKm,
                })
                .returning();

            return result;
        }),

    /**
     * Remove a seller from an area (soft delete).
     * REST: DELETE /admin/seller-areas/remove
     */
    remove: adminProcedure
        .route({
            method: "DELETE",
            path: "/admin/seller-areas/remove",
            tags: ["Admin Seller Areas"],
            summary: "Remove seller from area",
            description: "Deactivate a seller-to-area mapping",
        })
        .input(z.object({ mappingId: z.number().int() }))
        .handler(async ({ input }) => {
            await db
                .update(sellerAreaMapping)
                .set({ isActive: false, updatedAt: new Date() })
                .where(eq(sellerAreaMapping.id, input.mappingId));

            return { message: "Seller removed from area" };
        }),

    /**
     * Bulk assign multiple sellers to an area.
     * REST: POST /admin/seller-areas/bulk-assign
     */
    bulkAssign: adminProcedure
        .route({
            method: "POST",
            path: "/admin/seller-areas/bulk-assign",
            tags: ["Admin Seller Areas"],
            summary: "Bulk assign sellers to area",
            description: "Assign multiple sellers to an area at once",
        })
        .input(
            z.object({
                sellerIds: z.array(z.string().min(1)).min(1),
                areaId: z.number().int(),
            }),
        )
        .handler(async ({ input }) => {
            let assigned = 0;
            let skipped = 0;

            for (const sellerId of input.sellerIds) {
                const existing = await db
                    .select()
                    .from(sellerAreaMapping)
                    .where(
                        and(
                            eq(sellerAreaMapping.sellerId, sellerId),
                            eq(sellerAreaMapping.areaId, input.areaId),
                        ),
                    )
                    .limit(1);

                if (existing.length > 0) {
                    if (!existing[0]!.isActive) {
                        await db
                            .update(sellerAreaMapping)
                            .set({ isActive: true, updatedAt: new Date() })
                            .where(eq(sellerAreaMapping.id, existing[0]!.id));
                        assigned++;
                    } else {
                        skipped++;
                    }
                } else {
                    await db.insert(sellerAreaMapping).values({
                        sellerId,
                        areaId: input.areaId,
                    });
                    assigned++;
                }
            }

            return {
                message: `${assigned} sellers assigned, ${skipped} already assigned`,
                assigned,
                skipped,
            };
        }),

    /**
     * Get shop owners available for area assignment (not yet in this area).
     * REST: POST /admin/seller-areas/available-sellers
     */
    getAvailableSellers: adminProcedure
        .route({
            method: "POST",
            path: "/admin/seller-areas/available-sellers",
            tags: ["Admin Seller Areas"],
            summary: "Get available sellers for area",
            description:
                "List shop owners not yet assigned to a specific area",
        })
        .input(z.object({ areaId: z.number().int() }))
        .handler(async ({ input }) => {
            // Get all shop owners that are NOT already assigned to this area
            const assignedSellerIds = db
                .select({ sellerId: sellerAreaMapping.sellerId })
                .from(sellerAreaMapping)
                .where(
                    and(
                        eq(sellerAreaMapping.areaId, input.areaId),
                        eq(sellerAreaMapping.isActive, true),
                    ),
                );

            const sellers = await db
                .select({
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    shopName: user.shopName,
                    shopAddress: user.shopAddress,
                })
                .from(user)
                .where(
                    and(
                        eq(user.role, "shop_owner"),
                        eq(user.isSeller, true),
                    ),
                )
                .orderBy(asc(user.name));

            // Filter out already assigned sellers
            const assignedIds = await assignedSellerIds;
            const assignedIdSet = new Set(
                assignedIds.map((r) => r.sellerId),
            );

            return sellers.filter((s) => !assignedIdSet.has(s.id));
        }),
};
