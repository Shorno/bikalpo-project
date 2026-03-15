import { db } from "@bikalpo-project/db";
import {
    warehouseCategoryAssignment,
    category as categoryTable,
    subCategory as subCategoryTable,
} from "@bikalpo-project/db/schema";
import { user } from "@bikalpo-project/db/schema";
import { ORPCError } from "@orpc/server";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";

import { adminProcedure } from "../index";

export const adminWarehouseAssignmentRouter = {
    // Get all warehouses (users with role = warehouse)
    getWarehouses: adminProcedure.handler(async () => {
        const warehouses = await db.query.user.findMany({
            where: eq(user.role, "warehouse"),
            columns: {
                id: true,
                name: true,
                email: true,
                image: true,
            },
        });
        return { warehouses };
    }),

    // Get assignments for a specific warehouse
    getAssignments: adminProcedure
        .input(z.object({ warehouseId: z.string() }))
        .handler(async ({ input }) => {
            const assignments = await db.query.warehouseCategoryAssignment.findMany({
                where: eq(warehouseCategoryAssignment.warehouseId, input.warehouseId),
                with: {
                    category: true,
                    subcategory: true,
                },
            });
            return { assignments };
        }),

    // Assign a category to a warehouse
    assign: adminProcedure
        .input(
            z.object({
                warehouseId: z.string(),
                categoryId: z.number(),
                subcategoryId: z.number().optional(),
            }),
        )
        .handler(async ({ context, input }) => {
            // Check for existing assignment
            const existing = await db.query.warehouseCategoryAssignment.findFirst({
                where: and(
                    eq(warehouseCategoryAssignment.warehouseId, input.warehouseId),
                    eq(warehouseCategoryAssignment.categoryId, input.categoryId),
                    input.subcategoryId
                        ? eq(warehouseCategoryAssignment.subcategoryId, input.subcategoryId)
                        : sql`${warehouseCategoryAssignment.subcategoryId} IS NULL`,
                ),
            });

            if (existing) {
                throw new ORPCError("CONFLICT", { message: "Category already assigned" });
            }

            const [created] = await db
                .insert(warehouseCategoryAssignment)
                .values({
                    warehouseId: input.warehouseId,
                    categoryId: input.categoryId,
                    subcategoryId: input.subcategoryId || null,
                    assignedBy: context.session.user.id,
                })
                .returning();

            return { assignment: created };
        }),

    // Remove an assignment
    unassign: adminProcedure
        .input(z.object({ id: z.number() }))
        .handler(async ({ input }) => {
            const [deleted] = await db
                .delete(warehouseCategoryAssignment)
                .where(eq(warehouseCategoryAssignment.id, input.id))
                .returning();

            if (!deleted) {
                throw new ORPCError("NOT_FOUND", { message: "Assignment not found" });
            }

            return { success: true };
        }),

    // Get all categories with subcategories (for the assignment picker)
    getCategoriesWithSubs: adminProcedure.handler(async () => {
        const categories = await db.query.category.findMany({
            with: {
                subCategory: true,
            },
        });
        return { categories };
    }),
};
