import { auth } from "@bikalpo-project/auth";
import { db } from "@bikalpo-project/db";
import { user, deliveryGroup, deliveryGroupInvoice, invoice, customerAssignment } from "@bikalpo-project/db/schema";
import { ORPCError } from "@orpc/server";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";

import { warehouseProcedure } from "../index";

// ────────────────────────────────────────────────────────────────
// Schemas
// ────────────────────────────────────────────────────────────────

const employeeRoleSchema = z.enum(["salesman", "deliveryman"]);

const createEmployeeSchema = z.object({
    name: z.string().min(2).max(100).trim(),
    email: z.string().email().trim(),
    password: z.string().min(8).max(100),
    phoneNumber: z.string().max(20).optional(),
    role: employeeRoleSchema,
});

const updateEmployeeSchema = z.object({
    id: z.string(),
    name: z.string().min(2).max(100).trim().optional(),
    phoneNumber: z.string().max(20).optional(),
});

const resetPasswordSchema = z.object({
    userId: z.string(),
    newPassword: z.string().min(8).max(100),
});

const toggleBanSchema = z.object({
    userId: z.string(),
    banned: z.boolean(),
    reason: z.string().optional(),
});

const deleteEmployeeSchema = z.object({
    id: z.string(),
});

// ────────────────────────────────────────────────────────────────
// Router
// ────────────────────────────────────────────────────────────────

