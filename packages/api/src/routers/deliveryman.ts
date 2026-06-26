import { db } from "@bikalpo-project/db";
import {
    deliveryGroup,
    deliveryGroupInvoice,
    deliveryKpi,
    deliveryLocationPing,
    deliveryRule,
    emptyPack,
    invoice,
    user,
    order,
    orderReturn,
} from "@bikalpo-project/db/schema";
import { ORPCError } from "@orpc/server";
import { and, asc, count, desc, eq, inArray, sql, type SQL } from "drizzle-orm";
import { z } from "zod";

import { adminProcedure, deliverymanProcedure, protectedProcedure, warehouseOrAdminProcedure } from "../index";
import { syncOrderFromDeliveredInvoice } from "./helpers/invoice-fulfillment";

// Validation schemas
const deliverymanIdSchema = z.object({
    id: z.string(),
});

console.log("--- LOADING DELIVERYMAN ROUTER WITH FIX ---");

function getSessionWarehouseId(context: {
    session: { user: unknown };
}) {
    return (
        context.session.user as { warehouseId?: string | null }
    ).warehouseId ?? null;
}

export const deliverymanRouter = {
    /**
     * Get all deliverymen with stats
     * REST: GET /deliverymen
     */
    getAll: adminProcedure
        .route({
            method: "GET",
            path: "/deliverymen",
            tags: ["Delivery Management"],
            summary: "Get all deliverymen",
            description: "Get all deliverymen with delivery counts and stats",
        })
        .handler(async () => {
            const deliverymenData = await db
                .select({
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    phoneNumber: user.phoneNumber,
                    createdAt: user.createdAt,
                    banned: user.banned,
                    deliveriesCount: sql<number>`COALESCE((
            SELECT COUNT(*)::int FROM delivery_group WHERE delivery_group.deliveryman_id = "user"."id"
          ), 0)`,
                })
                .from(user)
                .where(eq(user.role, "deliveryman"))
                .orderBy(user.name);

            const totalDeliveries = deliverymenData.reduce(
                (sum, d) => sum + (d.deliveriesCount || 0),
                0
            );
            const activeCount = deliverymenData.filter((d) => !d.banned).length;

            return {
                deliverymen: deliverymenData.map((d) => ({
                    ...d,
                    banned: d.banned || false,
                    deliveriesCount: d.deliveriesCount || 0,
                })),
                stats: {
                    total: deliverymenData.length,
                    totalDeliveries,
                    activeCount,
                },
            };
        }),

    /**
     * Get deliveryman by ID with delivery history
     * REST: GET /deliverymen/:id
     */
    getById: adminProcedure
        .route({
            method: "GET",
            path: "/deliverymen/{id}",
            tags: ["Delivery Management"],
            summary: "Get deliveryman by ID",
            description: "Get deliveryman details with active group and delivery history",
        })
        .input(deliverymanIdSchema)
        .handler(async ({ input }) => {
            const [deliverymanData] = await db
                .select({
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    phoneNumber: user.phoneNumber,
                    serviceArea: user.serviceArea,
                    createdAt: user.createdAt,
                    banned: user.banned,
                    deliveriesCount: sql<number>`COALESCE((
            SELECT COUNT(*)::int FROM delivery_group WHERE delivery_group.deliveryman_id = "user"."id"
          ), 0)`,
                })
                .from(user)
                .where(and(eq(user.id, input.id), eq(user.role, "deliveryman")));

            if (!deliverymanData) {
                throw new ORPCError("NOT_FOUND", { message: "Deliveryman not found" });
            }

            // Get all delivery groups for this deliveryman
            const groups = await db
                .select({
                    id: deliveryGroup.id,
                    groupName: deliveryGroup.groupName,
                    status: deliveryGroup.status,
                    vehicleType: deliveryGroup.vehicleType,
                    createdAt: deliveryGroup.createdAt,
                    completedAt: deliveryGroup.completedAt,
                })
                .from(deliveryGroup)
                .where(eq(deliveryGroup.deliverymanId, input.id))
                .orderBy(desc(deliveryGroup.createdAt));

            // Get invoice counts and totals for each group
            const groupsWithDetails = await Promise.all(
                groups.map(async (g) => {
                    const invoiceDetails = await db
                        .select({
                            count: sql<number>`COUNT(*)::int`,
                            total: sql<number>`COALESCE(SUM("invoice"."grand_total"::numeric), 0)`,
                        })
                        .from(deliveryGroupInvoice)
                        .innerJoin(invoice, eq(deliveryGroupInvoice.invoiceId, invoice.id))
                        .where(eq(deliveryGroupInvoice.groupId, g.id));

                    return {
                        ...g,
                        invoiceCount: invoiceDetails[0]?.count || 0,
                        totalValue: Number(invoiceDetails[0]?.total) || 0,
                    };
                })
            );

            // Separate active group from history
            const activeStatuses = ["assigned", "out_for_delivery", "partial"];
            const activeGroup =
                groupsWithDetails.find((g) => activeStatuses.includes(g.status)) || null;
            const deliveryHistory = groupsWithDetails.filter(
                (g) => !activeStatuses.includes(g.status)
            );

            return {
                deliveryman: {
                    ...deliverymanData,
                    banned: deliverymanData.banned || false,
                    deliveriesCount: deliverymanData.deliveriesCount || 0,
                    activeGroup,
                    deliveryHistory,
                },
            };
        }),

    /**
     * Get assigned groups for the current deliveryman
     */
    getMyGroups: deliverymanProcedure
        .route({
            method: "GET",
            path: "/my-deliveries",
            tags: ["Deliveryman"],
            summary: "Get assigned groups for current deliveryman",
        })
        .handler(async ({ context }) => {
            try {
                const warehouseId = getSessionWarehouseId(context);
                const groups = await db.query.deliveryGroup.findMany({
                    where: and(
                        eq(deliveryGroup.deliverymanId, context.session.user.id),
                        sql`${deliveryGroup.status} IN ('assigned', 'out_for_delivery', 'partial')`,
                        ...(warehouseId ? [eq(deliveryGroup.warehouseId, warehouseId)] : []),
                    ),
                    with: {
                        invoices: {
                            with: {
                                invoice: {
                                    with: {
                                        customer: {
                                            columns: {
                                                id: true,
                                                name: true,
                                                phoneNumber: true,
                                                shopName: true,
                                            },
                                        },
                                        items: true,
                                        order: {
                                            columns: {
                                                id: true,
                                                orderNumber: true,
                                                userId: true,
                                                subtotal: true,
                                                shippingCost: true,
                                                discount: true,
                                                total: true,
                                                status: true,
                                                paymentStatus: true,
                                                paymentMethod: true,
                                                shippingName: true,
                                                shippingPhone: true,
                                                shippingEmail: true,
                                                shippingAddress: true,
                                                shippingCity: true,
                                                shippingArea: true,
                                                shippingPostalCode: true,
                                                customerNote: true,
                                                adminNote: true,
                                                createdAt: true,
                                                updatedAt: true,
                                                confirmedAt: true,
                                                shippedAt: true,
                                                deliveredAt: true,
                                                cancelledAt: true,
                                                adminModifiedAt: true,
                                            },
                                        },
                                    },
                                },
                            },
                            orderBy: [deliveryGroupInvoice.sequence],
                        },
                    },
                    orderBy: [desc(deliveryGroup.assignedAt)],
                });

                return { groups };
            } catch (error) {
                console.error("ERROR IN getMyGroups:", error);
                throw error;
            }
        }),

    /**
     * Get delivery group by ID for the current deliveryman
     */
    getMyGroupById: deliverymanProcedure
        .route({
            method: "GET",
            path: "/my-deliveries/{id}",
            tags: ["Deliveryman"],
            summary: "Get assigned group by ID",
        })
        .input(z.object({ id: z.number() }))
        .handler(async ({ input, context }) => {
            const warehouseId = getSessionWarehouseId(context);
            const group = await db.query.deliveryGroup.findFirst({
                where: and(
                    eq(deliveryGroup.id, input.id),
                    eq(deliveryGroup.deliverymanId, context.session.user.id),
                    ...(warehouseId ? [eq(deliveryGroup.warehouseId, warehouseId)] : []),
                ),
                with: {
                    deliveryman: {
                        columns: {
                            id: true,
                            name: true,
                            email: true,
                            phoneNumber: true,
                        },
                    },
                    invoices: {
                        with: {
                            invoice: {
                                with: {
                                    customer: {
                                        columns: {
                                            id: true,
                                            name: true,
                                            phoneNumber: true,
                                            shopName: true,
                                        },
                                    },
                                    items: true,
                                    order: {
                                        columns: {
                                            id: true,
                                            orderNumber: true,
                                            userId: true,
                                            subtotal: true,
                                            shippingCost: true,
                                            discount: true,
                                            total: true,
                                            status: true,
                                            paymentStatus: true,
                                            paymentMethod: true,
                                            shippingName: true,
                                            shippingPhone: true,
                                            shippingEmail: true,
                                            shippingAddress: true,
                                            shippingCity: true,
                                            shippingArea: true,
                                            shippingPostalCode: true,
                                            customerNote: true,
                                            adminNote: true,
                                            createdAt: true,
                                            updatedAt: true,
                                            confirmedAt: true,
                                            shippedAt: true,
                                            deliveredAt: true,
                                            cancelledAt: true,
                                            adminModifiedAt: true,
                                        },
                                    },
                                },
                            },
                        },
                        orderBy: [deliveryGroupInvoice.sequence],
                    },
                },
            });

            if (!group) throw new ORPCError("NOT_FOUND", { message: "Group not found or not assigned to you" });

            return { group };
        }),

    /**
     * Start delivery trip for a group
     */
    startDelivery: deliverymanProcedure
        .route({
            method: "POST",
            path: "/deliveries/{id}/start",
            tags: ["Deliveryman"],
            summary: "Start delivery trip with GPS check-in",
        })
        .input(z.object({
            id: z.number(),
            lat: z.number().optional(),
            lng: z.number().optional(),
        }))
        .handler(async ({ input, context }) => {
            const warehouseId = getSessionWarehouseId(context);
            const group = await db.query.deliveryGroup.findFirst({
                where: eq(deliveryGroup.id, input.id),
                with: { invoices: true },
            });

            if (!group) throw new ORPCError("NOT_FOUND", { message: "Group not found" });
            if (group.deliverymanId !== context.session.user.id) throw new ORPCError("FORBIDDEN");
            if (warehouseId && group.warehouseId !== warehouseId) throw new ORPCError("FORBIDDEN");
            if (group.status !== "assigned") throw new ORPCError("BAD_REQUEST", { message: "Trip already started" });

            const generateOtp = () => Math.floor(1000 + Math.random() * 9000).toString();

            await db.transaction(async (tx) => {
                await tx.update(deliveryGroup).set({
                    status: "out_for_delivery",
                    startLat: input.lat?.toString() ?? null,
                    startLng: input.lng?.toString() ?? null,
                    startedAt: new Date(),
                }).where(eq(deliveryGroup.id, input.id));

                // Collect unique order IDs to update their status
                const orderIdsToUpdate = new Set<number>();

                for (const groupInv of group.invoices) {
                    await tx.update(deliveryGroupInvoice).set({ deliveryOtp: generateOtp() }).where(eq(deliveryGroupInvoice.id, groupInv.id));
                    await tx.update(invoice).set({ deliveryStatus: "out_for_delivery" }).where(eq(invoice.id, groupInv.invoiceId));

                    // Resolve orderId from the invoice
                    const inv = await tx.query.invoice.findFirst({
                        where: eq(invoice.id, groupInv.invoiceId),
                        columns: { orderId: true },
                    });
                    if (inv?.orderId) orderIdsToUpdate.add(inv.orderId);
                }

                // Update linked orders to "processing" + set shippedAt
                if (orderIdsToUpdate.size > 0) {
                    await tx.update(order).set({
                        status: "processing",
                        shippedAt: new Date(),
                    }).where(and(
                        inArray(order.id, [...orderIdsToUpdate]),
                        sql`${order.status} IN ('pending', 'confirmed')`,
                    ));
                }

                // Record initial GPS ping
                if (input.lat && input.lng) {
                    await tx.insert(deliveryLocationPing).values({
                        groupId: input.id,
                        deliverymanId: context.session.user.id,
                        lat: input.lat.toString(),
                        lng: input.lng.toString(),
                    });
                }
            });

            return { success: true };
        }),

    /**
     * Mark invoice as delivered
     */
    markDelivered: deliverymanProcedure
        .route({
            method: "POST",
            path: "/deliveries/mark-delivered",
            tags: ["Deliveryman"],
            summary: "Mark invoice as delivered with payment and GPS",
        })
        .input(z.object({
            deliveryInvoiceId: z.number(),
            deliveryPhoto: z.string().url().optional().nullable(),
            deliveryOtp: z.string().length(4),
            // GPS at delivery location
            lat: z.number().optional(),
            lng: z.number().optional(),
            // Payment collection
            paymentMethod: z.enum(["cash", "bkash", "nagad", "bank_transfer", "other"]).optional(),
            amountCollected: z.number().optional(),
            transactionId: z.string().optional(),
        }))
        .handler(async ({ input, context }) => {
            const warehouseId = getSessionWarehouseId(context);
            const deliveryInv = await db.query.deliveryGroupInvoice.findFirst({
                where: eq(deliveryGroupInvoice.id, input.deliveryInvoiceId),
                with: { group: true, invoice: true },
            });

            if (!deliveryInv) throw new ORPCError("NOT_FOUND");
            if (deliveryInv.group.deliverymanId !== context.session.user.id) throw new ORPCError("FORBIDDEN");
            if (warehouseId && deliveryInv.group.warehouseId !== warehouseId) throw new ORPCError("FORBIDDEN");
            if (deliveryInv.group.status !== "out_for_delivery") throw new ORPCError("BAD_REQUEST", { message: "Trip not started" });
            if (deliveryInv.status !== "pending") throw new ORPCError("BAD_REQUEST", { message: "Already processed" });
            if (deliveryInv.deliveryOtp !== input.deliveryOtp) throw new ORPCError("BAD_REQUEST", { message: "Invalid OTP" });

            await db.transaction(async (tx) => {
                // Update delivery group invoice with all data
                await tx.update(deliveryGroupInvoice).set({
                    status: "delivered",
                    deliveredAt: new Date(),
                    deliveryPhoto: input.deliveryPhoto,
                    deliveryLat: input.lat?.toString() ?? null,
                    deliveryLng: input.lng?.toString() ?? null,
                    paymentMethod: input.paymentMethod ?? null,
                    amountCollected: input.amountCollected?.toString() ?? "0",
                    transactionId: input.transactionId ?? null,
                }).where(eq(deliveryGroupInvoice.id, input.deliveryInvoiceId));

                // Update invoice status
                await tx.update(invoice).set({
                    deliveryStatus: "delivered",
                    deliveredAt: new Date(),
                    paymentStatus: input.amountCollected ? "collected" : "unpaid",
                }).where(eq(invoice.id, deliveryInv.invoiceId));

                await syncOrderFromDeliveredInvoice(tx, deliveryInv.invoiceId);

                // Update delivery group counters + running payment total
                const cashAdd = input.paymentMethod === "cash" ? (input.amountCollected || 0) : 0;
                const digitalAdd = input.paymentMethod && input.paymentMethod !== "cash" ? (input.amountCollected || 0) : 0;

                await tx.update(deliveryGroup).set({
                    completedInvoices: sql`${deliveryGroup.completedInvoices} + 1`,
                    totalCashCollected: sql`${deliveryGroup.totalCashCollected}::numeric + ${cashAdd}`,
                    totalDigitalCollected: sql`${deliveryGroup.totalDigitalCollected}::numeric + ${digitalAdd}`,
                }).where(eq(deliveryGroup.id, deliveryInv.groupId));

                // Record GPS ping at delivery location
                if (input.lat && input.lng) {
                    await tx.insert(deliveryLocationPing).values({
                        groupId: deliveryInv.groupId,
                        deliverymanId: context.session.user.id,
                        lat: input.lat.toString(),
                        lng: input.lng.toString(),
                    });
                }

                // Check if all invoices are processed → auto-close group
                const [remaining] = await tx.select({ count: count() }).from(deliveryGroupInvoice).where(and(
                    eq(deliveryGroupInvoice.groupId, deliveryInv.groupId),
                    eq(deliveryGroupInvoice.status, "pending")
                ));

                if (remaining?.count === 0) {
                    const [failed] = await tx.select({ count: count() }).from(deliveryGroupInvoice).where(and(
                        eq(deliveryGroupInvoice.groupId, deliveryInv.groupId),
                        eq(deliveryGroupInvoice.status, "failed")
                    ));
                    await tx.update(deliveryGroup).set({
                        status: failed?.count && failed.count > 0 ? "partial" : "completed",
                        completedAt: new Date(),
                    }).where(eq(deliveryGroup.id, deliveryInv.groupId));
                }
            });

            return { success: true };
        }),

    /**
     * Mark invoice as failed
     */
    markFailed: deliverymanProcedure
        .route({
            method: "POST",
            path: "/deliveries/mark-failed",
            tags: ["Deliveryman"],
            summary: "Mark invoice as failed with proof",
        })
        .input(z.object({
            deliveryInvoiceId: z.number(),
            failedReason: z.string().min(1),
            failedPhoto: z.string().url().optional().nullable(),
            lat: z.number().optional(),
            lng: z.number().optional(),
        }))
        .handler(async ({ input, context }) => {
            const warehouseId = getSessionWarehouseId(context);
            const deliveryInv = await db.query.deliveryGroupInvoice.findFirst({
                where: eq(deliveryGroupInvoice.id, input.deliveryInvoiceId),
                with: { group: true },
            });

            if (!deliveryInv) throw new ORPCError("NOT_FOUND");
            if (deliveryInv.group.deliverymanId !== context.session.user.id) throw new ORPCError("FORBIDDEN");
            if (warehouseId && deliveryInv.group.warehouseId !== warehouseId) throw new ORPCError("FORBIDDEN");
            if (deliveryInv.group.status !== "out_for_delivery") throw new ORPCError("BAD_REQUEST", { message: "Trip not started" });
            if (deliveryInv.status !== "pending") throw new ORPCError("BAD_REQUEST", { message: "Already processed" });

            await db.transaction(async (tx) => {
                await tx.update(deliveryGroupInvoice).set({
                    status: "failed",
                    failedReason: input.failedReason,
                    failedPhoto: input.failedPhoto ?? null,
                    deliveryLat: input.lat?.toString() ?? null,
                    deliveryLng: input.lng?.toString() ?? null,
                }).where(eq(deliveryGroupInvoice.id, input.deliveryInvoiceId));

                await tx.update(invoice).set({ deliveryStatus: "failed" }).where(eq(invoice.id, deliveryInv.invoiceId));

                // Record GPS ping
                if (input.lat && input.lng) {
                    await tx.insert(deliveryLocationPing).values({
                        groupId: deliveryInv.groupId,
                        deliverymanId: context.session.user.id,
                        lat: input.lat.toString(),
                        lng: input.lng.toString(),
                    });
                }

                const [remaining] = await tx.select({ count: count() }).from(deliveryGroupInvoice).where(and(
                    eq(deliveryGroupInvoice.groupId, deliveryInv.groupId),
                    eq(deliveryGroupInvoice.status, "pending")
                ));

                if (remaining?.count === 0) {
                    await tx.update(deliveryGroup).set({ status: "partial", completedAt: new Date() }).where(eq(deliveryGroup.id, deliveryInv.groupId));
                }
            });

            return { success: true };
        }),

    /**
     * Mark invoice as returned (goods brought back)
     */
    markReturned: deliverymanProcedure
        .route({
            method: "POST",
            path: "/deliveries/mark-returned",
            tags: ["Deliveryman"],
            summary: "Mark invoice as returned — goods brought back to warehouse",
        })
        .input(z.object({
            deliveryInvoiceId: z.number(),
            returnReason: z.string().min(1),
            returnPhoto: z.string().url().optional().nullable(),
            lat: z.number().optional(),
            lng: z.number().optional(),
        }))
        .handler(async ({ input, context }) => {
            const warehouseId = getSessionWarehouseId(context);
            const deliveryInv = await db.query.deliveryGroupInvoice.findFirst({
                where: eq(deliveryGroupInvoice.id, input.deliveryInvoiceId),
                with: { group: true, invoice: true },
            });

            if (!deliveryInv) throw new ORPCError("NOT_FOUND");
            if (deliveryInv.group.deliverymanId !== context.session.user.id) throw new ORPCError("FORBIDDEN");
            if (warehouseId && deliveryInv.group.warehouseId !== warehouseId) throw new ORPCError("FORBIDDEN");
            if (deliveryInv.group.status !== "out_for_delivery") throw new ORPCError("BAD_REQUEST", { message: "Trip not started" });
            if (deliveryInv.status !== "pending") throw new ORPCError("BAD_REQUEST", { message: "Already processed" });

            await db.transaction(async (tx) => {
                // Mark delivery invoice as returned
                await tx.update(deliveryGroupInvoice).set({
                    status: "returned",
                    failedReason: `RETURNED: ${input.returnReason}`,
                    failedPhoto: input.returnPhoto ?? null,
                    deliveryLat: input.lat?.toString() ?? null,
                    deliveryLng: input.lng?.toString() ?? null,
                }).where(eq(deliveryGroupInvoice.id, input.deliveryInvoiceId));

                // Update invoice delivery status
                await tx.update(invoice).set({
                    deliveryStatus: "returned",
                }).where(eq(invoice.id, deliveryInv.invoiceId));

                // Update order status to returned
                if (deliveryInv.invoice?.orderId) {
                    await tx.update(order).set({
                        status: "returned",
                    }).where(eq(order.id, deliveryInv.invoice.orderId));
                }

                // Update group completed count
                await tx.update(deliveryGroup).set({
                    completedInvoices: sql`${deliveryGroup.completedInvoices} + 1`,
                }).where(eq(deliveryGroup.id, deliveryInv.groupId));

                // Record GPS ping
                if (input.lat && input.lng) {
                    await tx.insert(deliveryLocationPing).values({
                        groupId: deliveryInv.groupId,
                        deliverymanId: context.session.user.id,
                        lat: input.lat.toString(),
                        lng: input.lng.toString(),
                    });
                }

                // Check if all invoices processed → auto-close group
                const [remaining] = await tx.select({ count: count() }).from(deliveryGroupInvoice).where(and(
                    eq(deliveryGroupInvoice.groupId, deliveryInv.groupId),
                    eq(deliveryGroupInvoice.status, "pending")
                ));

                if (remaining?.count === 0) {
                    await tx.update(deliveryGroup).set({
                        status: "partial",
                        completedAt: new Date(),
                    }).where(eq(deliveryGroup.id, deliveryInv.groupId));
                }
            });

            return { success: true };
        }),

    /**
     * Get delivery man stats
     */
    getStats: deliverymanProcedure
        .route({
            method: "GET",
            path: "/stats",
            tags: ["Deliveryman"],
            summary: "Get deliveryman statistics",
        })
        .handler(async ({ context }) => {
            const userId = context.session.user.id;
            const warehouseId = getSessionWarehouseId(context);
            const groups = await db.query.deliveryGroup.findMany({
                where: and(
                    eq(deliveryGroup.deliverymanId, userId),
                    ...(warehouseId ? [eq(deliveryGroup.warehouseId, warehouseId)] : []),
                ),
                with: { invoices: true },
            });

            const today = new Date();
            today.setHours(0, 0, 0, 0);

            // Get return statistics
            const returnStats = await db
                .select({
                    count: sql<number>`count(*)::int`,
                    totalAmount: sql<number>`coalesce(sum(${orderReturn.totalAmount}::numeric), 0)::numeric`,
                })
                .from(orderReturn)
                .where(eq(orderReturn.userId, userId));

            const processedReturnStats = await db
                .select({
                    totalAmount: sql<number>`coalesce(sum(${orderReturn.totalAmount}::numeric), 0)::numeric`,
                })
                .from(orderReturn)
                .where(
                    and(
                        eq(orderReturn.userId, userId),
                        eq(orderReturn.status, "processed"),
                    ),
                );

            let todayDelivered = 0, todayFailed = 0, pending = 0, delivered = 0, failed = 0, returned = 0;
            groups.forEach(g => g.invoices.forEach(inv => {
                if (inv.status === "delivered") {
                    delivered++;
                    if (inv.deliveredAt && inv.deliveredAt >= today) todayDelivered++;
                } else if (inv.status === "failed") {
                    failed++;
                    todayFailed++;
                } else if (inv.status === "returned") {
                    returned++;
                    failed++; // count returned as failed for success rate
                } else if (inv.status === "pending") pending++;
            }));

            const totalDeliveriesCount = delivered + failed + pending;
            const successRate = (delivered + failed) > 0 ? Math.round((delivered / (delivered + failed)) * 100) : 100;

            return {
                todayDelivered,
                todayFailed,
                pending,
                activeGroups: groups.filter(g => ["assigned", "out_for_delivery"].includes(g.status)).length,
                delivered,
                failed,
                totalReturns: returnStats[0]?.count ?? 0,
                returnAmountProcessed: Number(processedReturnStats[0]?.totalAmount ?? 0),
                successRate,
                // Missing properties to match DeliveryStatsCount
                totalGroups: groups.length,
                completedGroups: groups.filter(g => ["completed", "partial"].includes(g.status)).length,
                totalDeliveries: totalDeliveriesCount,
            };
        }),

    /**
     * Get delivery man's assigned warehouse details
     */
    getAssignedWarehouse: deliverymanProcedure
        .route({
            method: "GET",
            path: "/assigned-warehouse",
            tags: ["Deliveryman"],
            summary: "Get deliveryman's assigned warehouse details",
        })
        .handler(async ({ context }) => {
            const warehouseId = getSessionWarehouseId(context);
            if (!warehouseId) {
                return null;
            }

            const warehouseUser = await db.query.user.findFirst({
                where: eq(user.id, warehouseId),
            });

            if (!warehouseUser) {
                return null;
            }

            return {
                id: warehouseUser.id,
                name: warehouseUser.name,
                warehouseName: warehouseUser.warehouseName,
                warehouseAddress: warehouseUser.warehouseAddress,
                phoneNumber: warehouseUser.phoneNumber,
                email: warehouseUser.email,
            };
        }),

    /**
     * Get unassigned invoices (admin) for creating delivery groups
     */
    getUnassignedInvoices: warehouseOrAdminProcedure
        .route({
            method: "GET",
            path: "/delivery/invoices/unassigned",
            tags: ["Delivery Management"],
            summary: "Get unassigned invoices",
        })
        .handler(async ({ context }) => {
            const conditions: SQL[] = [
                eq(invoice.deliveryStatus, "not_assigned"),
                eq(invoice.fulfillmentMode, "internal_delivery"),
            ];
            if (context.session.user.role === "warehouse") {
                conditions.push(
                    sql`EXISTS (
                        SELECT 1 FROM "order" scoped_order
                        WHERE scoped_order."id" = ${invoice.orderId}
                          AND scoped_order."warehouse_id" = ${context.session.user.id}
                    )`,
                );
            }

            const invoices = await db.query.invoice.findMany({
                where: and(...conditions),
                with: {
                    customer: {
                        columns: {
                            id: true,
                            name: true,
                            phoneNumber: true,
                            shopName: true,
                        },
                    },
                    order: {
                        columns: {
                            id: true,
                            orderNumber: true,
                            shippingName: true,
                            shippingPhone: true,
                            shippingAddress: true,
                            shippingCity: true,
                            shippingArea: true,
                        },
                    },
                    items: true,
                },
                orderBy: [desc(invoice.createdAt)],
            });

            return { invoices };
        }),

    /**
     * Alias: get deliverymen for assignment (for create-group dialog compatibility)
     */
    getForAssignment: warehouseOrAdminProcedure
        .route({
            method: "GET",
            path: "/delivery/for-assignment",
            tags: ["Delivery Management"],
            summary: "Get deliverymen for assignment",
        })
        .input(z.object({ orderShippingArea: z.string().nullable().optional() }).optional())
        .handler(async ({ input, context }) => {
            const activeGroups = await db
                .select({ deliverymanId: deliveryGroup.deliverymanId })
                .from(deliveryGroup)
                .where(
                    context.session.user.role === "warehouse"
                        ? and(
                            eq(deliveryGroup.warehouseId, context.session.user.id),
                            sql`${deliveryGroup.status} IN ('assigned', 'out_for_delivery', 'partial')`,
                        )
                        : sql`${deliveryGroup.status} IN ('assigned', 'out_for_delivery', 'partial')`,
                );
            const busyDeliverymen = [...new Set(activeGroups.map((g) => g.deliverymanId))];

            const area = input?.orderShippingArea?.trim();
            const conditions: SQL[] = [eq(user.role, "deliveryman")];
            if (context.session.user.role === "warehouse") {
                conditions.push(eq(user.warehouseId, context.session.user.id));
            }

            if (area && area.length > 0) {
                conditions.push(
                    sql`(${user.serviceArea} IS NULL OR ${user.serviceArea} ILIKE ${"%" + area + "%"})`,
                );
            }

            const where = and(...conditions);
            const allDeliverymen = await db.query.user.findMany({
                where,
                columns: {
                    id: true,
                    name: true,
                    email: true,
                    phoneNumber: true,
                    serviceArea: true,
                },
            });

            return {
                deliverymen: allDeliverymen.map((dm) => ({
                    ...dm,
                    hasActiveGroup: busyDeliverymen.includes(dm.id),
                })),
            };
        }),

    /**
     * Create delivery group with selected invoices
     */
    createGroup: warehouseOrAdminProcedure
        .route({
            method: "POST",
            path: "/delivery-groups/create",
            tags: ["Delivery Management"],
            summary: "Create delivery group",
        })
        .input(z.object({
            groupName: z.string().min(1),
            invoiceIds: z.array(z.number()).min(1),
            deliverymanId: z.string().min(1).optional(),
            notes: z.string().optional(),
            vehicleType: z.enum(["bike", "car", "van", "truck"]).optional(),
            expectedDeliveryAt: z.string().optional(),
        }))
        .handler(async ({ input, context }) => {
            let deliveryman: { id: string; name: string; phoneNumber: string | null } | null = null;
            if (input.deliverymanId) {
                const found = await db.query.user.findFirst({
                    where: and(
                        eq(user.id, input.deliverymanId),
                        eq(user.role, "deliveryman"),
                        ...(context.session.user.role === "warehouse"
                            ? [eq(user.warehouseId, context.session.user.id)]
                            : []),
                    ),
                    columns: { id: true, name: true, phoneNumber: true },
                });
                if (!found) {
                    throw new ORPCError("NOT_FOUND", { message: "Deliveryman not found" });
                }
                deliveryman = found;
            }

            const selectedInvoices = await db.query.invoice.findMany({
                where: and(
                    inArray(invoice.id, input.invoiceIds),
                    ...(context.session.user.role === "warehouse"
                        ? [
                            sql`EXISTS (
                                SELECT 1 FROM "order" scoped_order
                                WHERE scoped_order."id" = ${invoice.orderId}
                                  AND scoped_order."warehouse_id" = ${context.session.user.id}
                            )`,
                        ]
                        : []),
                ),
                columns: {
                    id: true,
                    deliveryStatus: true,
                    fulfillmentMode: true,
                },
            });
            if (selectedInvoices.length !== input.invoiceIds.length) {
                throw new ORPCError("BAD_REQUEST", { message: "Some selected invoices were not found" });
            }

            const invalidInvoice = selectedInvoices.find(
                (inv) =>
                    inv.fulfillmentMode !== "internal_delivery"
                    || (
                        inv.deliveryStatus !== "not_assigned"
                        && inv.deliveryStatus !== "pending"
                    ),
            );
            if (invalidInvoice) {
                throw new ORPCError("BAD_REQUEST", {
                    message: "One or more invoices are not ready for internal delivery assignment",
                });
            }

            const expectedDeliveryDate = input.expectedDeliveryAt
                ? new Date(input.expectedDeliveryAt)
                : null;

            const createdGroup = await db.transaction(async (tx) => {
                const [group] = await tx
                    .insert(deliveryGroup)
                    .values({
                        groupName: input.groupName,
                        deliverymanId: input.deliverymanId ?? null,
                        warehouseId: context.session.user.role === "warehouse"
                            ? context.session.user.id
                            : null,
                        status: deliveryman ? "assigned" : "pending_assignment",
                        totalInvoices: input.invoiceIds.length,
                        completedInvoices: 0,
                        notes: input.notes ?? null,
                        vehicleType: input.vehicleType ?? null,
                        expectedDeliveryAt: expectedDeliveryDate,
                        assignedAt: deliveryman ? new Date() : null,
                    })
                    .returning();

                if (!group) throw new ORPCError("INTERNAL_SERVER_ERROR", { message: "Failed to create delivery group" });

                await tx.insert(deliveryGroupInvoice).values(
                    input.invoiceIds.map((invoiceId, index) => ({
                        groupId: group.id,
                        invoiceId,
                        sequence: index,
                        status: "pending" as const,
                    })),
                );

                await tx
                    .update(invoice)
                    .set({
                        deliveryStatus: "pending",
                        deliverymanId: input.deliverymanId ?? null,
                        vehicleType: input.vehicleType ?? null,
                        expectedDeliveryAt: expectedDeliveryDate,
                    })
                    .where(inArray(invoice.id, input.invoiceIds));

                const linkedInvoices = await tx.query.invoice.findMany({
                    where: inArray(invoice.id, input.invoiceIds),
                    columns: { orderId: true },
                });
                const orderIds = [...new Set(linkedInvoices.map(i => i.orderId).filter(Boolean))] as number[];
                if (orderIds.length > 0) {
                    await tx.update(order).set({
                        status: "processing",
                        processingStartedAt: new Date(),
                        shippedAt: new Date(),
                        ...(deliveryman
                            ? {
                                riderName: deliveryman.name,
                                riderPhone: deliveryman.phoneNumber,
                            }
                            : {}),
                    }).where(and(
                        inArray(order.id, orderIds),
                        sql`${order.status} IN ('pending', 'confirmed')`,
                    ));
                }

                return group;
            });

            return { success: true, group: createdGroup };
        }),

    /**
     * Add invoices to an existing open delivery group
     */
    addInvoicesToGroup: warehouseOrAdminProcedure
        .route({
            method: "POST",
            path: "/delivery-groups/{groupId}/add-invoices",
            tags: ["Delivery Management"],
            summary: "Add invoices to an existing delivery group",
        })
        .input(z.object({
            groupId: z.number(),
            invoiceIds: z.array(z.number()).min(1),
        }))
        .handler(async ({ input, context }) => {
            const existingGroup = await db.query.deliveryGroup.findFirst({
                where: and(
                    eq(deliveryGroup.id, input.groupId),
                    inArray(deliveryGroup.status, ["pending_assignment", "assigned"]),
                    ...(context.session.user.role === "warehouse"
                        ? [eq(deliveryGroup.warehouseId, context.session.user.id)]
                        : []),
                ),
                columns: {
                    id: true,
                    deliverymanId: true,
                    totalInvoices: true,
                    vehicleType: true,
                    expectedDeliveryAt: true,
                },
            });
            if (!existingGroup) {
                throw new ORPCError("NOT_FOUND", {
                    message: "Delivery group not found or not open for new invoices",
                });
            }

            const selectedInvoices = await db.query.invoice.findMany({
                where: and(
                    inArray(invoice.id, input.invoiceIds),
                    eq(invoice.fulfillmentMode, "internal_delivery"),
                    eq(invoice.deliveryStatus, "not_assigned"),
                    ...(context.session.user.role === "warehouse"
                        ? [
                            sql`EXISTS (
                                SELECT 1 FROM "order" scoped_order
                                WHERE scoped_order."id" = ${invoice.orderId}
                                  AND scoped_order."warehouse_id" = ${context.session.user.id}
                            )`,
                        ]
                        : []),
                ),
                columns: { id: true },
            });
            if (selectedInvoices.length !== input.invoiceIds.length) {
                throw new ORPCError("BAD_REQUEST", {
                    message: "One or more invoices are not ready to add to a delivery group",
                });
            }

            const alreadyLinked = await db.query.deliveryGroupInvoice.findMany({
                where: inArray(deliveryGroupInvoice.invoiceId, input.invoiceIds),
                columns: { invoiceId: true },
            });
            if (alreadyLinked.length > 0) {
                throw new ORPCError("BAD_REQUEST", {
                    message: "One or more invoices are already in a delivery group",
                });
            }

            const nextSequence = existingGroup.totalInvoices;

            await db.transaction(async (tx) => {
                await tx.insert(deliveryGroupInvoice).values(
                    input.invoiceIds.map((invoiceId, index) => ({
                        groupId: existingGroup.id,
                        invoiceId,
                        sequence: nextSequence + index,
                        status: "pending" as const,
                    })),
                );

                await tx
                    .update(deliveryGroup)
                    .set({
                        totalInvoices: existingGroup.totalInvoices + input.invoiceIds.length,
                    })
                    .where(eq(deliveryGroup.id, existingGroup.id));

                await tx
                    .update(invoice)
                    .set({
                        deliveryStatus: "pending",
                        deliverymanId: existingGroup.deliverymanId,
                        vehicleType: existingGroup.vehicleType,
                        expectedDeliveryAt: existingGroup.expectedDeliveryAt,
                    })
                    .where(inArray(invoice.id, input.invoiceIds));

                const linkedInvoices = await tx.query.invoice.findMany({
                    where: inArray(invoice.id, input.invoiceIds),
                    columns: { orderId: true },
                });
                const orderIds = [...new Set(linkedInvoices.map((row) => row.orderId).filter(Boolean))] as number[];
                if (orderIds.length > 0) {
                    await tx.update(order).set({
                        status: "processing",
                        processingStartedAt: new Date(),
                        shippedAt: new Date(),
                    }).where(and(
                        inArray(order.id, orderIds),
                        sql`${order.status} IN ('pending', 'confirmed')`,
                    ));
                }
            });

            return {
                success: true,
                addedCount: input.invoiceIds.length,
            };
        }),

    /**
     * Alias: get delivery groups (for create-group dialog compatibility)
     */
    getGroups: warehouseOrAdminProcedure
        .route({
            method: "GET",
            path: "/delivery-groups/list",
            tags: ["Delivery Management"],
            summary: "Get delivery groups",
        })
        .input(z.object({ status: z.string().optional() }).optional())
        .handler(async ({ input, context }) => {
            const conditions: SQL[] = [];
            if (input?.status) {
                conditions.push(eq(deliveryGroup.status, input.status as typeof deliveryGroup.$inferSelect.status));
            }
            if (context.session.user.role === "warehouse") {
                conditions.push(eq(deliveryGroup.warehouseId, context.session.user.id));
            }

            const groups = await db.query.deliveryGroup.findMany({
                where: conditions.length > 0 ? and(...conditions) : undefined,
                with: {
                    deliveryman: {
                        columns: {
                            id: true,
                            name: true,
                            email: true,
                            phoneNumber: true,
                        },
                    },
                    invoices: {
                        with: {
                            invoice: {
                                with: {
                                    customer: {
                                        columns: {
                                            id: true,
                                            name: true,
                                            phoneNumber: true,
                                            shopName: true,
                                        },
                                    },
                                    order: true,
                                },
                            },
                        },
                        orderBy: [deliveryGroupInvoice.sequence],
                    },
                },
                orderBy: [desc(deliveryGroup.createdAt)],
            });

            return { groups };
        }),

    // ==================== ADMIN PROCEDURES ====================

    /**
     * Get all delivery groups (admin)
     */
    getDeliveryGroups: warehouseOrAdminProcedure
        .route({
            method: "GET",
            path: "/delivery-groups",
            tags: ["Delivery Management"],
            summary: "Get all delivery groups",
        })
        .input(z.object({ status: z.string().optional() }).optional())
        .handler(async ({ input, context }) => {
            const conditions: SQL[] = [];
            if (input?.status) {
                conditions.push(eq(deliveryGroup.status, input.status as typeof deliveryGroup.$inferSelect.status));
            }
            if (context.session.user.role === "warehouse") {
                conditions.push(eq(deliveryGroup.warehouseId, context.session.user.id));
            }

            const groups = await db.query.deliveryGroup.findMany({
                where: conditions.length > 0 ? and(...conditions) : undefined,
                with: {
                    deliveryman: {
                        columns: {
                            id: true,
                            name: true,
                            email: true,
                            phoneNumber: true,
                        },
                    },
                    invoices: {
                        with: {
                            invoice: {
                                with: {
                                    customer: {
                                        columns: {
                                            id: true,
                                            name: true,
                                            phoneNumber: true,
                                            shopName: true,
                                        },
                                    },
                                    order: true,
                                },
                            },
                        },
                        orderBy: [deliveryGroupInvoice.sequence],
                    },
                },
                orderBy: [desc(deliveryGroup.createdAt)],
            });

            return { groups };
        }),

    /**
     * Get delivery group by ID (admin)
     */
    getGroupById: warehouseOrAdminProcedure
        .route({
            method: "GET",
            path: "/delivery-groups/{id}",
            tags: ["Delivery Management"],
            summary: "Get delivery group by ID",
        })
        .input(z.object({ id: z.number() }))
        .handler(async ({ input, context }) => {
            const group = await db.query.deliveryGroup.findFirst({
                where: and(
                    eq(deliveryGroup.id, input.id),
                    ...(context.session.user.role === "warehouse"
                        ? [eq(deliveryGroup.warehouseId, context.session.user.id)]
                        : []),
                ),
                with: {
                    deliveryman: {
                        columns: {
                            id: true,
                            name: true,
                            email: true,
                            phoneNumber: true,
                        },
                    },
                    invoices: {
                        with: {
                            invoice: {
                                with: {
                                    customer: {
                                        columns: {
                                            id: true,
                                            name: true,
                                            phoneNumber: true,
                                            shopName: true,
                                            warehouseName: true,
                                        },
                                    },
                                    items: true,
                                    order: true,
                                },
                            },
                        },
                        orderBy: [deliveryGroupInvoice.sequence],
                    },
                },
            });

            if (!group) {
                throw new ORPCError("NOT_FOUND", { message: "Delivery group not found" });
            }

            return { group };
        }),

    /**
     * Assign deliveryman to a group (admin)
     */
    assignDeliveryman: warehouseOrAdminProcedure
        .route({
            method: "POST",
            path: "/delivery-groups/{groupId}/assign",
            tags: ["Delivery Management"],
            summary: "Assign deliveryman to delivery group",
        })
        .input(z.object({
            groupId: z.number(),
            deliverymanId: z.string(),
            vehicleType: z.enum(["bike", "car", "van", "truck"]).optional(),
            expectedDeliveryAt: z.string().optional(),
        }))
        .handler(async ({ input, context }) => {
            const existingGroup = await db.query.deliveryGroup.findFirst({
                where: and(
                    eq(deliveryGroup.id, input.groupId),
                    ...(context.session.user.role === "warehouse"
                        ? [eq(deliveryGroup.warehouseId, context.session.user.id)]
                        : []),
                ),
                columns: { id: true, status: true },
            });
            if (!existingGroup) {
                throw new ORPCError("NOT_FOUND", { message: "Delivery group not found" });
            }
            if (!["pending_assignment", "assigned"].includes(existingGroup.status)) {
                throw new ORPCError("BAD_REQUEST", {
                    message: "This delivery group cannot be reassigned",
                });
            }

            // Verify deliveryman exists and has correct role
            const deliveryman = await db.query.user.findFirst({
                where: and(
                    eq(user.id, input.deliverymanId),
                    ...(context.session.user.role === "warehouse"
                        ? [eq(user.warehouseId, context.session.user.id)]
                        : []),
                ),
            });

            if (!deliveryman) {
                throw new ORPCError("NOT_FOUND", { message: "Deliveryman not found" });
            }
            if (deliveryman.role !== "deliveryman") {
                throw new ORPCError("BAD_REQUEST", { message: "User is not a deliveryman" });
            }

            // Check if deliveryman already has an active group (excluding current)
            const activeGroups = await db.query.deliveryGroup.findMany({
                where: and(
                    eq(deliveryGroup.deliverymanId, input.deliverymanId),
                    sql`${deliveryGroup.id} != ${input.groupId}`,
                    ...(context.session.user.role === "warehouse"
                        ? [eq(deliveryGroup.warehouseId, context.session.user.id)]
                        : []),
                    sql`${deliveryGroup.status} IN ('assigned', 'out_for_delivery', 'partial')`
                ),
                columns: { id: true },
            });
            if (activeGroups.length > 0) {
                throw new ORPCError("BAD_REQUEST", { message: "This deliveryman already has an active delivery group" });
            }

            // Assign deliveryman to group
            const set: Record<string, unknown> = {
                deliverymanId: input.deliverymanId,
                status: "assigned",
                assignedAt: new Date(),
            };
            if (input.vehicleType !== undefined) set.vehicleType = input.vehicleType;
            if (input.expectedDeliveryAt !== undefined)
                set.expectedDeliveryAt = input.expectedDeliveryAt
                    ? new Date(input.expectedDeliveryAt)
                    : null;

            await db
                .update(deliveryGroup)
                .set(set)
                .where(eq(deliveryGroup.id, input.groupId));

            const groupInvoiceLinks = await db.query.deliveryGroupInvoice.findMany({
                where: eq(deliveryGroupInvoice.groupId, input.groupId),
                columns: { invoiceId: true },
                with: {
                    invoice: {
                        columns: { orderId: true },
                    },
                },
            });
            const invoiceIds = groupInvoiceLinks.map((link) => link.invoiceId);

            if (invoiceIds.length > 0) {
                await db
                    .update(invoice)
                    .set({
                        deliverymanId: input.deliverymanId,
                        ...(input.vehicleType !== undefined
                            ? { vehicleType: input.vehicleType }
                            : {}),
                        ...(input.expectedDeliveryAt !== undefined
                            ? {
                                expectedDeliveryAt: input.expectedDeliveryAt
                                    ? new Date(input.expectedDeliveryAt)
                                    : null,
                            }
                            : {}),
                    })
                    .where(inArray(invoice.id, invoiceIds));

                const orderIds = [
                    ...new Set(
                        groupInvoiceLinks
                            .map((link) => link.invoice?.orderId)
                            .filter((id): id is number => typeof id === "number"),
                    ),
                ];
                if (orderIds.length > 0) {
                    await db.update(order).set({
                        riderName: deliveryman.name,
                        riderPhone: deliveryman.phoneNumber,
                    }).where(inArray(order.id, orderIds));
                }
            }

            return { success: true };
        }),

    /**
     * Get deliverymen available for assignment (admin)
     */
    getDeliverymenForAssignment: warehouseOrAdminProcedure
        .route({
            method: "GET",
            path: "/deliverymen-for-assignment",
            tags: ["Delivery Management"],
            summary: "Get deliverymen available for assignment",
        })
        .input(z.object({ orderShippingArea: z.string().nullable().optional() }).optional())
        .handler(async ({ input, context }) => {
            // Get deliverymen who already have active groups

            const activeGroups = await db
                .select({ deliverymanId: deliveryGroup.deliverymanId })
                .from(deliveryGroup)
                .where(
                    context.session.user.role === "warehouse"
                        ? and(
                            eq(deliveryGroup.warehouseId, context.session.user.id),
                            sql`${deliveryGroup.status} IN ('assigned', 'out_for_delivery', 'partial')`,
                        )
                        : sql`${deliveryGroup.status} IN ('assigned', 'out_for_delivery', 'partial')`,
                );
            const busyDeliverymen = [...new Set(activeGroups.map((g) => g.deliverymanId))];

            const area = input?.orderShippingArea?.trim();

            // Build conditions: role + area filter
            const conditions: SQL[] = [eq(user.role, "deliveryman")];
            if (context.session.user.role === "warehouse") {
                conditions.push(eq(user.warehouseId, context.session.user.id));
            }

            if (area && area.length > 0) {
                conditions.push(
                    sql`(${user.serviceArea} IS NULL OR ${user.serviceArea} ILIKE ${"%" + area + "%"})`,
                );
            }

            const where = and(...conditions);

            const allDeliverymen = await db.query.user.findMany({
                where,
                columns: {
                    id: true,
                    name: true,
                    email: true,
                    phoneNumber: true,
                    serviceArea: true,
                },
            });

            // Add hasActiveGroup flag
            const deliverymen = allDeliverymen.map((dm) => ({
                ...dm,
                hasActiveGroup: busyDeliverymen.includes(dm.id),
            }));

            return { deliverymen };
        }),

    /**
     * Delete delivery group (admin)
     */
    deleteGroup: warehouseOrAdminProcedure
        .route({
            method: "POST",
            path: "/delivery-groups/{id}/delete",
            tags: ["Delivery Management"],
            summary: "Delete delivery group",
        })
        .input(z.object({ id: z.number() }))
        .handler(async ({ input, context }) => {
            const group = await db.query.deliveryGroup.findFirst({
                where: and(
                    eq(deliveryGroup.id, input.id),
                    ...(context.session.user.role === "warehouse"
                        ? [eq(deliveryGroup.warehouseId, context.session.user.id)]
                        : []),
                ),
            });

            if (!group) {
                throw new ORPCError("NOT_FOUND", { message: "Delivery group not found" });
            }

            if (group.status === "completed") {
                throw new ORPCError("BAD_REQUEST", { message: "Cannot delete completed delivery groups" });
            }

            await db.delete(deliveryGroup).where(
                and(
                    eq(deliveryGroup.id, input.id),
                    ...(context.session.user.role === "warehouse"
                        ? [eq(deliveryGroup.warehouseId, context.session.user.id)]
                        : []),
                ),
            );

            return { success: true };
        }),

    /**
     * Get delivery OTP for an order (customer-facing)
     */
    getOrderDeliveryOtp: protectedProcedure
        .route({
            method: "GET",
            path: "/delivery-otp/{orderId}",
            tags: ["Deliveryman"],
            summary: "Get delivery OTP for an order",
        })
        .input(z.object({ orderId: z.number(), invoiceId: z.number().optional() }))
        .handler(async ({ input, context }) => {
            const userId = context.session.user.id;

            // Get order and verify ownership
            const orderData = await db.query.order.findFirst({
                where: eq(order.id, input.orderId),
            });

            if (!orderData) {
                throw new ORPCError("NOT_FOUND", { message: "Order not found" });
            }
            if (orderData.userId !== userId) {
                throw new ORPCError("FORBIDDEN", { message: "Not authorized" });
            }

            // Get invoices for this order
            const orderInvoices = await db.query.invoice.findMany({
                where: eq(invoice.orderId, input.orderId),
                columns: { id: true },
            });

            if (orderInvoices.length === 0) {
                return { otp: null, showOtp: false, mode: null, label: null };
            }

            const invoiceIds = input.invoiceId
                ? [input.invoiceId]
                : orderInvoices.map((inv) => inv.id);

            if (input.invoiceId && !orderInvoices.some((inv) => inv.id === input.invoiceId)) {
                throw new ORPCError("NOT_FOUND", { message: "Invoice not found on this order" });
            }

            // Find delivery group invoice for any of these invoices
            const selfPickupInvoice = await db.query.invoice.findFirst({
                where: and(
                    inArray(invoice.id, invoiceIds),
                    eq(invoice.fulfillmentMode, "self_pickup"),
                    sql`${invoice.completionOtp} IS NOT NULL`,
                    sql`${invoice.completionOtpVerifiedAt} IS NULL`,
                ),
                orderBy: [desc(invoice.createdAt)],
            });

            if (selfPickupInvoice?.completionOtp) {
                return {
                    otp: selfPickupInvoice.completionOtp,
                    showOtp: true,
                    deliveryStatus: selfPickupInvoice.deliveryStatus,
                    mode: "self_pickup" as const,
                    label: "Pickup OTP",
                    invoiceId: selfPickupInvoice.id,
                };
            }

            const deliveryInvoices = await db.query.deliveryGroupInvoice.findMany({
                where: inArray(deliveryGroupInvoice.invoiceId, invoiceIds),
                with: { group: true },
                orderBy: [desc(deliveryGroupInvoice.id)],
            });

            const deliveryInvoice = deliveryInvoices.find(
                (row) => row.group?.status === "out_for_delivery",
            );

            // Only show OTP if order is out for delivery
            if (
                !deliveryInvoice ||
                !deliveryInvoice.group ||
                deliveryInvoice.group.status !== "out_for_delivery"
            ) {
                return { otp: null, showOtp: false, mode: null, label: null };
            }

            return {
                otp: deliveryInvoice.deliveryOtp,
                showOtp: true,
                deliveryStatus: deliveryInvoice.status,
                mode: "internal_delivery" as const,
                label: "Delivery OTP",
                invoiceId: deliveryInvoice.invoiceId,
            };
        }),

    // ==================== NEW DELIVERY WORKFLOW ENDPOINTS ====================

    /**
     * Periodic GPS ping during delivery route
     */
    pingLocation: deliverymanProcedure
        .route({
            method: "POST",
            path: "/deliveries/ping-location",
            tags: ["Deliveryman"],
            summary: "Send periodic GPS ping during delivery",
        })
        .input(z.object({
            groupId: z.number(),
            lat: z.number(),
            lng: z.number(),
            accuracy: z.number().optional(),
            speed: z.number().optional(),
            batteryLevel: z.number().int().min(0).max(100).optional(),
        }))
        .handler(async ({ input, context }) => {
            // Verify group belongs to this deliveryman and is active
            const group = await db.query.deliveryGroup.findFirst({
                where: and(
                    eq(deliveryGroup.id, input.groupId),
                    eq(deliveryGroup.deliverymanId, context.session.user.id),
                ),
                columns: { id: true, status: true },
            });

            if (!group) throw new ORPCError("NOT_FOUND");
            if (group.status !== "out_for_delivery") return { success: true }; // silently skip if not active

            await db.insert(deliveryLocationPing).values({
                groupId: input.groupId,
                deliverymanId: context.session.user.id,
                lat: input.lat.toString(),
                lng: input.lng.toString(),
                accuracy: input.accuracy?.toString() ?? null,
                speed: input.speed?.toString() ?? null,
                batteryLevel: input.batteryLevel ?? null,
            });

            return { success: true };
        }),

    /**
     * Collect empty pack from customer during delivery
     */
    collectEmptyPack: deliverymanProcedure
        .route({
            method: "POST",
            path: "/deliveries/collect-empty-pack",
            tags: ["Deliveryman"],
            summary: "Record empty pack collection",
        })
        .input(z.object({
            deliveryGroupInvoiceId: z.number(),
            variantId: z.number().optional(),
            brandId: z.number().optional(),
            packDescription: z.string().optional(),
            quantityCollected: z.number().int().min(1),
            photoProof: z.string().url().optional(),
            notes: z.string().optional(),
        }))
        .handler(async ({ input, context }) => {
            // Verify the delivery invoice belongs to this deliveryman
            const deliveryInv = await db.query.deliveryGroupInvoice.findFirst({
                where: eq(deliveryGroupInvoice.id, input.deliveryGroupInvoiceId),
                with: { group: true },
            });

            if (!deliveryInv) throw new ORPCError("NOT_FOUND");
            if (deliveryInv.group.deliverymanId !== context.session.user.id) {
                throw new ORPCError("FORBIDDEN");
            }

            const [created] = await db.insert(emptyPack).values({
                deliveryGroupInvoiceId: input.deliveryGroupInvoiceId,
                variantId: input.variantId ?? null,
                brandId: input.brandId ?? null,
                packDescription: input.packDescription ?? null,
                quantityCollected: input.quantityCollected,
                photoProof: input.photoProof ?? null,
                status: "collected",
                notes: input.notes ?? null,
            }).returning();

            return { success: true, emptyPack: created };
        }),

    /**
     * End delivery route — GPS check-out + auto-calculate reconciliation
     */
    endRoute: deliverymanProcedure
        .route({
            method: "POST",
            path: "/deliveries/{groupId}/end-route",
            tags: ["Deliveryman"],
            summary: "End delivery route with GPS check-out",
        })
        .input(z.object({
            groupId: z.number(),
            lat: z.number().optional(),
            lng: z.number().optional(),
        }))
        .handler(async ({ input, context }) => {
            const group = await db.query.deliveryGroup.findFirst({
                where: and(
                    eq(deliveryGroup.id, input.groupId),
                    eq(deliveryGroup.deliverymanId, context.session.user.id),
                ),
                with: { invoices: { with: { invoice: true } } },
            });

            if (!group) throw new ORPCError("NOT_FOUND");
            if (group.status === "assigned") throw new ORPCError("BAD_REQUEST", { message: "Trip not started yet" });

            // Check if there are still pending invoices
            const pendingCount = group.invoices.filter(i => i.status === "pending").length;
            if (pendingCount > 0) {
                throw new ORPCError("BAD_REQUEST", {
                    message: `${pendingCount} invoice(s) still pending. Complete or fail all before ending route.`,
                });
            }

            // Calculate expected total from delivered invoices
            const expectedTotal = group.invoices
                .filter(i => i.status === "delivered" && i.invoice)
                .reduce((sum, i) => sum + parseFloat(i.invoice?.grandTotal || "0"), 0);

            await db.transaction(async (tx) => {
                const hasFailed = group.invoices.some(i => i.status === "failed");

                await tx.update(deliveryGroup).set({
                    status: hasFailed ? "partial" : "completed",
                    completedAt: new Date(),
                    endLat: input.lat?.toString() ?? null,
                    endLng: input.lng?.toString() ?? null,
                    expectedTotal: expectedTotal.toString(),
                }).where(eq(deliveryGroup.id, input.groupId));

                // Record final GPS ping
                if (input.lat && input.lng) {
                    await tx.insert(deliveryLocationPing).values({
                        groupId: input.groupId,
                        deliverymanId: context.session.user.id,
                        lat: input.lat.toString(),
                        lng: input.lng.toString(),
                    });
                }
            });

            return {
                success: true,
                reconciliation: {
                    expectedTotal,
                    totalCashCollected: parseFloat(group.totalCashCollected || "0"),
                    totalDigitalCollected: parseFloat(group.totalDigitalCollected || "0"),
                    totalCollected: parseFloat(group.totalCashCollected || "0") + parseFloat(group.totalDigitalCollected || "0"),
                    difference: expectedTotal - (parseFloat(group.totalCashCollected || "0") + parseFloat(group.totalDigitalCollected || "0")),
                    deliveredCount: group.invoices.filter(i => i.status === "delivered").length,
                    failedCount: group.invoices.filter(i => i.status === "failed").length,
                },
            };
        }),

    /**
     * Get reconciliation summary for a completed/partial group
     */
    getReconciliation: deliverymanProcedure
        .route({
            method: "GET",
            path: "/deliveries/{groupId}/reconciliation",
            tags: ["Deliveryman"],
            summary: "Get end-of-day reconciliation summary",
        })
        .input(z.object({ groupId: z.number() }))
        .handler(async ({ input, context }) => {
            const group = await db.query.deliveryGroup.findFirst({
                where: and(
                    eq(deliveryGroup.id, input.groupId),
                    eq(deliveryGroup.deliverymanId, context.session.user.id),
                ),
                with: {
                    invoices: {
                        with: { invoice: true },
                    },
                },
            });

            if (!group) throw new ORPCError("NOT_FOUND");

            // Get empty packs for this group
            const groupInvoiceIds = group.invoices.map(i => i.id);
            const packs = groupInvoiceIds.length > 0
                ? await db.select().from(emptyPack).where(
                    inArray(emptyPack.deliveryGroupInvoiceId, groupInvoiceIds),
                )
                : [];

            const expectedTotal = group.invoices
                .filter(i => i.status === "delivered" && i.invoice)
                .reduce((sum, i) => sum + parseFloat(i.invoice?.grandTotal || "0"), 0);

            const totalCash = parseFloat(group.totalCashCollected || "0");
            const totalDigital = parseFloat(group.totalDigitalCollected || "0");

            return {
                groupId: group.id,
                groupName: group.groupName,
                status: group.status,
                supervisorApproval: group.supervisorApproval,

                deliveries: {
                    total: group.invoices.length,
                    delivered: group.invoices.filter(i => i.status === "delivered").length,
                    failed: group.invoices.filter(i => i.status === "failed").length,
                    pending: group.invoices.filter(i => i.status === "pending").length,
                },

                payment: {
                    expectedTotal,
                    totalCashCollected: totalCash,
                    totalDigitalCollected: totalDigital,
                    totalCollected: totalCash + totalDigital,
                    difference: expectedTotal - (totalCash + totalDigital),
                    isBalanced: Math.abs(expectedTotal - (totalCash + totalDigital)) < 0.01,
                },

                emptyPacks: {
                    totalCollected: packs.reduce((s, p) => s + (p.quantityCollected || 0), 0),
                    items: packs,
                },

                timestamps: {
                    startedAt: group.startedAt,
                    completedAt: group.completedAt,
                },
            };
        }),

    /**
     * Batch submit collected empty packs to supervisor
     */
    submitPacks: deliverymanProcedure
        .route({
            method: "POST",
            path: "/deliveries/{groupId}/submit-packs",
            tags: ["Deliveryman"],
            summary: "Submit collected packs to supervisor",
        })
        .input(z.object({
            groupId: z.number(),
        }))
        .handler(async ({ input, context }) => {
            const group = await db.query.deliveryGroup.findFirst({
                where: and(
                    eq(deliveryGroup.id, input.groupId),
                    eq(deliveryGroup.deliverymanId, context.session.user.id),
                ),
                with: { invoices: true },
            });

            if (!group) throw new ORPCError("NOT_FOUND");

            // Mark all collected packs for this group as submitted
            const groupInvoiceIds = group.invoices.map(i => i.id);
            if (groupInvoiceIds.length > 0) {
                await db.update(emptyPack).set({
                    status: "submitted",
                    submittedAt: new Date(),
                }).where(
                    and(
                        inArray(emptyPack.deliveryGroupInvoiceId, groupInvoiceIds),
                        eq(emptyPack.status, "collected"),
                    ),
                );
            }

            return { success: true };
        }),

    // ==================== SUPERVISOR / ADMIN APPROVAL ENDPOINTS ====================

    /**
     * Get delivery groups pending supervisor approval
     */
    getPendingApprovals: warehouseOrAdminProcedure
        .route({
            method: "GET",
            path: "/delivery/pending-approvals",
            tags: ["Delivery Management"],
            summary: "Get groups pending supervisor approval",
        })
        .handler(async ({ context }) => {
            const conditions: SQL[] = [
                sql`${deliveryGroup.status} IN ('completed', 'partial')`,
                eq(deliveryGroup.supervisorApproval, "pending"),
            ];
            if (context.session.user.role === "warehouse") {
                conditions.push(eq(deliveryGroup.warehouseId, context.session.user.id));
            }

            const groups = await db.query.deliveryGroup.findMany({
                where: and(...conditions),
                with: {
                    deliveryman: {
                        columns: { id: true, name: true, phoneNumber: true },
                    },
                    invoices: {
                        with: { invoice: true },
                    },
                },
                orderBy: [desc(deliveryGroup.completedAt)],
            });

            return {
                groups: groups.map(g => {
                    const delivered = g.invoices.filter(i => i.status === "delivered");
                    const expectedTotal = delivered.reduce(
                        (sum, i) => sum + parseFloat(i.invoice?.grandTotal || "0"), 0,
                    );
                    const totalCollected = parseFloat(g.totalCashCollected || "0") + parseFloat(g.totalDigitalCollected || "0");

                    return {
                        ...g,
                        reconciliation: {
                            expectedTotal,
                            totalCollected,
                            difference: expectedTotal - totalCollected,
                            isBalanced: Math.abs(expectedTotal - totalCollected) < 0.01,
                        },
                    };
                }),
            };
        }),

    /**
     * Approve and close a delivery group (admin)
     */
    approveAndClose: warehouseOrAdminProcedure
        .route({
            method: "POST",
            path: "/delivery-groups/{groupId}/approve",
            tags: ["Delivery Management"],
            summary: "Approve cash + packs and close delivery group",
        })
        .input(z.object({
            groupId: z.number(),
            cashReceived: z.boolean().default(true),
            packReceived: z.boolean().default(true),
            supervisorNote: z.string().optional(),
        }))
        .handler(async ({ input, context }) => {
            const group = await db.query.deliveryGroup.findFirst({
                where: and(
                    eq(deliveryGroup.id, input.groupId),
                    ...(context.session.user.role === "warehouse"
                        ? [eq(deliveryGroup.warehouseId, context.session.user.id)]
                        : []),
                ),
                with: { invoices: { with: { invoice: true } } },
            });

            if (!group) throw new ORPCError("NOT_FOUND");
            if (!["completed", "partial"].includes(group.status)) {
                throw new ORPCError("BAD_REQUEST", { message: "Group must be completed/partial to approve" });
            }

            await db.transaction(async (tx) => {
                // Update group approval
                await tx.update(deliveryGroup).set({
                    supervisorApproval: "approved",
                    cashReconciled: input.cashReceived,
                    packReconciled: input.packReceived,
                    supervisorNote: input.supervisorNote ?? null,
                    approvedBy: context.session.user.id,
                    approvedAt: new Date(),
                }).where(eq(deliveryGroup.id, input.groupId));

                // Verify empty packs if approved
                if (input.packReceived) {
                    const invoiceIds = group.invoices.map(i => i.id);
                    if (invoiceIds.length > 0) {
                        await tx.update(emptyPack).set({
                            status: "verified",
                            verifiedBy: context.session.user.id,
                            verifiedAt: new Date(),
                        }).where(
                            and(
                                inArray(emptyPack.deliveryGroupInvoiceId, invoiceIds),
                                eq(emptyPack.status, "submitted"),
                            ),
                        );
                    }
                }

                // Update delivered invoices to settled
                for (const inv of group.invoices) {
                    if (inv.status === "delivered") {
                        await tx.update(invoice).set({
                            paymentStatus: "settled",
                            settledAt: new Date(),
                        }).where(eq(invoice.id, inv.invoiceId));
                    }
                }

                // Log daily KPI
                const delivered = group.invoices.filter(i => i.status === "delivered");
                const failed = group.invoices.filter(i => i.status === "failed");
                const totalDeliveries = delivered.length + failed.length;
                const successRate = totalDeliveries > 0
                    ? ((delivered.length / totalDeliveries) * 100).toFixed(2)
                    : "100.00";

                const today = new Date().toISOString().split("T")[0]!;

                await tx.insert(deliveryKpi).values({
                    deliverymanId: group.deliverymanId,
                    date: today,
                    totalDeliveries,
                    successful: delivered.length,
                    failed: failed.length,
                    totalCashCollected: group.totalCashCollected,
                    totalDigitalCollected: group.totalDigitalCollected,
                    expectedTotal: group.expectedTotal,
                    successRate,
                });
            });

            return { success: true, message: "Delivery group approved and closed" };
        }),

    /**
     * Flag a delivery group for discrepancy (admin)
     */
    flagGroup: warehouseOrAdminProcedure
        .route({
            method: "POST",
            path: "/delivery-groups/{groupId}/flag",
            tags: ["Delivery Management"],
            summary: "Flag delivery group for discrepancy",
        })
        .input(z.object({
            groupId: z.number(),
            supervisorNote: z.string().min(1),
        }))
        .handler(async ({ input, context }) => {
            await db.update(deliveryGroup).set({
                supervisorApproval: "flagged",
                supervisorNote: input.supervisorNote,
                approvedBy: context.session.user.id,
                approvedAt: new Date(),
            }).where(
                and(
                    eq(deliveryGroup.id, input.groupId),
                    ...(context.session.user.role === "warehouse"
                        ? [eq(deliveryGroup.warehouseId, context.session.user.id)]
                        : []),
                ),
            );

            return { success: true };
        }),

    // ==================== DELIVERY RULES PROCEDURES ====================

    /**
     * List all delivery rules (admin)
     */
    listDeliveryRules: adminProcedure
        .route({
            method: "GET",
            path: "/delivery-rules",
            tags: ["Delivery Management"],
            summary: "List delivery rules",
        })
        .handler(async () => {
            const rules = await db.query.deliveryRule.findMany({
                orderBy: [asc(deliveryRule.sortOrder), asc(deliveryRule.id)],
            });
            return { rules };
        }),

    /**
     * Create a delivery rule (admin)
     */
    createDeliveryRule: adminProcedure
        .route({
            method: "POST",
            path: "/delivery-rules",
            tags: ["Delivery Management"],
            summary: "Create delivery rule",
        })
        .input(z.object({
            name: z.string().optional(),
            area: z.string().optional(),
            minWeightKg: z.string().optional(),
            maxWeightKg: z.string().optional(),
            baseCost: z.string().optional(),
            perKgCost: z.string().optional(),
            isActive: z.boolean().optional(),
            sortOrder: z.number().optional(),
            note: z.string().optional(),
        }))
        .handler(async ({ input }) => {
            const [created] = await db
                .insert(deliveryRule)
                .values({
                    name: input.name ?? null,
                    area: input.area ?? null,
                    minWeightKg: input.minWeightKg ?? null,
                    maxWeightKg: input.maxWeightKg ?? null,
                    baseCost: input.baseCost ?? "0",
                    perKgCost: input.perKgCost ?? "0",
                    isActive: input.isActive ?? true,
                    sortOrder: input.sortOrder ?? 0,
                    note: input.note ?? null,
                })
                .returning();
            return { rule: created };
        }),

    /**
     * Update a delivery rule (admin)
     */
    updateDeliveryRule: adminProcedure
        .route({
            method: "POST",
            path: "/delivery-rules/{id}/update",
            tags: ["Delivery Management"],
            summary: "Update delivery rule",
        })
        .input(z.object({
            id: z.number(),
            name: z.string().optional(),
            area: z.string().optional(),
            minWeightKg: z.string().optional(),
            maxWeightKg: z.string().optional(),
            baseCost: z.string().optional(),
            perKgCost: z.string().optional(),
            isActive: z.boolean().optional(),
            sortOrder: z.number().optional(),
            note: z.string().optional(),
        }))
        .handler(async ({ input }) => {
            const { id, ...rest } = input;
            await db
                .update(deliveryRule)
                .set({
                    ...rest,
                    name: rest.name ?? null,
                    area: rest.area ?? null,
                    minWeightKg: rest.minWeightKg ?? null,
                    maxWeightKg: rest.maxWeightKg ?? null,
                    note: rest.note ?? null,
                })
                .where(eq(deliveryRule.id, id));
            return { success: true };
        }),

    /**
     * Delete a delivery rule (admin)
     */
    deleteDeliveryRule: adminProcedure
        .route({
            method: "POST",
            path: "/delivery-rules/{id}/delete",
            tags: ["Delivery Management"],
            summary: "Delete delivery rule",
        })
        .input(z.object({ id: z.number() }))
        .handler(async ({ input }) => {
            await db.delete(deliveryRule).where(eq(deliveryRule.id, input.id));
            return { success: true };
        }),
};

