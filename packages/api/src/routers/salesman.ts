import { db } from "@bikalpo-project/db";
import { customerAssignment, user } from "@bikalpo-project/db/schema";
import { ORPCError } from "@orpc/server";
import { and, eq, notInArray, sql } from "drizzle-orm";
import { z } from "zod";

import { adminProcedure } from "../index";

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

export const salesmanRouter = {
    /**
     * Get all salesmen with stats
     * REST: GET /salesmen
     */
    getAll: adminProcedure
        .route({
            method: "GET",
            path: "/salesmen",
            tags: ["Salesmen"],
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
            tags: ["Salesmen"],
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
            tags: ["Salesmen"],
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
            tags: ["Salesmen"],
            summary: "Assign customers",
            description: "Assign one or more customers to a salesman",
        })
        .input(assignCustomersSchema)
        .handler(async ({ input, context }) => {
            // Insert assignments
            await db.insert(customerAssignment).values(
                input.customerIds.map((customerId) => ({
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
            tags: ["Salesmen"],
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
};
