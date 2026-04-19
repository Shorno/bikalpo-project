import { db } from "@bikalpo-project/db";
import { orderReturn, order, product } from "@bikalpo-project/db/schema";
import { ORPCError } from "@orpc/server";
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";

import { protectedProcedure } from "../index";

// Zod schemas for input validation
const returnItemSchema = z.object({
    orderItemId: z.number(),
    productId: z.number(),
    sku: z.string().optional(),
    productName: z.string(),
    orderedQty: z.number().optional(),
    deliveredQty: z.number().optional(),
    unitPrice: z.string(),
    returnQty: z.number().min(1),
    reason: z.string(),
    condition: z.string().optional(),
    attachment: z.string().url().optional(),
});

const submitReturnSchema = z.object({
    orderId: z.number(),
    returnedItems: z.array(returnItemSchema).min(1),
    refundType: z.enum(["cash", "wallet", "adjustment"]).default("cash"),
    additionalCharge: z.string().optional().default("0"),
    notes: z.string().optional(),
    attachments: z.array(z.string().url()).optional(),
    isDraft: z.boolean().optional().default(false),
});

export const returnsRouter = {
    getAll: protectedProcedure
        .route({
            method: "GET",
            path: "/returns",
            tags: ["Returns"],
            summary: "Get all returns",
        })
        .handler(async ({ context }) => {
            const isAdmin = context.session.user.role === "admin";
            const isEmployee =
                context.session.user.role === "deliveryman" ||
                context.session.user.role === "salesman";

            const conditions = [];

            if (!isAdmin && !isEmployee) {
                conditions.push(eq(orderReturn.userId, context.session.user.id));
            }

            const returns = await db.query.orderReturn.findMany({
                where: conditions.length > 0 ? and(...conditions) : undefined,
                with: {
                    order: {
                        columns: {
                            id: true,
                            orderNumber: true,
                            total: true,
                            status: true,
                        },
                    },
                    user: {
                        columns: {
                            id: true,
                            name: true,
                            email: true,
                            phoneNumber: true,
                        },
                    },
                    submitter: {
                        columns: {
                            id: true,
                            name: true,
                            phoneNumber: true,
                        },
                    },
                    processor: {
                        columns: {
                            id: true,
                            name: true,
                        },
                    },
                },
                orderBy: [desc(orderReturn.createdAt)],
            });

            return { returns };
        }),

    getById: protectedProcedure
        .route({
            method: "GET",
            path: "/returns/{id}",
            tags: ["Returns"],
            summary: "Get return by ID",
        })
        .input(z.object({ id: z.number() }))
        .handler(async ({ input, context }) => {
            const isStaff =
                context.session.user.role === "admin" ||
                context.session.user.role === "deliveryman" ||
                context.session.user.role === "salesman";

            const returnData = await db.query.orderReturn.findFirst({
                where: eq(orderReturn.id, input.id),
                with: {
                    order: {
                        with: {
                            items: true,
                            user: {
                                columns: {
                                    id: true,
                                    name: true,
                                    email: true,
                                    phoneNumber: true,
                                    shopName: true,
                                },
                            },
                        },
                    },
                    user: {
                        columns: {
                            id: true,
                            name: true,
                            email: true,
                            phoneNumber: true,
                        },
                    },
                    processor: {
                        columns: {
                            id: true,
                            name: true,
                        },
                    },
                },
            });

            if (!returnData) {
                throw new ORPCError("NOT_FOUND", { message: "Return not found" });
            }

            if (!isStaff && returnData.userId !== context.session.user.id) {
                throw new ORPCError("NOT_FOUND", { message: "Return not found" });
            }

            return { return: returnData };
        }),

    getOrderForReturn: protectedProcedure
        .route({
            method: "GET",
            path: "/returns/order-for-return",
            tags: ["Returns"],
            summary: "Get order details for return processing",
        })
        .input(z.object({ orderId: z.number() }))
        .handler(async ({ input, context }) => {
            const isEmployee =
                context.session.user.role === "admin" ||
                context.session.user.role === "deliveryman" ||
                context.session.user.role === "salesman";

            if (!isEmployee) {
                throw new ORPCError("FORBIDDEN", { message: "Not authorized" });
            }

            // Get order with full details
            const orderData = await db.query.order.findFirst({
                where: eq(order.id, input.orderId),
                with: {
                    items: true,
                    user: {
                        columns: {
                            id: true,
                            name: true,
                            email: true,
                            phoneNumber: true,
                            shopName: true,
                        },
                    },
                },
            });

            if (!orderData) {
                throw new ORPCError("NOT_FOUND", { message: "Order not found" });
            }

            // Get all existing returns for this order (processed/approved only, not rejected)
            const existingReturns = await db.query.orderReturn.findMany({
                where: and(
                    eq(orderReturn.orderId, input.orderId),
                    sql`${orderReturn.status} IN ('pending', 'approved', 'processed')`,
                ),
                columns: {
                    id: true,
                    status: true,
                    items: true,
                },
            });

            // Calculate already returned quantities per order item
            const returnedQuantities: Record<number, number> = {};

            for (const ret of existingReturns) {
                if (ret.items && Array.isArray(ret.items)) {
                    for (const item of ret.items as { orderItemId: number; quantity: number }[]) {
                        returnedQuantities[item.orderItemId] = (returnedQuantities[item.orderItemId] ?? 0) + item.quantity;
                    }
                }
            }

            // Enhance order items with returned quantities
            const itemsWithReturnInfo = orderData.items.map((item) => ({
                ...item,
                returnedQty: returnedQuantities[item.id] || 0,
                availableToReturn: item.quantity - (returnedQuantities[item.id] || 0),
            }));

            return {
                order: {
                    ...orderData,
                    items: itemsWithReturnInfo,
                },
                hasExistingReturns: existingReturns.length > 0,
                existingReturnCount: existingReturns.length,
            };
        }),

    submit: protectedProcedure
        .route({
            method: "POST",
            path: "/returns/submit",
            tags: ["Returns"],
            summary: "Submit a return request",
        })
        .input(submitReturnSchema)
        .handler(async ({ input, context }) => {
            const {
                orderId,
                returnedItems,
                refundType,
                additionalCharge,
                notes,
                attachments,
            } = input;

            // Get order
            const orderData = await db.query.order.findFirst({
                where: eq(order.id, orderId),
                with: { items: true, user: true },
            });

            if (!orderData) {
                throw new ORPCError("NOT_FOUND", { message: "Order not found" });
            }

            // Check for existing pending return
            const existingReturn = await db.query.orderReturn.findFirst({
                where: and(
                    eq(orderReturn.orderId, orderId),
                    eq(orderReturn.status, "pending"),
                ),
            });

            if (existingReturn) {
                throw new ORPCError("BAD_REQUEST", {
                    message: "A return request already exists for this order",
                });
            }

            // Calculate total return amount
            const totalReturnAmount = returnedItems.reduce((sum, item) => {
                return sum + item.returnQty * Number(item.unitPrice);
            }, 0);

            const additionalChargeNum = Number(additionalCharge) || 0;
            const payableAmount = totalReturnAmount - additionalChargeNum;

            // Convert returned items to ReturnItem format
            const returnItems = returnedItems.map((item) => ({
                orderItemId: item.orderItemId,
                productId: item.productId,
                productName: item.productName,
                quantity: item.returnQty,
                unitPrice: item.unitPrice,
                reason: item.reason,
                attachment: item.attachment,
            }));

            // Build reason string from items
            const reasonsSummary = returnedItems
                .map((item) => `${item.productName}: ${item.reason.replace("_", " ")}`)
                .join("; ");

            // Create return request
            const [newReturn] = await db
                .insert(orderReturn)
                .values({
                    orderId,
                    userId: orderData.userId,
                    submittedBy: context.session.user.id,
                    reason: reasonsSummary,
                    returnType: "partial",
                    items: returnItems,
                    totalAmount: payableAmount.toString(),
                    refundType: refundType,
                    status: "pending",
                    notes: notes || null,
                    attachments: attachments && attachments.length > 0 ? attachments : null,
                })
                .returning();

            return { success: true, return: newReturn! };
        }),

    processReturn: protectedProcedure
        .route({
            method: "POST",
            path: "/returns/process",
            tags: ["Returns"],
            summary: "Process (approve/reject) a return request",
        })
        .input(z.object({
            returnId: z.number(),
            action: z.enum(["approve", "reject"]),
            refundType: z.enum(["cash", "wallet", "adjustment"]).optional(),
            adminNotes: z.string().optional(),
            restockItems: z.boolean().optional(),
        }))
        .handler(async ({ input, context }) => {
            if (context.session.user.role !== "admin") {
                throw new ORPCError("FORBIDDEN", { message: "Admin access required" });
            }

            const { returnId, action, refundType, adminNotes, restockItems } = input;

            const returnData = await db.query.orderReturn.findFirst({
                where: eq(orderReturn.id, returnId),
                with: { order: { with: { items: true } } },
            });

            if (!returnData) {
                throw new ORPCError("NOT_FOUND", { message: "Return request not found" });
            }

            if (returnData.status !== "pending") {
                throw new ORPCError("BAD_REQUEST", { message: "Return has already been processed" });
            }

            const updateData: Record<string, unknown> = {
                processedBy: context.session.user.id,
                processedAt: new Date(),
            };

            if (action === "approve") {
                updateData.status = "processed";

                if (!refundType) {
                    throw new ORPCError("BAD_REQUEST", { message: "Refund type is required for approval" });
                }
                updateData.refundType = refundType;

                // Restocking removed — stock is now tracked via the inventory system
                if (restockItems) {
                    if (returnData.returnType === "full") {
                        updateData.restocked = returnData.order.items.length;
                    } else if (returnData.items) {
                        updateData.restocked = returnData.items.length;
                    }
                }

                // Update payment status on order
                await db
                    .update(order)
                    .set({ paymentStatus: "refunded" })
                    .where(eq(order.id, returnData.orderId));
            } else {
                updateData.status = "rejected";
            }

            if (adminNotes) {
                updateData.adminNotes = adminNotes;
            }

            await db
                .update(orderReturn)
                .set(updateData)
                .where(eq(orderReturn.id, returnId));

            return { success: true };
        }),
};
