import { and, count, desc, eq, ilike, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@bikalpo-project/db";
import { itemRequest, product, user, stockChangeLog } from "@bikalpo-project/db/schema";
import { adminProcedure } from "../index";

const itemRequestFiltersSchema = z.object({
    page: z.number().optional().default(1),
    limit: z.number().optional().default(10),
    status: z.string().optional(),
    search: z.string().optional(),
});

export const adminItemRequestRouter = {
    /**
     * Get all item requests (admin view)
     */
    getAll: adminProcedure
        .route({
            method: "POST",
            path: "/admin/item-requests/list",
            tags: ["Admin Item Requests"],
            summary: "Get all item requests",
            description: "Get all item requests with filtering and pagination",
        })
        .input(itemRequestFiltersSchema)
        .handler(async ({ input }) => {
            const page = input.page || 1;
            const limit = input.limit || 10;
            const offset = (page - 1) * limit;

            // Build where conditions
            const conditions = [];

            if (input.status && input.status !== "all") {
                conditions.push(
                    eq(
                        itemRequest.status,
                        input.status as
                        | "pending"
                        | "approved"
                        | "rejected"
                        | "suggested",
                    ),
                );
            }

            if (input.search) {
                conditions.push(
                    or(
                        ilike(itemRequest.itemName, `%${input.search}%`),
                        ilike(itemRequest.requestNumber, `%${input.search}%`),
                    ) as ReturnType<typeof eq>,
                );
            }

            const whereClause =
                conditions.length > 0 ? and(...conditions) : undefined;

            // Get total count
            const [countResult] = await db
                .select({ count: count() })
                .from(itemRequest)
                .where(whereClause);

            const totalCount = countResult?.count || 0;

            // Get requests with customer and suggested product info
            const requests = await db
                .select({
                    id: itemRequest.id,
                    requestNumber: itemRequest.requestNumber,
                    customerId: itemRequest.customerId,
                    itemName: itemRequest.itemName,
                    brand: itemRequest.brand,
                    category: itemRequest.category,
                    quantity: itemRequest.quantity,
                    description: itemRequest.description,
                    image: itemRequest.image,
                    status: itemRequest.status,
                    adminResponse: itemRequest.adminResponse,
                    suggestedProductId: itemRequest.suggestedProductId,
                    processedById: itemRequest.processedById,
                    processedAt: itemRequest.processedAt,
                    createdAt: itemRequest.createdAt,
                    updatedAt: itemRequest.updatedAt,
                    customer: {
                        id: user.id,
                        name: user.name,
                        email: user.email,
                        shopName: user.shopName,
                        phoneNumber: user.phoneNumber,
                    },
                    suggestedProduct: {
                        id: product.id,
                        name: product.name,
                        price: product.price,
                        image: product.image,
                    },
                })
                .from(itemRequest)
                .leftJoin(user, eq(itemRequest.customerId, user.id))
                .leftJoin(product, eq(itemRequest.suggestedProductId, product.id))
                .where(whereClause)
                .orderBy(desc(itemRequest.createdAt))
                .limit(limit)
                .offset(offset);

            return {
                data: {
                    requests,
                    pagination: {
                        page,
                        limit,
                        totalCount,
                        totalPages: Math.ceil(totalCount / limit),
                    },
                },
            };
        }),

    /**
     * Get item request stats for admin dashboard
     */
    getStats: adminProcedure
        .route({
            method: "GET",
            path: "/admin/item-requests/stats",
            tags: ["Admin Item Requests"],
            summary: "Get item request stats",
            description: "Get item request statistics for admin dashboard",
        })
        .handler(async () => {
            const [totalResult] = await db
                .select({ count: count() })
                .from(itemRequest);

            const [pendingResult] = await db
                .select({ count: count() })
                .from(itemRequest)
                .where(eq(itemRequest.status, "pending"));

            const [approvedResult] = await db
                .select({ count: count() })
                .from(itemRequest)
                .where(eq(itemRequest.status, "approved"));

            const [rejectedResult] = await db
                .select({ count: count() })
                .from(itemRequest)
                .where(eq(itemRequest.status, "rejected"));

            const [suggestedResult] = await db
                .select({ count: count() })
                .from(itemRequest)
                .where(eq(itemRequest.status, "suggested"));

            return {
                data: {
                    total: totalResult?.count || 0,
                    pending: pendingResult?.count || 0,
                    approved: approvedResult?.count || 0,
                    rejected: rejectedResult?.count || 0,
                    suggested: suggestedResult?.count || 0,
                },
            };
        }),

    /**
     * Approve an item request
     */
    approve: adminProcedure
        .route({
            method: "POST",
            path: "/admin/item-requests/approve",
            tags: ["Admin Item Requests"],
            summary: "Approve item request",
            description: "Approve an item request and add stock",
        })
        .input(
            z.object({
                requestId: z.number(),
                adminResponse: z.string().optional(),
                addToProductId: z.number(),
            }),
        )
        .handler(async ({ input, context }) => {
            const userId = context.session.user.id;

            if (input.addToProductId <= 0) {
                throw new Error(
                    "Please select a product to add the requested quantity to.",
                );
            }

            const [req] = await db
                .select({
                    quantity: itemRequest.quantity,
                    requestNumber: itemRequest.requestNumber,
                })
                .from(itemRequest)
                .where(eq(itemRequest.id, input.requestId));

            if (!req) {
                throw new Error("Request not found");
            }

            if (req.quantity <= 0) {
                throw new Error("Request has invalid quantity");
            }

            const [prod] = await db
                .select({ id: product.id })
                .from(product)
                .where(eq(product.id, input.addToProductId));
            if (!prod) {
                throw new Error("Selected product not found");
            }

            // Add to product stock
            await db
                .update(product)
                .set({
                    stockQuantity: sql`${product.stockQuantity} + ${req.quantity}`,
                    inStock: true,
                    lastRestockedAt: new Date(),
                })
                .where(eq(product.id, input.addToProductId));

            await db.insert(stockChangeLog).values({
                productId: input.addToProductId,
                changeType: "add",
                quantity: req.quantity,
                reason: `Item request ${req.requestNumber} approved`,
                createdById: userId,
            });

            const [updated] = await db
                .update(itemRequest)
                .set({
                    status: "approved",
                    adminResponse:
                        input.adminResponse ||
                        "Your request has been approved. The item has been added to stock.",
                    processedById: userId,
                    processedAt: new Date(),
                })
                .where(eq(itemRequest.id, input.requestId))
                .returning();

            if (!updated) {
                throw new Error("Request not found");
            }

            return { success: true, request: updated };
        }),

    /**
     * Reject an item request
     */
    reject: adminProcedure
        .route({
            method: "POST",
            path: "/admin/item-requests/reject",
            tags: ["Admin Item Requests"],
            summary: "Reject item request",
            description: "Reject an item request",
        })
        .input(
            z.object({
                requestId: z.number(),
                adminResponse: z.string().optional(),
            }),
        )
        .handler(async ({ input, context }) => {
            const userId = context.session.user.id;

            const [updated] = await db
                .update(itemRequest)
                .set({
                    status: "rejected",
                    adminResponse:
                        input.adminResponse || "Your request has been rejected",
                    processedById: userId,
                    processedAt: new Date(),
                })
                .where(eq(itemRequest.id, input.requestId))
                .returning();

            if (!updated) {
                throw new Error("Request not found");
            }

            return { success: true, request: updated };
        }),

    /**
     * Suggest an alternative product
     */
    suggest: adminProcedure
        .route({
            method: "POST",
            path: "/admin/item-requests/suggest",
            tags: ["Admin Item Requests"],
            summary: "Suggest alternative product",
            description: "Suggest an alternative product for an item request",
        })
        .input(
            z.object({
                requestId: z.number(),
                suggestedProductId: z.number(),
                adminResponse: z.string().optional(),
            }),
        )
        .handler(async ({ input, context }) => {
            const userId = context.session.user.id;

            // Verify product exists
            const productExists = await db.query.product.findFirst({
                where: eq(product.id, input.suggestedProductId),
            });

            if (!productExists) {
                throw new Error("Suggested product not found");
            }

            const [updated] = await db
                .update(itemRequest)
                .set({
                    status: "suggested",
                    suggestedProductId: input.suggestedProductId,
                    adminResponse:
                        input.adminResponse ||
                        `We suggest trying "${productExists.name}" as an alternative`,
                    processedById: userId,
                    processedAt: new Date(),
                })
                .where(eq(itemRequest.id, input.requestId))
                .returning();

            if (!updated) {
                throw new Error("Request not found");
            }

            return { success: true, request: updated };
        }),
};