export const warehouseEmployeeRouter = {
    /**
     * Get all employees (both salesmen and deliverymen) for this warehouse
     */
    getAll: warehouseProcedure
        .route({
            method: "GET",
            path: "/warehouse/employees",
            tags: ["Warehouse Employee Management"],
            summary: "Get all warehouse employees",
            description: "Get all salesmen and deliverymen belonging to this warehouse",
        })
        .handler(async ({ context }) => {
            const warehouseId = context.session.user.id;

            const employees = await db
                .select({
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    phoneNumber: user.phoneNumber,
                    role: user.role,
                    createdAt: user.createdAt,
                    banned: user.banned,
                })
                .from(user)
                .where(
                    and(
                        eq(user.warehouseId, warehouseId),
                        inArray(user.role, ["deliveryman", "salesman"]),
                    ),
                )
                .orderBy(user.name);

            const stats = {
                total: employees.length,
                deliverymen: employees.filter((e) => e.role === "deliveryman").length,
                salesmen: employees.filter((e) => e.role === "salesman").length,
                active: employees.filter((e) => !e.banned).length,
            };

            return {
                employees: employees.map((e) => ({
                    ...e,
                    role: e.role || "unknown",
                    banned: e.banned || false,
                })),
                stats,
            };
        }),

    /**
     * Get salesmen for this warehouse with estimate and customer counts
     */
    getSalesmen: warehouseProcedure
        .route({
            method: "GET",
            path: "/warehouse/employees/salesmen",
            tags: ["Warehouse Employee Management"],
            summary: "Get warehouse salesmen",
            description: "Get all salesmen belonging to this warehouse with stats",
        })
        .handler(async ({ context }) => {
            const warehouseId = context.session.user.id;

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
                .where(
                    and(
                        eq(user.warehouseId, warehouseId),
                        eq(user.role, "salesman"),
                    ),
                )
                .orderBy(user.name);

            const totalEstimates = salesmenData.reduce(
                (sum, s) => sum + (s.estimatesCount || 0),
                0,
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
     * Get deliverymen for this warehouse with delivery counts
     */
    getDeliverymen: warehouseProcedure
        .route({
            method: "GET",
            path: "/warehouse/employees/deliverymen",
            tags: ["Warehouse Employee Management"],
            summary: "Get warehouse deliverymen",
            description: "Get all deliverymen belonging to this warehouse with stats",
        })
        .handler(async ({ context }) => {
            const warehouseId = context.session.user.id;

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
                .where(
                    and(
                        eq(user.warehouseId, warehouseId),
                        eq(user.role, "deliveryman"),
                    ),
                )
                .orderBy(user.name);

            const totalDeliveries = deliverymenData.reduce(
                (sum, d) => sum + (d.deliveriesCount || 0),
                0,
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
     * Get deliveryman detail by ID (scoped to warehouse)
     */
    getDeliverymanById: warehouseProcedure
        .route({
            method: "GET",
            path: "/warehouse/employees/deliveryman/{id}",
            tags: ["Warehouse Employee Management"],
            summary: "Get deliveryman by ID",
            description: "Get deliveryman details with delivery history",
        })
        .input(z.object({ id: z.string() }))
        .handler(async ({ input, context }) => {
            const warehouseId = context.session.user.id;

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
                .where(
                    and(
                        eq(user.id, input.id),
                        eq(user.warehouseId, warehouseId),
                        eq(user.role, "deliveryman"),
                    ),
                );

            if (!deliverymanData) {
                throw new ORPCError("NOT_FOUND", { message: "Deliveryman not found" });
            }

            // Get delivery groups
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
                }),
            );

            const activeStatuses = ["assigned", "out_for_delivery", "partial"];
            const activeGroup = groupsWithDetails.find((g) => activeStatuses.includes(g.status)) || null;
            const deliveryHistory = groupsWithDetails.filter((g) => !activeStatuses.includes(g.status));

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
     * Get salesman detail by ID (scoped to warehouse)
     */
    getSalesmanById: warehouseProcedure
        .route({
            method: "GET",
            path: "/warehouse/employees/salesman/{id}",
            tags: ["Warehouse Employee Management"],
            summary: "Get salesman by ID",
            description: "Get salesman details with assigned customers",
        })
        .input(z.object({ id: z.string() }))
        .handler(async ({ input, context }) => {
            const warehouseId = context.session.user.id;

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
                .where(
                    and(
                        eq(user.id, input.id),
                        eq(user.warehouseId, warehouseId),
                        eq(user.role, "salesman"),
                    ),
                );

            if (!salesmanData) {
                throw new ORPCError("NOT_FOUND", { message: "Salesman not found" });
            }

            // Get assigned customers
            const assignedCustomers = await db
                .select({
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    phoneNumber: user.phoneNumber,
                    shopName: user.shopName,
                    assignedAt: customerAssignment.assignedAt,
                })
                .from(customerAssignment)
                .innerJoin(user, eq(customerAssignment.customerId, user.id))
                .where(eq(customerAssignment.salesmanId, input.id))
                .orderBy(desc(customerAssignment.assignedAt));

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
     * Create a new warehouse employee (salesman or deliveryman)
     */
    create: warehouseProcedure
        .route({
            method: "POST",
            path: "/warehouse/employees",
            tags: ["Warehouse Employee Management"],
            summary: "Create warehouse employee",
            description: "Create a new salesman or deliveryman for this warehouse",
        })
        .input(createEmployeeSchema)
        .handler(async ({ input, context }) => {
            const warehouseId = context.session.user.id;

            // Create user via Better Auth admin API
            const newUser = await auth.api.createUser({
                body: {
                    email: input.email,
                    password: input.password,
                    name: input.name,
                    role: input.role,
                    data: {
                        phoneNumber: input.phoneNumber || null,
                    },
                },
            });

            if (!newUser?.user) {
                throw new ORPCError("INTERNAL_SERVER_ERROR", {
                    message: "Failed to create employee",
                });
            }

            // Link the employee to this warehouse
            await db
                .update(user)
                .set({ warehouseId })
                .where(eq(user.id, newUser.user.id));

            return {
                message: "Employee created successfully",
                employee: {
                    id: newUser.user.id,
                    name: newUser.user.name,
                    email: newUser.user.email,
                    phoneNumber:
                        (newUser.user as { phoneNumber?: string | null }).phoneNumber ||
                        null,
                    role: input.role,
                    createdAt: newUser.user.createdAt,
                    banned: false,
                },
            };
        }),

    /**
     * Update warehouse employee details
     */
    update: warehouseProcedure
        .route({
            method: "PUT",
            path: "/warehouse/employees/{id}",
            tags: ["Warehouse Employee Management"],
            summary: "Update warehouse employee",
            description: "Update employee name and phone number",
        })
        .input(updateEmployeeSchema)
        .handler(async ({ input, context }) => {
            const warehouseId = context.session.user.id;

            // Verify employee belongs to this warehouse
            const [employee] = await db
                .select({ id: user.id })
                .from(user)
                .where(
                    and(
                        eq(user.id, input.id),
                        eq(user.warehouseId, warehouseId),
                    ),
                );

            if (!employee) {
                throw new ORPCError("NOT_FOUND", { message: "Employee not found" });
            }

            const updateData: Record<string, string | null> = {};
            if (input.name !== undefined) updateData.name = input.name;
            if (input.phoneNumber !== undefined)
                updateData.phoneNumber = input.phoneNumber;

            if (Object.keys(updateData).length === 0) {
                return { message: "No changes to apply" };
            }

            await db
                .update(user)
                .set(updateData)
                .where(eq(user.id, input.id));

            return { message: "Employee updated successfully" };
        }),

    /**
     * Delete a warehouse employee
     */
    delete: warehouseProcedure
        .route({
            method: "DELETE",
            path: "/warehouse/employees/{id}",
            tags: ["Warehouse Employee Management"],
            summary: "Delete warehouse employee",
            description: "Permanently delete a warehouse employee",
        })
        .input(deleteEmployeeSchema)
        .handler(async ({ input, context }) => {
            const warehouseId = context.session.user.id;

            // Verify employee belongs to this warehouse
            const [employee] = await db
                .select({ id: user.id })
                .from(user)
                .where(
                    and(
                        eq(user.id, input.id),
                        eq(user.warehouseId, warehouseId),
                    ),
                );

            if (!employee) {
                throw new ORPCError("NOT_FOUND", { message: "Employee not found" });
            }

            await auth.api.removeUser({
                body: { userId: input.id },
                headers: new Headers({
                    Authorization: `Bearer ${context.session.session.token}`,
                }),
            });

            return { message: "Employee deleted successfully" };
        }),

    /**
     * Reset warehouse employee password
     */
    resetPassword: warehouseProcedure
        .route({
            method: "POST",
            path: "/warehouse/employees/reset-password",
            tags: ["Warehouse Employee Management"],
            summary: "Reset employee password",
            description: "Reset a warehouse employee's password",
        })
        .input(resetPasswordSchema)
        .handler(async ({ input, context }) => {
            const warehouseId = context.session.user.id;

            // Verify employee belongs to this warehouse
            const [employee] = await db
                .select({ id: user.id })
                .from(user)
                .where(
                    and(
                        eq(user.id, input.userId),
                        eq(user.warehouseId, warehouseId),
                    ),
                );

            if (!employee) {
                throw new ORPCError("NOT_FOUND", { message: "Employee not found" });
            }

            await auth.api.setUserPassword({
                body: {
                    userId: input.userId,
                    newPassword: input.newPassword,
                },
                headers: new Headers({
                    Authorization: `Bearer ${context.session.session.token}`,
                }),
            });

            return { message: "Password reset successfully" };
        }),

    /**
     * Ban or unban a warehouse employee
     */
    toggleBan: warehouseProcedure
        .route({
            method: "POST",
            path: "/warehouse/employees/toggle-ban",
            tags: ["Warehouse Employee Management"],
            summary: "Ban or unban warehouse employee",
            description: "Toggle ban status for a warehouse employee",
        })
        .input(toggleBanSchema)
        .handler(async ({ input, context }) => {
            const warehouseId = context.session.user.id;

            // Verify employee belongs to this warehouse
            const [employee] = await db
                .select({ id: user.id })
                .from(user)
                .where(
                    and(
                        eq(user.id, input.userId),
                        eq(user.warehouseId, warehouseId),
                    ),
                );

            if (!employee) {
                throw new ORPCError("NOT_FOUND", { message: "Employee not found" });
            }

            const headers = new Headers({
                Authorization: `Bearer ${context.session.session.token}`,
            });

            if (input.banned) {
                await auth.api.banUser({
                    body: {
                        userId: input.userId,
                        banReason: input.reason || "Banned by warehouse manager",
                    },
                    headers,
                });
            } else {
                await auth.api.unbanUser({
                    body: { userId: input.userId },
                    headers,
                });
            }

            return {
                message: input.banned
                    ? "Employee banned successfully"
                    : "Employee unbanned successfully",
            };
        }),
};
