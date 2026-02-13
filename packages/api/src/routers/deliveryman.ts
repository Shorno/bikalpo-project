import { db } from "@bikalpo-project/db";
import { deliveryGroup, deliveryGroupInvoice, deliveryRule, invoice, user, order, orderReturn } from "@bikalpo-project/db/schema";
import { ORPCError } from "@orpc/server";
import { and, asc, count, desc, eq, inArray, sql, type SQL } from "drizzle-orm";
import { z } from "zod";

import { adminProcedure, deliverymanProcedure, protectedProcedure } from "../index";

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

    /**
     * Get unassigned invoices (admin) for creating delivery groups
     */
    getUnassignedInvoices: adminProcedure
        .route({
            method: "GET",
            path: "/delivery/invoices/unassigned",
            tags: ["Delivery Management"],
            summary: "Get unassigned invoices",
        })
        .handler(async () => {
            const invoices = await db.query.invoice.findMany({
                where: eq(invoice.deliveryStatus, "not_assigned"),
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
                            shippingAddress: true,
                            shippingCity: true,
                            shippingArea: true,
                        },
                    },
                },
                orderBy: [desc(invoice.createdAt)],
            });

            return { invoices };
        }),

    /**
     * Alias: get deliverymen for assignment (for create-group dialog compatibility)
     */
    getForAssignment: adminProcedure
        .route({
            method: "GET",
            path: "/delivery/for-assignment",
            tags: ["Delivery Management"],
            summary: "Get deliverymen for assignment",
        })
        .input(z.object({ orderShippingArea: z.string().nullable().optional() }).optional())
        .handler(async ({ input }) => {
            const activeGroups = await db
                .select({ deliverymanId: deliveryGroup.deliverymanId })
                .from(deliveryGroup)
                .where(sql`${deliveryGroup.status} IN ('assigned', 'out_for_delivery', 'partial')`);
            const busyDeliverymen = [...new Set(activeGroups.map((g) => g.deliverymanId))];

            const area = input?.orderShippingArea?.trim();
            const conditions: SQL[] = [eq(user.role, "deliveryman")];

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
    createGroup: adminProcedure
        .route({
            method: "POST",
            path: "/delivery-groups/create",
            tags: ["Delivery Management"],
            summary: "Create delivery group",
        })
        .input(z.object({
            groupName: z.string().min(1),
            invoiceIds: z.array(z.number()).min(1),
            deliverymanId: z.string().min(1),
            notes: z.string().optional(),
            vehicleType: z.enum(["bike", "car", "van", "truck"]).optional(),
            expectedDeliveryAt: z.string().optional(),
        }))
        .handler(async ({ input }) => {
            const deliveryman = await db.query.user.findFirst({
                where: and(eq(user.id, input.deliverymanId), eq(user.role, "deliveryman")),
                columns: { id: true },
            });
            if (!deliveryman) {
                throw new ORPCError("NOT_FOUND", { message: "Deliveryman not found" });
            }

            const selectedInvoices = await db.query.invoice.findMany({
                where: inArray(invoice.id, input.invoiceIds),
                columns: { id: true, deliveryStatus: true },
            });
            if (selectedInvoices.length !== input.invoiceIds.length) {
                throw new ORPCError("BAD_REQUEST", { message: "Some selected invoices were not found" });
            }

            const invalidInvoice = selectedInvoices.find(
                (inv) => inv.deliveryStatus !== "not_assigned" && inv.deliveryStatus !== "pending",
            );
            if (invalidInvoice) {
                throw new ORPCError("BAD_REQUEST", {
                    message: "One or more invoices are already assigned or delivered",
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
                        deliverymanId: input.deliverymanId,
                        status: "assigned",
                        totalInvoices: input.invoiceIds.length,
                        completedInvoices: 0,
                        notes: input.notes ?? null,
                        vehicleType: input.vehicleType ?? null,
                        expectedDeliveryAt: expectedDeliveryDate,
                        assignedAt: new Date(),
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
                        deliverymanId: input.deliverymanId,
                        vehicleType: input.vehicleType ?? null,
                        expectedDeliveryAt: expectedDeliveryDate,
                    })
                    .where(inArray(invoice.id, input.invoiceIds));

                return group;
            });

            return { success: true, group: createdGroup };
        }),

    /**
     * Alias: get delivery groups (for create-group dialog compatibility)
     */
    getGroups: adminProcedure
        .route({
            method: "GET",
            path: "/delivery-groups/list",
            tags: ["Delivery Management"],
            summary: "Get delivery groups",
        })
        .input(z.object({ status: z.string().optional() }).optional())
        .handler(async ({ input }) => {
            const conditions = input?.status
                ? eq(deliveryGroup.status, input.status as typeof deliveryGroup.$inferSelect.status)
                : undefined;

            const groups = await db.query.deliveryGroup.findMany({
                where: conditions,
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
    getDeliveryGroups: adminProcedure
        .route({
            method: "GET",
            path: "/delivery-groups",
            tags: ["Delivery Management"],
            summary: "Get all delivery groups",
        })
        .input(z.object({ status: z.string().optional() }).optional())
        .handler(async ({ input }) => {
            const conditions = input?.status
                ? eq(deliveryGroup.status, input.status as typeof deliveryGroup.$inferSelect.status)
                : undefined;

            const groups = await db.query.deliveryGroup.findMany({
                where: conditions,
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
    getGroupById: adminProcedure
        .route({
            method: "GET",
            path: "/delivery-groups/{id}",
            tags: ["Delivery Management"],
            summary: "Get delivery group by ID",
        })
        .input(z.object({ id: z.number() }))
        .handler(async ({ input }) => {
            const group = await db.query.deliveryGroup.findFirst({
                where: eq(deliveryGroup.id, input.id),
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
    assignDeliveryman: adminProcedure
        .route({
            method: "POST",
            path: "/delivery-groups/{groupId}/assign",
            tags: ["Delivery Management"],
            summary: "Assign deliveryman to delivery group",
        })
        .input(z.object({
            groupId: z.number(),
            deliverymanId: z.string(),
            vehicleType: z.string().optional(),
            expectedDeliveryAt: z.string().optional(),
        }))
        .handler(async ({ input }) => {
            // Verify deliveryman exists and has correct role
            const deliveryman = await db.query.user.findFirst({
                where: eq(user.id, input.deliverymanId),
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

            return { success: true };
        }),

    /**
     * Get deliverymen available for assignment (admin)
     */
    getDeliverymenForAssignment: adminProcedure
        .route({
            method: "GET",
            path: "/deliverymen-for-assignment",
            tags: ["Delivery Management"],
            summary: "Get deliverymen available for assignment",
        })
        .input(z.object({ orderShippingArea: z.string().nullable().optional() }).optional())
        .handler(async ({ input }) => {
            // Get deliverymen who already have active groups

            const activeGroups = await db
                .select({ deliverymanId: deliveryGroup.deliverymanId })
                .from(deliveryGroup)
                .where(sql`${deliveryGroup.status} IN ('assigned', 'out_for_delivery', 'partial')`);
            const busyDeliverymen = [...new Set(activeGroups.map((g) => g.deliverymanId))];

            const area = input?.orderShippingArea?.trim();

            // Build conditions: role + area filter
            const conditions: SQL[] = [eq(user.role, "deliveryman")];

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
    deleteGroup: adminProcedure
        .route({
            method: "POST",
            path: "/delivery-groups/{id}/delete",
            tags: ["Delivery Management"],
            summary: "Delete delivery group",
        })
        .input(z.object({ id: z.number() }))
        .handler(async ({ input }) => {
            const group = await db.query.deliveryGroup.findFirst({
                where: eq(deliveryGroup.id, input.id),
            });

            if (!group) {
                throw new ORPCError("NOT_FOUND", { message: "Delivery group not found" });
            }

            if (group.status === "completed") {
                throw new ORPCError("BAD_REQUEST", { message: "Cannot delete completed delivery groups" });
            }

            await db.delete(deliveryGroup).where(eq(deliveryGroup.id, input.id));

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
        .input(z.object({ orderId: z.number() }))
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
                return { otp: null, showOtp: false };
            }

            // Find delivery group invoice for any of these invoices
            const invoiceIds = orderInvoices.map((inv) => inv.id);
            const deliveryInvoice = await db.query.deliveryGroupInvoice.findFirst({
                where: sql`${deliveryGroupInvoice.invoiceId} IN (${sql.join(
                    invoiceIds.map((id) => sql`${id}`),
                    sql`, `,
                )})`,
                with: {
                    group: true,
                },
            });

            // Only show OTP if order is out for delivery
            if (
                !deliveryInvoice ||
                !deliveryInvoice.group ||
                deliveryInvoice.group.status !== "out_for_delivery"
            ) {
                return { otp: null, showOtp: false };
            }

            return {
                otp: deliveryInvoice.deliveryOtp,
                showOtp: true,
                deliveryStatus: deliveryInvoice.status,
            };
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

