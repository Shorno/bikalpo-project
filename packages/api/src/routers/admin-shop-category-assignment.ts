import { db } from "@bikalpo-project/db";
import {
    shopCategoryAssignment,
} from "@bikalpo-project/db/schema";
import { user } from "@bikalpo-project/db/schema";
import { ORPCError } from "@orpc/server";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";

import { adminProcedure } from "../index";

export const adminShopCategoryAssignmentRouter = {
    // Get all shops (users with role = shop_owner)
    getShops: adminProcedure.handler(async () => {
        const shops = await db.query.user.findMany({
            where: eq(user.role, "shop_owner"),
            columns: {
                id: true,
                name: true,
                email: true,
                image: true,
                shopName: true,
                businessType: true,
            },
        });
        return { shops };
    }),

    // Get assignments for a specific shop
    getShopAssignments: adminProcedure
        .input(z.object({ shopId: z.string() }))
        .handler(async ({ input }) => {
            const assignments = await db.query.shopCategoryAssignment.findMany({
                where: eq(shopCategoryAssignment.shopId, input.shopId),
                with: {
                    category: true,
                    subcategory: true,
                },
            });
            return { assignments };
        }),

    // Assign a category to a shop
    assignShopCategory: adminProcedure
        .input(
            z.object({
                shopId: z.string(),
                categoryId: z.number(),
                subcategoryId: z.number().optional(),
            }),
        )
        .handler(async ({ context, input }) => {
            // Check for existing assignment
            const existing = await db.query.shopCategoryAssignment.findFirst({
                where: and(
                    eq(shopCategoryAssignment.shopId, input.shopId),
                    eq(shopCategoryAssignment.categoryId, input.categoryId),
                    input.subcategoryId
                        ? eq(shopCategoryAssignment.subcategoryId, input.subcategoryId)
                        : sql`${shopCategoryAssignment.subcategoryId} IS NULL`,
                ),
            });

            if (existing) {
                throw new ORPCError("CONFLICT", { message: "Category already assigned to this shop" });
            }

            const [created] = await db
                .insert(shopCategoryAssignment)
                .values({
                    shopId: input.shopId,
                    categoryId: input.categoryId,
                    subcategoryId: input.subcategoryId || null,
                    assignedBy: context.session.user.id,
                })
                .returning();

            return { assignment: created };
        }),

    // Remove an assignment
    removeShopCategory: adminProcedure
        .input(z.object({ id: z.number() }))
        .handler(async ({ input }) => {
            const [deleted] = await db
                .delete(shopCategoryAssignment)
                .where(eq(shopCategoryAssignment.id, input.id))
                .returning();

            if (!deleted) {
                throw new ORPCError("NOT_FOUND", { message: "Assignment not found" });
            }

            return { success: true };
        }),
};
