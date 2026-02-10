import { db } from "@bikalpo-project/db";
import { deliveryGroup, deliveryGroupInvoice, invoice, user, order, orderReturn } from "@bikalpo-project/db/schema";
import { ORPCError } from "@orpc/server";
import { and, desc, eq, sql, count } from "drizzle-orm";
import { z } from "zod";

import { adminProcedure, deliverymanProcedure } from "../index";

// Validation schemas
const deliverymanIdSchema = z.object({
    id: z.string(),
});

console.log("--- LOADING DELIVERYMAN ROUTER WITH FIX ---");

export const deliverymanRouter = {
    /**
     * Get all deliverymen with stats
     * REST: GET /deliverymen
     */
    getAll: adminProcedure
        .route({
            method: "GET",
            path: "/deliverymen",
            tags: ["Deliverymen"],
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
            tags: ["Deliverymen"],
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
                const groups = await db.query.deliveryGroup.findMany({
                    where: and(
                        eq(deliveryGroup.deliverymanId, context.session.user.id),
                        sql`${deliveryGroup.status} IN ('assigned', 'out_for_delivery', 'partial')`
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
            const group = await db.query.deliveryGroup.findFirst({
                where: and(
                    eq(deliveryGroup.id, input.id),
                    eq(deliveryGroup.deliverymanId, context.session.user.id)
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
            summary: "Start delivery trip",
        })
        .input(z.object({ id: z.number() }))
        .handler(async ({ input, context }) => {
            const group = await db.query.deliveryGroup.findFirst({
                where: eq(deliveryGroup.id, input.id),
                with: { invoices: true },
            });

            if (!group) throw new ORPCError("NOT_FOUND", { message: "Group not found" });
            if (group.deliverymanId !== context.session.user.id) throw new ORPCError("FORBIDDEN");
            if (group.status !== "assigned") throw new ORPCError("BAD_REQUEST", { message: "Trip already started" });

            const generateOtp = () => Math.floor(1000 + Math.random() * 9000).toString();

            await db.transaction(async (tx) => {
                await tx.update(deliveryGroup).set({ status: "out_for_delivery" }).where(eq(deliveryGroup.id, input.id));

                for (const groupInv of group.invoices) {
                    await tx.update(deliveryGroupInvoice).set({ deliveryOtp: generateOtp() }).where(eq(deliveryGroupInvoice.id, groupInv.id));
                    await tx.update(invoice).set({ deliveryStatus: "out_for_delivery" }).where(eq(invoice.id, groupInv.invoiceId));
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
            summary: "Mark invoice as delivered",
        })
        .input(z.object({
            deliveryInvoiceId: z.number(),
            deliveryPhoto: z.string().url().optional().nullable(),
            deliveryOtp: z.string().length(4),
        }))
        .handler(async ({ input, context }) => {
            const deliveryInv = await db.query.deliveryGroupInvoice.findFirst({
                where: eq(deliveryGroupInvoice.id, input.deliveryInvoiceId),
                with: { group: true, invoice: true },
            });

            if (!deliveryInv) throw new ORPCError("NOT_FOUND");
            if (deliveryInv.group.deliverymanId !== context.session.user.id) throw new ORPCError("FORBIDDEN");
            if (deliveryInv.group.status !== "out_for_delivery") throw new ORPCError("BAD_REQUEST", { message: "Trip not started" });
            if (deliveryInv.status !== "pending") throw new ORPCError("BAD_REQUEST", { message: "Already processed" });
            if (deliveryInv.deliveryOtp !== input.deliveryOtp) throw new ORPCError("BAD_REQUEST", { message: "Invalid OTP" });

            await db.transaction(async (tx) => {
                await tx.update(deliveryGroupInvoice).set({
                    status: "delivered",
                    deliveredAt: new Date(),
                    deliveryPhoto: input.deliveryPhoto,
                }).where(eq(deliveryGroupInvoice.id, input.deliveryInvoiceId));

                await tx.update(invoice).set({
                    deliveryStatus: "delivered",
                    deliveredAt: new Date(),
                }).where(eq(invoice.id, deliveryInv.invoiceId));

                if (deliveryInv.invoice?.orderId) {
                    await tx.update(order).set({
                        status: "delivered",
                        deliveredAt: new Date(),
                    }).where(eq(order.id, deliveryInv.invoice.orderId));
                }

                await tx.update(deliveryGroup).set({
                    completedInvoices: sql`${deliveryGroup.completedInvoices} + 1`,
                }).where(eq(deliveryGroup.id, deliveryInv.groupId));

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
            summary: "Mark invoice as failed",
        })
        .input(z.object({
            deliveryInvoiceId: z.number(),
            failedReason: z.string().min(1),
        }))
        .handler(async ({ input, context }) => {
            const deliveryInv = await db.query.deliveryGroupInvoice.findFirst({
                where: eq(deliveryGroupInvoice.id, input.deliveryInvoiceId),
                with: { group: true },
            });

            if (!deliveryInv) throw new ORPCError("NOT_FOUND");
            if (deliveryInv.group.deliverymanId !== context.session.user.id) throw new ORPCError("FORBIDDEN");
            if (deliveryInv.group.status !== "out_for_delivery") throw new ORPCError("BAD_REQUEST", { message: "Trip not started" });
            if (deliveryInv.status !== "pending") throw new ORPCError("BAD_REQUEST", { message: "Already processed" });

            await db.transaction(async (tx) => {
                await tx.update(deliveryGroupInvoice).set({
                    status: "failed",
                    failedReason: input.failedReason,
                }).where(eq(deliveryGroupInvoice.id, input.deliveryInvoiceId));

                await tx.update(invoice).set({ deliveryStatus: "failed" }).where(eq(invoice.id, deliveryInv.invoiceId));

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
            const groups = await db.query.deliveryGroup.findMany({
                where: eq(deliveryGroup.deliverymanId, userId),
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

            let todayDelivered = 0, todayFailed = 0, pending = 0, delivered = 0, failed = 0;
            groups.forEach(g => g.invoices.forEach(inv => {
                if (inv.status === "delivered") {
                    delivered++;
                    if (inv.deliveredAt && inv.deliveredAt >= today) todayDelivered++;
                } else if (inv.status === "failed") {
                    failed++;
                    todayFailed++; // Assuming failed today for simplicity or check failedAt if exists
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
};
