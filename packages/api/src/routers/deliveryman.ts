import { db } from "@bikalpo-project/db";
import { deliveryGroup, deliveryGroupInvoice, invoice, user } from "@bikalpo-project/db/schema";
import { ORPCError } from "@orpc/server";
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";

import { adminProcedure } from "../index";

// Validation schemas
const deliverymanIdSchema = z.object({
    id: z.string(),
});

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
};
