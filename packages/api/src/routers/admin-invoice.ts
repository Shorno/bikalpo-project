import { and, count, desc, eq, gte, lte, sum } from "drizzle-orm";
import { z } from "zod";
import { db } from "@bikalpo-project/db";
import { env } from "@bikalpo-project/env/server";
import { invoice, invoiceItem } from "@bikalpo-project/db/schema";
import { adminProcedure } from "../index";

type NewInvoiceItem = typeof invoiceItem.$inferInsert;

const invoiceFiltersSchema = z.object({
    paymentStatus: z.enum(["unpaid", "collected", "settled"]).optional(),
    deliveryStatus: z
        .enum(["not_assigned", "pending", "out_for_delivery", "delivered", "failed"])
        .optional(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
});

export const adminInvoiceRouter = {
    /**
     * Get all invoices (admin view)
     */
    getAll: adminProcedure
        .route({
            method: "POST",
            path: "/admin/invoices/list",
            tags: ["Admin Invoices"],
            summary: "Get all invoices",
            description: "Get all invoices with optional filtering",
        })
        .input(invoiceFiltersSchema)
        .handler(async ({ input }) => {
            const conditions = [];

            if (input.deliveryStatus) {
                conditions.push(eq(invoice.deliveryStatus, input.deliveryStatus));
            }

            if (input.paymentStatus) {
                conditions.push(eq(invoice.paymentStatus, input.paymentStatus));
            }

            if (input.startDate) {
                conditions.push(gte(invoice.createdAt, input.startDate));
            }

            if (input.endDate) {
                conditions.push(lte(invoice.createdAt, input.endDate));
            }

            const invoices = await db.query.invoice.findMany({
                where: conditions.length > 0 ? and(...conditions) : undefined,
                with: {
                    items: true,
                    order: {
                        columns: {
                            id: true,
                            orderNumber: true,
                            status: true,
                        },
                    },
                    customer: {
                        columns: {
                            id: true,
                            name: true,
                            email: true,
                            phoneNumber: true,
                            shopName: true,
                            ownerName: true,
                        },
                    },
                    deliveryman: {
                        columns: {
                            id: true,
                            name: true,
                            phoneNumber: true,
                        },
                    },
                },
                orderBy: [desc(invoice.createdAt)],
            });

            return { success: true, invoices };
        }),

    /**
     * Get invoice by ID
     */
    getById: adminProcedure
        .route({
            method: "POST",
            path: "/admin/invoices/by-id",
            tags: ["Admin Invoices"],
            summary: "Get invoice by ID",
            description: "Get detailed invoice information by ID",
        })
        .input(z.object({ id: z.number() }))
        .handler(async ({ input }) => {
            const invoiceData = await db.query.invoice.findFirst({
                where: eq(invoice.id, input.id),
                with: {
                    items: true,
                    order: {
                        columns: {
                            id: true,
                            orderNumber: true,
                            status: true,
                            shippingName: true,
                            shippingPhone: true,
                            shippingAddress: true,
                            shippingCity: true,
                            shippingArea: true,
                        },
                    },
                    customer: {
                        columns: {
                            id: true,
                            name: true,
                            email: true,
                            phoneNumber: true,
                            shopName: true,
                            ownerName: true,
                        },
                    },
                    deliveryman: {
                        columns: {
                            id: true,
                            name: true,
                            phoneNumber: true,
                        },
                    },
                    splitInvoices: {
                        with: {
                            items: true,
                        },
                    },
                    parentInvoice: true,
                },
            });

            if (!invoiceData) {
                throw new Error("Invoice not found");
            }

            return { success: true, invoice: invoiceData };
        }),

    /**
     * Get invoice statistics
     */
    getStats: adminProcedure
        .route({
            method: "GET",
            path: "/admin/invoices/stats",
            tags: ["Admin Invoices"],
            summary: "Get invoice stats",
            description: "Get invoice statistics for admin dashboard",
        })
        .handler(async () => {
            // Get counts by delivery status
            const statusCounts = await db
                .select({
                    status: invoice.deliveryStatus,
                    count: count(),
                })
                .from(invoice)
                .groupBy(invoice.deliveryStatus);

            // Get counts by payment status
            const paymentCounts = await db
                .select({
                    paymentStatus: invoice.paymentStatus,
                    count: count(),
                })
                .from(invoice)
                .groupBy(invoice.paymentStatus);

            // Get total revenue (from delivered & paid invoices)
            const revenueResult = await db
                .select({
                    totalRevenue: sum(invoice.grandTotal),
                })
                .from(invoice)
                .where(
                    and(
                        eq(invoice.deliveryStatus, "delivered"),
                        eq(invoice.paymentStatus, "collected"),
                    ),
                );

            // Get today's invoices count
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const todayInvoices = await db
                .select({
                    count: count(),
                })
                .from(invoice)
                .where(gte(invoice.createdAt, today));

            return {
                success: true,
                stats: {
                    byStatus: statusCounts.reduce(
                        (acc, curr) => {
                            acc[curr.status] = curr.count;
                            return acc;
                        },
                        {} as Record<string, number>,
                    ),
                    byPayment: paymentCounts.reduce(
                        (acc, curr) => {
                            acc[curr.paymentStatus] = curr.count;
                            return acc;
                        },
                        {} as Record<string, number>,
                    ),
                    totalRevenue: revenueResult[0]?.totalRevenue || "0",
                    todayCount: todayInvoices[0]?.count || 0,
                },
            };
        }),

    /**
     * Update invoice payment status
     */
    updatePaymentStatus: adminProcedure
        .route({
            method: "PATCH",
            path: "/admin/invoices/payment-status",
            tags: ["Admin Invoices"],
            summary: "Update payment status",
            description: "Update the payment status of an invoice",
        })
        .input(
            z.object({
                invoiceId: z.number(),
                paymentStatus: z.enum(["unpaid", "collected", "settled"]),
            }),
        )
        .handler(async ({ input }) => {
            await db
                .update(invoice)
                .set({ paymentStatus: input.paymentStatus })
                .where(eq(invoice.id, input.invoiceId));

            return { success: true };
        }),

    /**
     * Get downloadable PDF URL for an invoice
     */
    getPdfUrl: adminProcedure
        .route({
            method: "POST",
            path: "/admin/invoices/pdf-url",
            tags: ["Admin Invoices"],
            summary: "Get invoice PDF URL",
            description: "Returns backend URL for downloading an invoice PDF",
        })
        .input(z.object({ id: z.number() }))
        .handler(async ({ input }) => {
            const exists = await db.query.invoice.findFirst({
                where: eq(invoice.id, input.id),
                columns: { id: true },
            });

            if (!exists) {
                throw new Error("Invoice not found");
            }

            return {
                success: true,
                url: `${env.BETTER_AUTH_URL}/api/invoices/${input.id}/pdf`,
            };
        }),

    /**
     * Create partial invoice from a main invoice
     */
    createPartialInvoice: adminProcedure
        .route({
            method: "POST",
            path: "/admin/invoices/partial",
            tags: ["Admin Invoices"],
            summary: "Create partial invoice",
            description: "Create a partial/split invoice from a main invoice",
        })
        .input(
            z.object({
                parentInvoiceId: z.number(),
                items: z.array(
                    z.object({
                        productId: z.number(),
                        quantity: z.number().min(1),
                    }),
                ),
            }),
        )
        .handler(async ({ input }) => {
            // Validate quantities against remaining items
            const parentInvoice = await db.query.invoice.findFirst({
                where: eq(invoice.id, input.parentInvoiceId),
                with: {
                    items: true,
                    splitInvoices: {
                        with: {
                            items: true,
                        },
                    },
                },
            });

            if (!parentInvoice) {
                throw new Error("Invoice not found");
            }

            if (parentInvoice.invoiceType !== "main") {
                throw new Error(
                    "Can only create partial invoices from main invoices",
                );
            }

            // Calculate already delivered quantities
            const deliveredQuantities = parentInvoice.splitInvoices.reduce(
                (acc, splitInv) => {
                    splitInv.items.forEach((item) => {
                        acc[item.productId] = (acc[item.productId] || 0) + item.quantity;
                    });
                    return acc;
                },
                {} as Record<number, number>,
            );

            // Validate requested quantities
            for (const item of input.items) {
                const originalItem = parentInvoice.items.find(
                    (i) => i.productId === item.productId,
                );
                if (!originalItem) {
                    throw new Error(
                        `Product ID ${item.productId} not found in original invoice`,
                    );
                }

                const delivered = deliveredQuantities[item.productId] || 0;
                const remaining = originalItem.quantity - delivered;

                if (item.quantity > remaining) {
                    throw new Error(
                        `Requested quantity (${item.quantity}) exceeds remaining quantity (${remaining}) for ${originalItem.productName}`,
                    );
                }
            }

            // Get next split sequence
            const existingSplits = await db.query.invoice.findMany({
                where: eq(invoice.parentInvoiceId, input.parentInvoiceId),
            });
            const nextSequence = existingSplits.length + 1;

            // Calculate totals for split items
            let subtotal = 0;
            const splitItems: NewInvoiceItem[] = [];

            for (const item of input.items) {
                const originalItem = parentInvoice.items.find(
                    (i) => i.productId === item.productId,
                );
                if (!originalItem) continue;

                const unitPrice = Number.parseFloat(originalItem.unitPrice);
                const lineTotal = unitPrice * item.quantity;
                subtotal += lineTotal;

                splitItems.push({
                    invoiceId: 0, // Will be set after invoice creation
                    productId: item.productId,
                    variantId: originalItem.variantId,
                    productName: originalItem.productName,
                    productSku: originalItem.productSku,
                    productImage: originalItem.productImage,
                    quantity: item.quantity,
                    quantityUnit: originalItem.quantityUnit,
                    inventoryUnit: originalItem.inventoryUnit,
                    conversionFactor: originalItem.conversionFactor,
                    inventoryQty: originalItem.conversionFactor
                        ? String(item.quantity * Number(originalItem.conversionFactor))
                        : null,
                    unitPrice: originalItem.unitPrice,
                    lineTotal: lineTotal.toFixed(2),
                });
            }

            // Generate split invoice number
            const splitInvoiceNumber = `${parentInvoice.invoiceNumber}-${nextSequence}`;

            // Create split invoice
            const [newSplitInvoice] = await db
                .insert(invoice)
                .values({
                    invoiceNumber: splitInvoiceNumber,
                    orderId: parentInvoice.orderId,
                    customerId: parentInvoice.customerId,
                    parentInvoiceId: input.parentInvoiceId,
                    splitSequence: nextSequence,
                    invoiceType: "split",
                    paymentStatus: "unpaid",
                    deliveryStatus: "not_assigned",
                    subtotal: subtotal.toFixed(2),
                    discountAmount: "0",
                    deliveryCharge: "0",
                    taxAmount: "0",
                    grandTotal: subtotal.toFixed(2),
                })
                .returning();

            if (!newSplitInvoice) {
                throw new Error("Failed to create split invoice");
            }

            // Insert split items with correct invoice ID
            if (splitItems.length > 0) {
                await db.insert(invoiceItem).values(
                    splitItems.map((item) => ({
                        ...item,
                        invoiceId: newSplitInvoice.id,
                    })),
                );
            }

            return { success: true, invoice: newSplitInvoice };
        }),
};
