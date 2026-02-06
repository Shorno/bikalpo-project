"use server";

import { and, count, desc, eq, sql, sum } from "drizzle-orm";
import { db } from "@/db/config";
import { user } from "@/db/schema/auth-schema";
import { order } from "@/db/schema/order";
import { productReview } from "@/db/schema/review";

export type VerifiedUserReview = {
  id: number;
  comment: string;
  rating: number;
};

export type VerifiedUser = {
  id: string;
  name: string;
  email: string;
  shopName: string | null;
  ownerName: string | null;
  image: string | null;
  createdAt: Date;
  area: string | null;
  totalOrders: number;
  totalSpend: number;
  reviews: VerifiedUserReview[];
};

export type GetVerifiedUsersParams = {
  search?: string;
  area?: string;
  sortBy?: "top_buyers" | "most_orders" | "newest";
  page?: number;
  limit?: number;
};

export async function getVerifiedUsers(params?: GetVerifiedUsersParams) {
  try {
    const page = params?.page || 1;
    const limit = params?.limit || 12;
    const offset = (page - 1) * limit;

    // Get verified users (users with role 'customer' and not banned)
    const verifiedUsersQuery = db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        shopName: user.shopName,
        ownerName: user.ownerName,
        image: user.image,
        createdAt: user.createdAt,
      })
      .from(user);

    // Build where conditions
    const conditions = [eq(user.role, "customer"), eq(user.banned, false)];

    // Apply search filter if provided
    if (params?.search) {
      const searchTerm = `%${params.search.toLowerCase()}%`;
      conditions.push(
        sql`(
          LOWER(${user.name}) ILIKE ${searchTerm} OR 
          LOWER(COALESCE(${user.shopName}, '')) ILIKE ${searchTerm} OR 
          LOWER(COALESCE(${user.ownerName}, '')) ILIKE ${searchTerm}
        )`,
      );
    }

    const baseUsers = await verifiedUsersQuery.where(and(...conditions));

    // For each user, get their order count, area, and reviews
    const usersWithDetails = await Promise.all(
      baseUsers.map(async (u) => {
        // Get order count, total spend, and most common area
        const orderStats = await db
          .select({
            orderCount: count(order.id),
            totalSpend: sum(order.total),
            area: sql<string>`MODE() WITHIN GROUP (ORDER BY ${order.shippingArea})`,
          })
          .from(order)
          .where(eq(order.userId, u.id))
          .groupBy(order.userId);

        // Get reviews given by this user (limit 2)
        const userReviews = await db
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
          reviews: userReviews,
        };
      }),
    );

    // Filter by area if specified
    let filteredUsers = usersWithDetails;
    if (params?.area && params.area !== "all") {
      filteredUsers = usersWithDetails.filter((u) =>
        u.area?.toLowerCase().includes(params.area!.toLowerCase()),
      );
    }

    // Sort users
    const sortedUsers = [...filteredUsers].sort((a, b) => {
      switch (params?.sortBy) {
        case "most_orders":
          return b.totalOrders - a.totalOrders;
        case "newest":
          return (
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
        case "top_buyers":
        default:
          return b.totalOrders - a.totalOrders;
      }
    });

    // Paginate
    const paginatedUsers = sortedUsers.slice(offset, offset + limit);

    // Get unique areas for filter options
    const uniqueAreas = [
      ...new Set(
        usersWithDetails.map((u) => u.area).filter((a): a is string => !!a),
      ),
    ].sort();

    return {
      success: true,
      data: {
        users: paginatedUsers as VerifiedUser[],
        totalCount: sortedUsers.length,
        totalPages: Math.ceil(sortedUsers.length / limit),
        currentPage: page,
        areas: uniqueAreas,
      },
    };
  } catch (error) {
    console.error("Error fetching verified users:", error);
    return {
      success: false,
      error: "Failed to fetch verified users",
      data: {
        users: [],
        totalCount: 0,
        totalPages: 0,
        currentPage: 1,
        areas: [],
      },
    };
  }
}

export async function getVerifiedUsersForHome() {
  // Get 3 verified users for home page
  const result = await getVerifiedUsers({ limit: 3, sortBy: "top_buyers" });
  return {
    success: result.success,
    data: result.data?.users || [],
  };
}

export async function getVerifiedUsersCount() {
  try {
    const [result] = await db
      .select({ count: count() })
      .from(user)
      .where(and(eq(user.role, "customer"), eq(user.banned, false)));

    return {
      success: true,
      count: Number(result?.count) || 0,
    };
  } catch (error) {
    console.error("Error fetching verified users count:", error);
    return {
      success: false,
      count: 0,
    };
  }
}
