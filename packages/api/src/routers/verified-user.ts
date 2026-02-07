import { db } from "@bikalpo-project/db";
import { order, productReview, user } from "@bikalpo-project/db/schema";
import { and, count, desc, eq, sql, sum } from "drizzle-orm";
import { z } from "zod";

import { publicProcedure } from "../index";

// Input schemas
const listParamsSchema = z.object({
    search: z.string().optional(),
    area: z.string().optional(),
    sortBy: z.enum(["top_buyers", "most_orders", "newest"]).default("top_buyers"),
    page: z.number().min(1).default(1),
    limit: z.number().min(1).max(50).default(12),
});

export const verifiedUserRouter = {
    /**
     * Get verified users (public endpoint for customer showcase)
     * REST: GET /verified-users
     */
    getList: publicProcedure
        .route({
            method: "GET",
            path: "/verified-users",
            tags: ["Verified Users"],
            summary: "Get verified users",
            description: "Get paginated list of verified customers for public display",
        })
        .input(listParamsSchema)
        .handler(async ({ input }) => {
            const { search, area, sortBy, page, limit } = input;
            const offset = (page - 1) * limit;

            // Build conditions for verified users
            const conditions = [eq(user.role, "customer"), eq(user.banned, false)];

            if (search) {
                const searchTerm = `%${search.toLowerCase()}%`;
                conditions.push(
                    sql`(
            LOWER(${user.name}) ILIKE ${searchTerm} OR 
            LOWER(COALESCE(${user.shopName}, '')) ILIKE ${searchTerm} OR 
            LOWER(COALESCE(${user.ownerName}, '')) ILIKE ${searchTerm}
          )`,
                );
            }

            // Get base users
            const baseUsers = await db
                .select({
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    shopName: user.shopName,
                    ownerName: user.ownerName,
                    image: user.image,
                    createdAt: user.createdAt,
                })
                .from(user)
                .where(and(...conditions));

            // Get details for each user
            const usersWithDetails = await Promise.all(
                baseUsers.map(async (u) => {
                    // Get order stats
                    const orderStats = await db
                        .select({
                            orderCount: count(order.id),
                            totalSpend: sum(order.total),
                            area: sql<string>`MODE() WITHIN GROUP (ORDER BY ${order.shippingArea})`,
                        })
                        .from(order)
                        .where(eq(order.userId, u.id))
                        .groupBy(order.userId);

                    // Get reviews (limit 2)
                    const reviews = await db
                        .select({
                            id: productReview.id,
                            comment: productReview.comment,
                            rating: productReview.rating,
                        })
                        .from(productReview)
                        .where(eq(productReview.userId, u.id))
                        .orderBy(desc(productReview.createdAt))
                        .limit(2);

                    const stats = orderStats[0];

                    return {
                        ...u,
                        area: stats?.area || null,
                        totalOrders: Number(stats?.orderCount) || 0,
                        totalSpend: Number(stats?.totalSpend) || 0,
                        reviews,
                    };
                }),
            );

            // Filter by area if specified
            let filteredUsers = usersWithDetails;
            if (area && area !== "all") {
                filteredUsers = usersWithDetails.filter((u) =>
                    u.area?.toLowerCase().includes(area.toLowerCase()),
                );
            }

            // Sort users
            const sortedUsers = [...filteredUsers].sort((a, b) => {
                switch (sortBy) {
                    case "most_orders":
                        return b.totalOrders - a.totalOrders;
                    case "newest":
                        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
                    case "top_buyers":
                    default:
                        return b.totalOrders - a.totalOrders;
                }
            });

            // Paginate
            const paginatedUsers = sortedUsers.slice(offset, offset + limit);

            // Get unique areas
            const uniqueAreas = [
                ...new Set(usersWithDetails.map((u) => u.area).filter((a): a is string => !!a)),
            ].sort();

            return {
                users: paginatedUsers,
                totalCount: sortedUsers.length,
                totalPages: Math.ceil(sortedUsers.length / limit),
                currentPage: page,
                areas: uniqueAreas,
            };
        }),

    /**
     * Get verified users for home page (top 3)
     * REST: GET /verified-users/home
     */
    getForHome: publicProcedure
        .route({
            method: "GET",
            path: "/verified-users/home",
            tags: ["Verified Users"],
            summary: "Get verified users for home",
            description: "Get top 3 verified users for home page display",
        })
        .handler(async () => {
            // Get top 3 customers
            const conditions = [eq(user.role, "customer"), eq(user.banned, false)];

            const baseUsers = await db
                .select({
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    shopName: user.shopName,
                    ownerName: user.ownerName,
                    image: user.image,
                    createdAt: user.createdAt,
                })
                .from(user)
                .where(and(...conditions));

            const usersWithOrders = await Promise.all(
                baseUsers.map(async (u) => {
                    const orderStats = await db
                        .select({
                            orderCount: count(order.id),
                            totalSpend: sum(order.total),
                            area: sql<string>`MODE() WITHIN GROUP (ORDER BY ${order.shippingArea})`,
                        })
                        .from(order)
                        .where(eq(order.userId, u.id))
                        .groupBy(order.userId);

                    const reviews = await db
                        .select({
                            id: productReview.id,
                            comment: productReview.comment,
                            rating: productReview.rating,
                        })
                        .from(productReview)
                        .where(eq(productReview.userId, u.id))
                        .orderBy(desc(productReview.createdAt))
                        .limit(2);

                    const stats = orderStats[0];

                    return {
                        ...u,
                        area: stats?.area || null,
                        totalOrders: Number(stats?.orderCount) || 0,
                        totalSpend: Number(stats?.totalSpend) || 0,
                        reviews,
                    };
                }),
            );

            // Sort by orders and take top 3
            const topUsers = usersWithOrders
                .sort((a, b) => b.totalOrders - a.totalOrders)
                .slice(0, 3);

            return { users: topUsers };
        }),

    /**
     * Get count of verified users
     * REST: GET /verified-users/count
     */
    getCount: publicProcedure
        .route({
            method: "GET",
            path: "/verified-users/count",
            tags: ["Verified Users"],
            summary: "Get verified users count",
            description: "Get total count of verified customers",
        })
        .handler(async () => {
            const [result] = await db
                .select({ count: count() })
                .from(user)
                .where(and(eq(user.role, "customer"), eq(user.banned, false)));

            return { count: Number(result?.count) || 0 };
        }),
};
