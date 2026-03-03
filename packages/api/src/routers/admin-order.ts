import { and, count, desc, eq, gte, isNotNull, sql, sum } from "drizzle-orm";
import { z } from "zod";
import { db } from "@bikalpo-project/db";
import { order, orderItem, product } from "@bikalpo-project/db/schema";
import { adminProcedure } from "../index";

export const adminOrderRouter = {
    getAll: adminProcedure
        .route({
            method: "POST",
            path: "/admin/orders/list",
            tags: ["Admin Orders"],
            summary: "Get all orders",
            description: "Get all orders with optional filtering",
        })
        .input(
            z.object({
                status: z
                    .enum(["pending", "confirmed", "processing", "delivered", "cancelled"])
                    .optional(),
                orderType: z.enum(["b2b", "b2c"]).optional(),
                startDate: z.coerce.date().optional(),
                endDate: z.coerce.date().optional(),
            }),
        )
        .handler(async ({ input: options }) => {
            const conditions = [];
            if (options.status) conditions.push(eq(order.status, options.status));
            if (options.orderType) conditions.push(eq(order.orderType, options.orderType));
            if (options.startDate) conditions.push(gte(order.createdAt, options.startDate));
            if (options.endDate) conditions.push(eq(order.createdAt, options.endDate));

            const orders = await db.query.order.findMany({
                where: conditions.length > 0 ? and(...conditions) : undefined,
                with: {
                    items: true,
                    user: { columns: { id: true, name: true, email: true, phoneNumber: true, shopName: true } },
                },
                orderBy: [desc(order.createdAt)],
            });

            return orders;
        }),

    getById: adminProcedure
        .route({
            method: "POST",
            path: "/admin/orders/by-id",
            tags: ["Admin Orders"],
            summary: "Get order by ID",
            description: "Get detailed order information by ID",
        })
        .input(z.object({ id: z.number() }))
        .handler(async ({ input }) => {
            const orderData = await db.query.order.findFirst({
                where: eq(order.id, input.id),
                with: {
                    items: true,
                    user: {
                        columns: { id: true, name: true, email: true, phoneNumber: true, shopName: true, ownerName: true },
                    },
                },
            });

            if (!orderData) throw new Error("Order not found");
            return orderData;
        }),

    getStats: adminProcedure
        .route({
            method: "GET",
            path: "/admin/orders/stats",
            tags: ["Admin Orders"],
            summary: "Get order stats",
            description: "Get order statistics for admin dashboard",
        })
        .handler(async () => {
            const ordersByStatus = await db
                .select({ status: order.status, count: count() })
                .from(order)
                .groupBy(order.status);

            const revenueResult = await db
                .select({ totalRevenue: sum(order.total) })
                .from(order)
                .where(eq(order.status, "delivered"));

            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const todayOrders = await db.select({ count: count() }).from(order).where(gte(order.createdAt, today));
            const pendingOrders = await db
                .select({ count: count() })
                .from(order)
                .where(eq(order.status, "pending"));

            return {
                ordersByStatus: ordersByStatus.reduce(
                    (acc: Record<string, number>, curr) => {
                        acc[curr.status] = curr.count;
                        return acc;
                    },
                    {} as Record<string, number>,
                ),
                totalRevenue: revenueResult[0]?.totalRevenue || "0",
                todayOrdersCount: todayOrders[0]?.count || 0,
                pendingOrdersCount: pendingOrders[0]?.count || 0,
            };
        }),

    getWithPriceChange: adminProcedure
        .route({
            method: "GET",
            path: "/admin/orders/price-changes",
            tags: ["Admin Orders"],
            summary: "Get orders with price changes",
            description: "Get pending orders that had price changes",
        })
        .handler(async () => {
            const orders = await db.query.order.findMany({
                where: and(eq(order.status, "pending"), isNotNull(order.previousTotal)),
                with: {
                    items: true,
                    user: { columns: { id: true, name: true, email: true, phoneNumber: true, shopName: true } },
                },
                orderBy: [desc(order.totalPriceChangedAt)],
            });
            return orders;
        }),

    approve: adminProcedure
        .route({
            method: "POST",
            path: "/admin/orders/approve",
            tags: ["Admin Orders"],
            summary: "Approve order",
            description: "Approve a pending order and generate invoice",
        })
        .input(z.object({ orderId: z.number(), adminNote: z.string().optional() }))
        .handler(async ({ input }) => {
            const existingOrder = await db.query.order.findFirst({
                where: eq(order.id, input.orderId),
            });

            if (!existingOrder) throw new Error("Order not found");
            if (existingOrder.status !== "pending") throw new Error("Only pending orders can be approved");

            await db
                .update(order)
                .set({
                    status: "confirmed",
                    confirmedAt: new Date(),
                    ...(input.adminNote && { adminNote: input.adminNote }),
                })
                .where(eq(order.id, input.orderId));

            // Auto-generate invoice when order is confirmed
            const { generateInvoiceFromOrder } = await import("./helpers/generate-invoice");
            await generateInvoiceFromOrder(input.orderId);

            return { success: true };
        }),

    reject: adminProcedure
        .route({
            method: "POST",
            path: "/admin/orders/reject",
            tags: ["Admin Orders"],
            summary: "Reject order",
            description: "Reject a pending order and restore stock",
        })
        .input(z.object({ orderId: z.number(), rejectionReason: z.string() }))
        .handler(async ({ input }) => {
            const existingOrder = await db.query.order.findFirst({
                where: eq(order.id, input.orderId),
                with: { items: true },
            });

            if (!existingOrder) throw new Error("Order not found");
            if (existingOrder.status !== "pending") throw new Error("Only pending orders can be rejected");

            await db
                .update(order)
                .set({
                    status: "cancelled",
                    cancelledAt: new Date(),
                    adminNote: input.rejectionReason,
                })
                .where(eq(order.id, input.orderId));

            // Restore stock when order is rejected
            await db.transaction(async (tx) => {
                for (const item of existingOrder.items) {
                    await tx
                        .update(product)
                        .set({ stockQuantity: sql`${product.stockQuantity} + ${item.quantity}` })
                        .where(eq(product.id, item.productId));
                }
            });

            return { success: true };
        }),

    updateItems: adminProcedure
        .route({
            method: "PUT",
            path: "/admin/orders/update-items",
            tags: ["Admin Orders"],
            summary: "Update order items",
            description: "Update items in a pending order",
        })
        .input(
            z.object({
                orderId: z.number(),
                items: z.array(
                    z.object({
                        itemId: z.number().optional(),
                        productId: z.number(),
                        quantity: z.number(),
                        remove: z.boolean().optional(),
                    }),
                ),
                adminNote: z.string().optional(),
            }),
        )
        .handler(async ({ input }) => {
            const existingOrder = await db.query.order.findFirst({
                where: eq(order.id, input.orderId),
                with: { items: true },
            });

            if (!existingOrder) throw new Error("Order not found");
            if (existingOrder.status !== "pending") throw new Error("Only pending orders can be edited");

            await db.transaction(async (tx) => {
                for (const update of input.items) {
                    if (update.itemId && update.remove) {
                        const existingItem = existingOrder.items.find((i) => i.id === update.itemId);
                        if (existingItem) {
                            await tx
                                .update(product)
                                .set({ stockQuantity: sql`${product.stockQuantity} + ${existingItem.quantity}` })
                                .where(eq(product.id, existingItem.productId));
                            await tx.delete(orderItem).where(eq(orderItem.id, update.itemId));
                        }
                    } else if (update.itemId) {
                        const existingItem = existingOrder.items.find((i) => i.id === update.itemId);
                        if (existingItem) {
                            const quantityDiff = update.quantity - existingItem.quantity;

                            if (quantityDiff > 0) {
                                const productData = await tx.query.product.findFirst({
                                    where: eq(product.id, update.productId),
                                });
                                if (!productData || productData.stockQuantity < quantityDiff) {
                                    throw new Error(`Insufficient stock for product ${update.productId}`);
                                }
                            }

                            await tx
                                .update(product)
                                .set({ stockQuantity: sql`${product.stockQuantity} - ${quantityDiff}` })
                                .where(eq(product.id, existingItem.productId));

                            const productData = await tx.query.product.findFirst({
                                where: eq(product.id, update.productId),
                            });

                            if (productData) {
                                const unitPrice = Number(productData.price);
                                const totalPrice = unitPrice * update.quantity;

                                await tx
                                    .update(orderItem)
                                    .set({
                                        quantity: update.quantity,
                                        totalPrice: totalPrice.toFixed(2),
                                    })
                                    .where(eq(orderItem.id, update.itemId));
                            }
                        }
                    } else {
                        const productData = await tx.query.product.findFirst({
                            where: eq(product.id, update.productId),
                        });

                        if (!productData) throw new Error(`Product ${update.productId} not found`);
                        if (productData.stockQuantity < update.quantity) {
                            throw new Error(`Insufficient stock for ${productData.name}`);
                        }

                        await tx
                            .update(product)
                            .set({ stockQuantity: sql`${product.stockQuantity} - ${update.quantity}` })
                            .where(eq(product.id, update.productId));

                        const unitPrice = Number(productData.price);
                        const totalPrice = unitPrice * update.quantity;

                        await tx.insert(orderItem).values({
                            orderId: input.orderId,
                            productId: update.productId,
                            productName: productData.name,
                            productImage: productData.image || "",
                            productSize: productData.size || "N/A",
                            quantity: update.quantity,
                            unitPrice: unitPrice.toFixed(2),
                            totalPrice: totalPrice.toFixed(2),
                        });
                    }
                }

                // Recalculate order totals
                const updatedItems = await tx.query.orderItem.findMany({
                    where: eq(orderItem.orderId, input.orderId),
                });

                const subtotal = updatedItems.reduce((s, item) => s + Number(item.totalPrice), 0);
                const total = subtotal - Number(existingOrder.discount) + Number(existingOrder.shippingCost);

                const previousTotal = existingOrder.total;
                const totalChanged = Math.abs(Number(previousTotal) - total) > 0.01;

                await tx
                    .update(order)
                    .set({
                        subtotal: subtotal.toFixed(2),
                        total: total.toFixed(2),
                        adminModifiedAt: new Date(),
                        ...(totalChanged && { previousTotal: previousTotal, totalPriceChangedAt: new Date() }),
                        ...(input.adminNote && { adminNote: input.adminNote }),
                    })
                    .where(eq(order.id, input.orderId));
            });

            return { success: true };
        }),
};
