import { db } from "@bikalpo-project/db";
import { customerAssignment, estimate, estimateItem, order, orderItem, user } from "@bikalpo-project/db/schema";
import { ORPCError } from "@orpc/server";
import { and, desc, eq, inArray, notInArray, sql } from "drizzle-orm";
import { z } from "zod";

import { adminProcedure, salesmanProcedure } from "../index";
import { localDateStamp } from "../utils/date";

// Validation schemas
const salesmanIdSchema = z.object({
    id: z.string(),
});

const assignCustomersSchema = z.object({
    salesmanId: z.string(),
    customerIds: z.array(z.string()).min(1, "At least one customer required"),
});

const unassignCustomerSchema = z.object({
    salesmanId: z.string(),
    customerId: z.string(),
});

const upcomingOrdersSchema = z.object({
    limit: z.number().optional().default(50),
});

export const salesmanRouter = {
    /**
     * Get salesman stats for dashboard
     * REST: GET /salesmen/stats
     */
    getStats: salesmanProcedure
        .route({
            method: "GET",
            path: "/salesmen/stats",
            tags: ["Salesman"],
            summary: "Get salesman stats",
            description: "Get statistics for the logged-in salesman's dashboard",
        })
        .handler(async ({ context }) => {
            const userId = context.session.user.id;

            // Get current month dates
            const now = new Date();
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            // Get estimates stats
            const estimates = await db.query.estimate.findMany({
                where: eq(estimate.salesmanId, userId),
                columns: {
                    status: true,
                    total: true,
                    createdAt: true,
                },
            });

            // Calculate estimate stats
            const estimateStats = {
                total: estimates.length,
                draft: 0,
                sent: 0,
                approved: 0,
                rejected: 0,
                converted: 0,
                thisMonth: 0,
                today: 0,
                totalValue: 0,
                convertedValue: 0,
            };

            for (const est of estimates) {
                const statusKey = est.status as keyof typeof estimateStats;
                if (typeof estimateStats[statusKey] === 'number') {
                    (estimateStats[statusKey] as number)++;
                }
                estimateStats.totalValue += Number(est.total);

                if (est.status === "converted") {
                    estimateStats.convertedValue += Number(est.total);
                }

                if (est.createdAt >= startOfMonth) {
                    estimateStats.thisMonth++;
                }
                if (est.createdAt >= today) {
                    estimateStats.today++;
                }
            }

            // Calculate conversion rate
            const conversionRate =
                estimateStats.total > 0
                    ? Math.round((estimateStats.converted / estimateStats.total) * 100)
                    : 0;

            // Get recent estimates
            const recentEstimates = await db.query.estimate.findMany({
                where: eq(estimate.salesmanId, userId),
                with: {
                    customer: {
                        columns: {
                            id: true,
                            name: true,
                            shopName: true,
                        },
                    },
                },
                orderBy: [desc(estimate.createdAt)],
                limit: 5,
            });

            return {
                stats: {
                    role: "salesman" as const,
                    estimates: estimateStats,
                    conversionRate,
                    recentEstimates,
                },
            };
        }),

    /**
     * Get upcoming orders for salesman's assigned customers
     * REST: GET /salesmen/upcoming-orders
     */
    getUpcomingOrders: salesmanProcedure
        .route({
            method: "GET",
            path: "/salesmen/upcoming-orders",
            tags: ["Salesman"],
            summary: "Get upcoming orders",
            description: "Get upcoming orders from the salesman's assigned customers",
        })
        .input(upcomingOrdersSchema)
        .handler(async ({ input, context }) => {
            const userId = context.session.user.id;

            // Get assigned customer IDs
            const assignments = await db
                .select({ customerId: customerAssignment.customerId })
                .from(customerAssignment)
                .where(eq(customerAssignment.salesmanId, userId));

            const customerIds = assignments.map((a) => a.customerId);
            if (customerIds.length === 0) {
                return { orders: [] };
            }

            // Get orders with status confirmed or processing from assigned customers
            const ordersList = await db.query.order.findMany({
                where: and(
                    inArray(order.status, ["confirmed", "processing"]),
                    inArray(order.userId, customerIds)
                ),
                with: {
                    user: {
                        columns: {
                            id: true,
                            name: true,
                            shopName: true,
                            phoneNumber: true,
                        },
                    },
                },
                orderBy: [desc(order.createdAt)],
                limit: input.limit,
            });

            return { orders: ordersList };
        }),

    /**
     * Get assigned customers for the current salesman
     * REST: GET /salesmen/customers
     */
    getAssignedCustomers: salesmanProcedure
        .route({
            method: "GET",
            path: "/salesmen/customers",
            tags: ["Salesman"],
            summary: "Get assigned customers",
            description: "Get list of customers assigned to the logged-in salesman",
        })
        .handler(async ({ context }) => {
            const userId = context.session.user.id;

            // Get assigned customer IDs
            const assignments = await db
                .select({ customerId: customerAssignment.customerId })
                .from(customerAssignment)
                .where(eq(customerAssignment.salesmanId, userId));

            const customerIds = assignments.map((a) => a.customerId);

            if (customerIds.length === 0) {
                return { customers: [] };
            }

            // Get customers
            const customers = await db
                .select({
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    phoneNumber: user.phoneNumber,
                    shopName: user.shopName,
                    createdAt: user.createdAt,
                })
                .from(user)
                .where(and(eq(user.role, "customer"), inArray(user.id, customerIds)))
                .orderBy(desc(user.createdAt));

            // Get estimate counts per customer
            const estimateCounts = await db
                .select({
                    customerId: estimate.customerId,
                    count: sql<number>`count(*)`.as("count"),
                })
                .from(estimate)
                .where(inArray(estimate.customerId, customerIds))
                .groupBy(estimate.customerId);

            const estimateCountMap = new Map(
                estimateCounts.map((e) => [e.customerId, e.count]),
            );

            // Get order counts and totals per customer
            const orderStats = await db
                .select({
                    userId: order.userId,
                    orderCount: sql<number>`count(*)`.as("orderCount"),
                    totalSpent: sql<string>`COALESCE(SUM(${order.total}), 0)`.as("totalSpent"),
                    lastOrderDate: sql<Date>`MAX(${order.createdAt})`.as("lastOrderDate"),
                })
                .from(order)
                .where(inArray(order.userId, customerIds))
                .groupBy(order.userId);

            const orderStatsMap = new Map(
                orderStats.map((o) => [
                    o.userId,
                    {
                        count: o.orderCount,
                        spent: o.totalSpent || "0",
                        lastDate: o.lastOrderDate,
                    },
                ]),
            );

            // Get last estimate date per customer
            const lastEstimates = await db
                .select({
                    customerId: estimate.customerId,
                    lastDate: sql<Date>`MAX(${estimate.createdAt})`.as("lastDate"),
                })
                .from(estimate)
                .where(inArray(estimate.customerId, customerIds))
                .groupBy(estimate.customerId);

            const lastEstimateMap = new Map(
                lastEstimates.map((e) => [e.customerId, e.lastDate]),
            );

            const enrichedCustomers = customers.map((c) => {
                const orderData = orderStatsMap.get(c.id);
                const lastEstimateDate = lastEstimateMap.get(c.id);
                const lastOrderDate = orderData?.lastDate;

                // Determine last activity
                let lastActivityAt: Date | null = null;
                if (lastEstimateDate && lastOrderDate) {
                    lastActivityAt =
                        lastEstimateDate > lastOrderDate ? lastEstimateDate : lastOrderDate;
                } else {
                    lastActivityAt = lastEstimateDate || lastOrderDate || null;
                }

                return {
                    id: c.id,
                    name: c.name,
                    email: c.email,
                    phoneNumber: c.phoneNumber,
                    shopName: c.shopName,
                    totalEstimates: estimateCountMap.get(c.id) || 0,
                    totalOrders: orderData?.count || 0,
                    totalSpent: orderData?.spent || "0",
                    lastActivityAt,
                    createdAt: c.createdAt,
                };
            });

            return { customers: enrichedCustomers };
        }),

    /**
     * Get customer details with order and estimate history
     * REST: GET /salesmen/customers/:id
     */
    getCustomerDetails: salesmanProcedure
        .route({
            method: "GET",
            path: "/salesmen/customers/{id}",
            tags: ["Salesman"],
            summary: "Get customer details",
            description: "Get detailed customer information with order and estimate history",
        })
        .input(z.object({ id: z.string() }))
        .handler(async ({ context, input }) => {
            const userId = context.session.user.id;

            // Verify customer is assigned to this salesman
            const assignment = await db
                .select()
                .from(customerAssignment)
                .where(
                    and(
                        eq(customerAssignment.salesmanId, userId),
                        eq(customerAssignment.customerId, input.id),
                    ),
                )
                .limit(1);

            if (assignment.length === 0) {
                throw new ORPCError("NOT_FOUND", { message: "Customer not found or not assigned to you" });
            }

            // Get customer info
            const customerData = await db
                .select({
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    phoneNumber: user.phoneNumber,
                    shopName: user.shopName,
                    ownerName: user.ownerName,
                    createdAt: user.createdAt,
                })
                .from(user)
                .where(and(eq(user.id, input.id), eq(user.role, "customer")))
                .limit(1);

            if (customerData.length === 0) {
                throw new ORPCError("NOT_FOUND", { message: "Customer not found" });
            }

            const customerInfo = customerData[0];

            // Get customer estimates
            const customerEstimates = await db
                .select({
                    id: estimate.id,
                    estimateNumber: estimate.estimateNumber,
                    total: estimate.total,
                    status: estimate.status,
                    createdAt: estimate.createdAt,
                })
                .from(estimate)
                .where(eq(estimate.customerId, input.id))
                .orderBy(desc(estimate.createdAt));

            // Get customer orders
            const customerOrders = await db
                .select({
                    id: order.id,
                    orderNumber: order.orderNumber,
                    total: order.total,
                    status: order.status,
                    paymentStatus: order.paymentStatus,
                    createdAt: order.createdAt,
                })
                .from(order)
                .where(eq(order.userId, input.id))
                .orderBy(desc(order.createdAt));

            // Calculate stats
            const totalSpent = customerOrders.reduce(
                (sum, o) => sum + Number.parseFloat(o.total),
                0,
            );
            const pendingAmount = customerOrders
                .filter((o) => o.paymentStatus === "pending")
                .reduce((sum, o) => sum + Number.parseFloat(o.total), 0);

            return {
                customer: {
                    ...customerInfo,
                    stats: {
                        totalEstimates: customerEstimates.length,
                        totalOrders: customerOrders.length,
                        totalSpent: totalSpent.toFixed(2),
                        pendingAmount: pendingAmount.toFixed(2),
                    },
                    estimates: customerEstimates,
                    orders: customerOrders,
                },
            };
        }),

    /**
     * Get all estimates for the current salesman
     * REST: GET /salesmen/estimates
     */
    getEstimates: salesmanProcedure
        .route({
            method: "GET",
            path: "/salesmen/estimates",
            tags: ["Salesman"],
            summary: "Get salesman estimates",
            description: "Get all estimates created by the logged-in salesman",
        })
        .input(z.object({ status: z.string().optional() }))
        .handler(async ({ context, input }) => {
            const userId = context.session.user.id;

            const conditions = [eq(estimate.salesmanId, userId)];

            if (input.status) {
                conditions.push(eq(estimate.status, input.status as typeof estimate.status.enumValues[number]));
            }

            const estimates = await db.query.estimate.findMany({
                where: conditions.length > 1 ? and(...conditions) : conditions[0],
                with: {
                    items: true,
                    customer: {
                        columns: {
                            id: true,
                            name: true,
                            email: true,
                            phoneNumber: true,
                            shopName: true,
                        },
                    },
                },
                orderBy: [desc(estimate.createdAt)],
            });

            return { estimates };
        }),

    /**
     * Get estimate by ID
     * REST: GET /salesmen/estimates/:id
     */
    getEstimateById: salesmanProcedure
        .route({
            method: "GET",
            path: "/salesmen/estimates/{id}",
            tags: ["Salesman"],
            summary: "Get estimate by ID",
            description: "Get detailed estimate information by ID",
        })
        .input(z.object({ id: z.number() }))
        .handler(async ({ context, input }) => {
            const userId = context.session.user.id;

            const estimateData = await db.query.estimate.findFirst({
                where: eq(estimate.id, input.id),
                with: {
                    items: true,
                    customer: {
                        columns: {
                            id: true,
                            name: true,
                            email: true,
                            phoneNumber: true,
                            shopName: true,
                        },
                    },
                    salesman: {
                        columns: {
                            id: true,
                            name: true,
                            email: true,
                        },
                    },
                },
            });

            if (!estimateData) {
                throw new ORPCError("NOT_FOUND", { message: "Estimate not found" });
            }

            // Check permissions - salesman can only see their own
            if (estimateData.salesmanId !== userId) {
                throw new ORPCError("FORBIDDEN", { message: "Not authorized to view this estimate" });
            }

            return { estimate: estimateData };
        }),

    /**
     * Create a new estimate
     * REST: POST /salesmen/estimates
     */
    createEstimate: salesmanProcedure
        .route({
            method: "POST",
            path: "/salesmen/estimates",
            tags: ["Salesman"],
            summary: "Create estimate",
            description: "Create a new estimate for one or more customers",
        })
        .input(z.object({
            customerIds: z.array(z.string()).min(1, "At least one customer required"),
            items: z.array(z.object({
                productId: z.number(),
                productName: z.string(),
                productImage: z.string().nullable().optional(),
                quantity: z.number().min(1),
                unitPrice: z.number(),
                discount: z.number().optional().default(0),
                totalPrice: z.number(),
            })).min(1, "At least one item required"),
            discount: z.number().default(0),
            notes: z.string().nullable().optional(),
            validUntil: z.coerce.date().nullable().optional(),
        }))
        .handler(async ({ context, input }) => {
            const userId = context.session.user.id;
            const { customerIds, items, discount, notes, validUntil } = input;

            // Generate estimate number: EST-YYYYMMDD-XXXX
            const generateEstimateNumber = () => {
                const date = localDateStamp();
                const random = Math.random().toString(36).slice(2, 6).toUpperCase();
                return `EST-${date}-${random}`;
            };

            let createdCount = 0;
            const createdEstimates: number[] = [];

            await db.transaction(async (tx) => {
                for (const customerId of customerIds) {
                    // Verify customer exists
                    const customer = await tx.query.user.findFirst({
                        where: eq(user.id, customerId),
                    });

                    if (!customer) {
                        continue;
                    }

                    const estimateNumber = generateEstimateNumber();

                    // Calculate totals
                    const subtotal = items.reduce((sum, item) => sum + item.totalPrice, 0);
                    const total = subtotal - discount;

                    // Check if any price modifications require admin approval
                    const hasItemDiscounts = items.some((item) => (item.discount ?? 0) > 0);
                    const needsApproval = discount > 0 || hasItemDiscounts;
                    const status = needsApproval ? "pending" : "approved";

                    // Create estimate
                    const [newEstimate] = await tx
                        .insert(estimate)
                        .values({
                            estimateNumber,
                            customerId,
                            salesmanId: userId,
                            subtotal: subtotal.toString(),
                            discount: discount.toString(),
                            total: total.toString(),
                            status,
                            validUntil: validUntil ? validUntil.toISOString().split("T")[0] : null,
                            notes: notes || null,
                            approvedAt: status === "approved" ? new Date() : null,
                        })
                        .returning();

                    if (!newEstimate) {
                        continue;
                    }

                    // Insert items
                    const itemsToInsert = items.map((item) => ({
                        estimateId: newEstimate.id,
                        productId: item.productId,
                        productName: item.productName,
                        productImage: item.productImage || null,
                        quantity: item.quantity,
                        unitPrice: item.unitPrice.toString(),
                        discount: (item.discount || 0).toString(),
                        totalPrice: item.totalPrice.toString(),
                    }));

                    await tx.insert(estimateItem).values(itemsToInsert);
                    createdEstimates.push(newEstimate.id);
                    createdCount++;
                }
            });

            if (createdCount === 0) {
                throw new ORPCError("BAD_REQUEST", { message: "No estimates created. All specified customers were not found." });
            }

            const message = createdCount === 1
                ? "Estimate created successfully"
                : `${createdCount} estimates created successfully`;

            return { success: true, message, count: createdCount, estimateIds: createdEstimates };
        }),

    /**
     * Get order by ID
     * REST: GET /salesmen/orders/:id
     */
    getOrderById: salesmanProcedure
        .route({
            method: "GET",
            path: "/salesmen/orders/{id}",
            tags: ["Salesman"],
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
                        columns: {
                            id: true,
                            name: true,
                            email: true,
                            phoneNumber: true,
                            shopName: true,
                            ownerName: true,
                        },
                    },
                },
            });

            if (!orderData) {
                throw new ORPCError("NOT_FOUND", { message: "Order not found" });
            }

            return { order: orderData };
        }),

    /**
     * Get all salesmen with stats
     * REST: GET /salesmen
     */
    getAll: adminProcedure
        .route({
            method: "GET",
            path: "/salesmen",
            tags: ["Sales Management"],
            summary: "Get all salesmen",
            description: "Get all salesmen with estimate counts and assigned customers count",
        })
        .handler(async () => {
            const salesmenData = await db
                .select({
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    phoneNumber: user.phoneNumber,
                    createdAt: user.createdAt,
                    banned: user.banned,
                    estimatesCount: sql<number>`COALESCE((
            SELECT COUNT(*)::int FROM estimate WHERE estimate.salesman_id = "user"."id"
          ), 0)`,
                    assignedCustomersCount: sql<number>`COALESCE((
            SELECT COUNT(*)::int FROM customer_assignment WHERE customer_assignment.salesman_id = "user"."id"
          ), 0)`,
                })
                .from(user)
                .where(eq(user.role, "salesman"))
                .orderBy(user.name);

            const totalEstimates = salesmenData.reduce(
                (sum, s) => sum + (s.estimatesCount || 0),
                0
            );
            const activeCount = salesmenData.filter((s) => !s.banned).length;

            return {
                salesmen: salesmenData.map((s) => ({
                    ...s,
                    banned: s.banned || false,
                    estimatesCount: s.estimatesCount || 0,
                    assignedCustomersCount: s.assignedCustomersCount || 0,
                })),
                stats: {
                    total: salesmenData.length,
                    totalEstimates,
                    activeCount,
                },
            };
        }),

    /**
     * Get salesman by ID with assigned customers
     * REST: GET /salesmen/:id
     */
    getById: adminProcedure
        .route({
            method: "GET",
            path: "/salesmen/{id}",
            tags: ["Sales Management"],
            summary: "Get salesman by ID",
            description: "Get salesman details with their assigned customers",
        })
        .input(salesmanIdSchema)
        .handler(async ({ input }) => {
            const [salesmanData] = await db
                .select({
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    phoneNumber: user.phoneNumber,
                    createdAt: user.createdAt,
                    banned: user.banned,
                    estimatesCount: sql<number>`COALESCE((
            SELECT COUNT(*)::int FROM estimate WHERE estimate.salesman_id = "user"."id"
          ), 0)`,
                })
                .from(user)
                .where(and(eq(user.id, input.id), eq(user.role, "salesman")));

            if (!salesmanData) {
                throw new ORPCError("NOT_FOUND", { message: "Salesman not found" });
            }

            // Get assigned customers
            const assignments = await db
                .select({
                    customerId: customerAssignment.customerId,
                    assignedAt: customerAssignment.assignedAt,
                    customerName: user.name,
                    customerEmail: user.email,
                    customerPhone: user.phoneNumber,
                    customerShopName: user.shopName,
                })
                .from(customerAssignment)
                .innerJoin(user, eq(customerAssignment.customerId, user.id))
                .where(eq(customerAssignment.salesmanId, input.id))
                .orderBy(user.name);

            const assignedCustomers = assignments.map((a) => ({
                id: a.customerId,
                name: a.customerName,
                email: a.customerEmail,
                phoneNumber: a.customerPhone,
                shopName: a.customerShopName,
                assignedAt: a.assignedAt,
            }));

            return {
                salesman: {
                    ...salesmanData,
                    banned: salesmanData.banned || false,
                    estimatesCount: salesmanData.estimatesCount || 0,
                    assignedCustomers,
                    assignedCustomersCount: assignedCustomers.length,
                },
            };
        }),

    /**
     * Get customers not assigned to any salesman
     * REST: GET /salesmen/unassigned-customers
     */
    getUnassignedCustomers: adminProcedure
        .route({
            method: "GET",
            path: "/salesmen/unassigned-customers",
            tags: ["Sales Management"],
            summary: "Get unassigned customers",
            description: "Get customers not assigned to any salesman",
        })
        .handler(async () => {
            // Get customer IDs that are already assigned
            const assignedIds = await db
                .select({ customerId: customerAssignment.customerId })
                .from(customerAssignment);

            const assignedCustomerIds = assignedIds.map((a) => a.customerId);

            // Get customers not in assigned list
            const customers = await db
                .select({
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    shopName: user.shopName,
                })
                .from(user)
                .where(
                    assignedCustomerIds.length > 0
                        ? and(
                            eq(user.role, "customer"),
                            notInArray(user.id, assignedCustomerIds)
                        )
                        : eq(user.role, "customer")
                )
                .orderBy(user.name);

            return { customers };
        }),

    /**
     * Assign customers to a salesman
     * REST: POST /salesmen/assign
     */
    assignCustomers: adminProcedure
        .route({
            method: "POST",
            path: "/salesmen/assign",
            tags: ["Sales Management"],
            summary: "Assign customers",
            description: "Assign one or more customers to a salesman",
        })
        .input(assignCustomersSchema)
        .handler(async ({ input, context }) => {
            const [salesman] = await db
                .select({ warehouseId: user.warehouseId })
                .from(user)
                .where(and(eq(user.id, input.salesmanId), eq(user.role, "salesman")));

            if (!salesman?.warehouseId) {
                throw new ORPCError("NOT_FOUND", { message: "Salesman not found" });
            }
            const warehouseId = salesman.warehouseId;

            // Insert assignments
            await db.insert(customerAssignment).values(
                input.customerIds.map((customerId) => ({
                    warehouseId,
                    customerId,
                    salesmanId: input.salesmanId,
                    assignedBy: context.session.user.id,
                }))
            );

            return {
                message: `${input.customerIds.length} customer(s) assigned successfully`,
            };
        }),

    /**
     * Unassign a customer from a salesman
     * REST: DELETE /salesmen/unassign
     */
    unassignCustomer: adminProcedure
        .route({
            method: "DELETE",
            path: "/salesmen/unassign",
            tags: ["Sales Management"],
            summary: "Unassign customer",
            description: "Remove a customer assignment from a salesman",
        })
        .input(unassignCustomerSchema)
        .handler(async ({ input }) => {
            await db
                .delete(customerAssignment)
                .where(
                    and(
                        eq(customerAssignment.salesmanId, input.salesmanId),
                        eq(customerAssignment.customerId, input.customerId)
                    )
                );

            return { message: "Customer unassigned successfully" };
        }),

    /**
     * Update an existing estimate
     * REST: PUT /salesmen/estimates/:id
     */
    updateEstimate: salesmanProcedure
        .route({
            method: "PUT",
            path: "/salesmen/estimates/{id}",
            tags: ["Salesman"],
            summary: "Update estimate",
            description: "Update an existing estimate's items, discount, or metadata",
        })
        .input(z.object({
            id: z.number(),
            customerId: z.string().optional(),
            items: z.array(z.object({
                productId: z.number(),
                productName: z.string(),
                productImage: z.string().nullable().optional(),
                quantity: z.number().min(1),
                unitPrice: z.number(),
                discount: z.number().optional().default(0),
                totalPrice: z.number(),
            })).optional(),
            discount: z.number().min(0).optional(),
            validUntil: z.coerce.date().nullable().optional(),
            notes: z.string().nullable().optional(),
            status: z.enum(["draft", "pending", "sent", "approved", "rejected", "converted"]).optional(),
        }))
        .handler(async ({ context, input }) => {
            const userId = context.session.user.id;
            const userRole = context.session.user.role;

            const existingEstimate = await db.query.estimate.findFirst({
                where: eq(estimate.id, input.id),
                with: { items: true },
            });

            if (!existingEstimate) {
                throw new ORPCError("NOT_FOUND", { message: "Estimate not found" });
            }

            const isCreator = existingEstimate.salesmanId === userId;
            const isAdmin = userRole === "admin";

            if (!isCreator && !isAdmin) {
                throw new ORPCError("FORBIDDEN", { message: "Not authorized to update this estimate" });
            }

            if (existingEstimate.status === "converted") {
                throw new ORPCError("BAD_REQUEST", { message: "Cannot update converted estimates" });
            }

            const updateData: Record<string, unknown> = {};

            if (input.customerId) updateData.customerId = input.customerId;
            if (input.validUntil !== undefined) updateData.validUntil = input.validUntil;
            if (input.notes !== undefined) updateData.notes = input.notes;
            if (input.status) {
                updateData.status = input.status;
                if (input.status === "sent" && existingEstimate.status !== "sent") {
                    updateData.sentAt = new Date();
                }
            }

            if (input.items && input.items.length > 0) {
                const subtotal = input.items.reduce((sum, item) => sum + item.totalPrice, 0);
                const finalDiscount = input.discount ?? Number(existingEstimate.discount);
                const total = subtotal - finalDiscount;

                updateData.subtotal = subtotal.toString();
                updateData.discount = finalDiscount.toString();
                updateData.total = total.toString();

                await db.transaction(async (tx) => {
                    await tx.update(estimate).set(updateData).where(eq(estimate.id, input.id));
                    await tx.delete(estimateItem).where(eq(estimateItem.estimateId, input.id));

                    const itemsToInsert = input.items!.map((item) => ({
                        estimateId: input.id,
                        productId: item.productId,
                        productName: item.productName,
                        productImage: item.productImage || null,
                        quantity: item.quantity,
                        unitPrice: item.unitPrice.toString(),
                        discount: (item.discount || 0).toString(),
                        totalPrice: item.totalPrice.toString(),
                    }));

                    await tx.insert(estimateItem).values(itemsToInsert);
                });
            } else if (input.discount !== undefined) {
                const subtotal = Number(existingEstimate.subtotal);
                const total = subtotal - input.discount;
                updateData.discount = input.discount.toString();
                updateData.total = total.toString();
                await db.update(estimate).set(updateData).where(eq(estimate.id, input.id));
            } else if (Object.keys(updateData).length > 0) {
                await db.update(estimate).set(updateData).where(eq(estimate.id, input.id));
            }

            return { success: true };
        }),

    /**
     * Send a draft estimate (transitions to sent or pending)
     * REST: POST /salesmen/estimates/:id/send
     */
    sendEstimate: salesmanProcedure
        .route({
            method: "POST",
            path: "/salesmen/estimates/{id}/send",
            tags: ["Salesman"],
            summary: "Send estimate",
            description: "Send a draft estimate to the customer",
        })
        .input(z.object({ id: z.number() }))
        .handler(async ({ context, input }) => {
            const userId = context.session.user.id;
            const userRole = context.session.user.role;

            const existingEstimate = await db.query.estimate.findFirst({
                where: eq(estimate.id, input.id),
            });

            if (!existingEstimate) {
                throw new ORPCError("NOT_FOUND", { message: "Estimate not found" });
            }

            if (existingEstimate.salesmanId !== userId && userRole !== "admin") {
                throw new ORPCError("FORBIDDEN", { message: "Not authorized" });
            }

            if (existingEstimate.status !== "draft") {
                throw new ORPCError("BAD_REQUEST", { message: "Only draft estimates can be sent" });
            }

            const discount = Number(existingEstimate.discount || 0);
            const hasDiscount = discount > 0;
            const newStatus = hasDiscount ? "pending" : "sent";

            const updateData: Record<string, unknown> = { status: newStatus };
            if (newStatus === "sent") {
                updateData.sentAt = new Date();
            }

            await db.update(estimate).set(updateData).where(eq(estimate.id, input.id));

            return { success: true };
        }),

    /**
     * Delete an estimate
     * REST: DELETE /salesmen/estimates/:id
     */
    deleteEstimate: salesmanProcedure
        .route({
            method: "DELETE",
            path: "/salesmen/estimates/{id}",
            tags: ["Salesman"],
            summary: "Delete estimate",
            description: "Delete an estimate that hasn't been converted",
        })
        .input(z.object({ id: z.number() }))
        .handler(async ({ context, input }) => {
            const userId = context.session.user.id;
            const userRole = context.session.user.role;

            const existingEstimate = await db.query.estimate.findFirst({
                where: eq(estimate.id, input.id),
            });

            if (!existingEstimate) {
                throw new ORPCError("NOT_FOUND", { message: "Estimate not found" });
            }

            if (existingEstimate.salesmanId !== userId && userRole !== "admin") {
                throw new ORPCError("FORBIDDEN", { message: "Not authorized" });
            }

            if (existingEstimate.status === "converted") {
                throw new ORPCError("BAD_REQUEST", { message: "Cannot delete converted estimates" });
            }

            await db.delete(estimate).where(eq(estimate.id, input.id));

            return { success: true };
        }),

    /**
     * Convert an estimate to an order
     * REST: POST /salesmen/estimates/:id/convert
     */
    convertEstimateToOrder: salesmanProcedure
        .route({
            method: "POST",
            path: "/salesmen/estimates/{id}/convert",
            tags: ["Salesman"],
            summary: "Convert estimate to order",
            description: "Convert a sent/approved estimate into an order with stock deduction",
        })
        .input(z.object({
            id: z.number(),
            shippingName: z.string().min(1),
            shippingPhone: z.string().min(1),
            shippingAddress: z.string().min(1),
            shippingCity: z.string().min(1),
            shippingArea: z.string().optional().nullable(),
            shippingPostalCode: z.string().optional().nullable(),
            customerNote: z.string().optional().nullable(),
        }))
        .handler(async ({ context, input }) => {
            const userRole = context.session.user.role;

            if (userRole !== "admin" && userRole !== "salesman" && userRole !== "customer") {
                throw new ORPCError("FORBIDDEN", { message: "Unauthorized" });
            }

            const estimateData = await db.query.estimate.findFirst({
                where: eq(estimate.id, input.id),
                with: { items: true },
            });

            if (!estimateData) {
                throw new ORPCError("NOT_FOUND", { message: "Estimate not found" });
            }

            if (userRole === "customer" && estimateData.customerId !== context.session.user.id) {
                throw new ORPCError("FORBIDDEN", { message: "You do not own this estimate" });
            }

            // Check if customer has an active order
            const activeOrder = await db.query.order.findFirst({
                where: sql`${order.userId} = ${estimateData.customerId} 
                    AND ${order.status} NOT IN ('delivered', 'cancelled')`,
            });

            if (activeOrder) {
                throw new ORPCError("BAD_REQUEST", {
                    message: "Customer already has an active order. Please wait until it's delivered or cancelled.",
                });
            }

            if (estimateData.status === "converted") {
                throw new ORPCError("BAD_REQUEST", { message: "Estimate has already been converted" });
            }

            if (estimateData.status !== "approved" && estimateData.status !== "sent") {
                throw new ORPCError("BAD_REQUEST", {
                    message: `Only sent or approved estimates can be converted. Current status: ${estimateData.status}`,
                });
            }

            // Generate order number
            const orderNumber = `ORD-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

            const result = await db.transaction(async (tx) => {
                const [newOrder] = await tx
                    .insert(order)
                    .values({
                        orderNumber,
                        userId: estimateData.customerId,
                        orderSource: "estimate",
                        subtotal: estimateData.subtotal,
                        discount: estimateData.discount,
                        total: estimateData.total,
                        shippingCost: "0",
                        status: "pending",
                        paymentStatus: "pending",
                        paymentMethod: "cash_on_delivery",
                        shippingName: input.shippingName,
                        shippingPhone: input.shippingPhone,
                        shippingEmail: null,
                        shippingAddress: input.shippingAddress,
                        shippingCity: input.shippingCity,
                        shippingArea: input.shippingArea || null,
                        shippingPostalCode: input.shippingPostalCode || null,
                        customerNote: input.customerNote || null,
                    })
                    .returning();

                if (!newOrder) {
                    throw new Error("Failed to create order");
                }

                // Create order items
                const orderItems = estimateData.items.map((item) => ({
                    orderId: newOrder.id,
                    productId: item.productId,
                    productName: item.productName,
                    productImage: item.productImage || "",
                    productSize: "N/A",
                    quantity: item.quantity,
                    unitPrice: item.unitPrice,
                    totalPrice: item.totalPrice,
                }));

                await tx.insert(orderItem).values(orderItems);


                // Stock deduction removed — stock is now tracked via the inventory system

                // Update estimate status
                await tx
                    .update(estimate)
                    .set({
                        status: "converted",
                        convertedOrderId: newOrder.id,
                        convertedAt: new Date(),
                    })
                    .where(eq(estimate.id, input.id));

                return newOrder;
            });

            return { success: true, order: result };
        }),
};

