"use server";

import { and, count, desc, eq, ilike, or } from "drizzle-orm";
import { headers } from "next/headers";
import { db } from "@/db/config";
import { user } from "@/db/schema/auth-schema";
import {
  type ItemRequestWithRelations,
  itemRequest,
} from "@/db/schema/item-request";
import { product } from "@/db/schema/product";
import { auth } from "@/lib/auth";
import type { ItemRequestFilterValues } from "@/schema/item-request.schema";

// Get requests for the logged-in customer
export async function getCustomerItemRequests(
  filters?: ItemRequestFilterValues,
) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized", data: null };
    }

    const page = filters?.page || 1;
    const limit = filters?.limit || 10;
    const offset = (page - 1) * limit;

    // Build where conditions
    const conditions = [eq(itemRequest.customerId, session.user.id)];

    if (filters?.status && filters.status !== "all") {
      conditions.push(eq(itemRequest.status, filters.status));
    }

    if (filters?.search) {
      conditions.push(
        or(
          ilike(itemRequest.itemName, `%${filters.search}%`),
          ilike(itemRequest.requestNumber, `%${filters.search}%`),
        ) as ReturnType<typeof eq>,
      );
    }

    // Get total count
    const [countResult] = await db
      .select({ count: count() })
      .from(itemRequest)
      .where(and(...conditions));

    const totalCount = countResult?.count || 0;

    // Get requests with suggested product info
    const requests = await db
      .select({
        id: itemRequest.id,
        requestNumber: itemRequest.requestNumber,
        customerId: itemRequest.customerId,
        itemName: itemRequest.itemName,
        brand: itemRequest.brand,
        category: itemRequest.category,
        quantity: itemRequest.quantity,
        description: itemRequest.description,
        image: itemRequest.image,
        status: itemRequest.status,
        adminResponse: itemRequest.adminResponse,
        suggestedProductId: itemRequest.suggestedProductId,
        processedById: itemRequest.processedById,
        processedAt: itemRequest.processedAt,
        createdAt: itemRequest.createdAt,
        updatedAt: itemRequest.updatedAt,
        suggestedProduct: {
          id: product.id,
          name: product.name,
          price: product.price,
          image: product.image,
        },
      })
      .from(itemRequest)
      .leftJoin(product, eq(itemRequest.suggestedProductId, product.id))
      .where(and(...conditions))
      .orderBy(desc(itemRequest.createdAt))
      .limit(limit)
      .offset(offset);

    return {
      success: true,
      data: {
        requests: requests as ItemRequestWithRelations[],
        pagination: {
          page,
          limit,
          totalCount,
          totalPages: Math.ceil(totalCount / limit),
        },
      },
    };
  } catch (error) {
    console.error("Error fetching customer item requests:", error);
    return { success: false, error: "Failed to fetch requests", data: null };
  }
}

// Get all requests (admin only)
export async function getAllItemRequests(filters?: ItemRequestFilterValues) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized", data: null };
    }

    // Check if admin
    if (session.user.role !== "admin") {
      return { success: false, error: "Admin access required", data: null };
    }

    const page = filters?.page || 1;
    const limit = filters?.limit || 10;
    const offset = (page - 1) * limit;

    // Build where conditions
    const conditions = [];

    if (filters?.status && filters.status !== "all") {
      conditions.push(eq(itemRequest.status, filters.status));
    }

    if (filters?.search) {
      conditions.push(
        or(
          ilike(itemRequest.itemName, `%${filters.search}%`),
          ilike(itemRequest.requestNumber, `%${filters.search}%`),
        ) as ReturnType<typeof eq>,
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get total count
    const [countResult] = await db
      .select({ count: count() })
      .from(itemRequest)
      .where(whereClause);

    const totalCount = countResult?.count || 0;

    // Get requests with customer and suggested product info
    const requests = await db
      .select({
        id: itemRequest.id,
        requestNumber: itemRequest.requestNumber,
        customerId: itemRequest.customerId,
        itemName: itemRequest.itemName,
        brand: itemRequest.brand,
        category: itemRequest.category,
        quantity: itemRequest.quantity,
        description: itemRequest.description,
        image: itemRequest.image,
        status: itemRequest.status,
        adminResponse: itemRequest.adminResponse,
        suggestedProductId: itemRequest.suggestedProductId,
        processedById: itemRequest.processedById,
        processedAt: itemRequest.processedAt,
        createdAt: itemRequest.createdAt,
        updatedAt: itemRequest.updatedAt,
        customer: {
          id: user.id,
          name: user.name,
          email: user.email,
          shopName: user.shopName,
          phoneNumber: user.phoneNumber,
        },
        suggestedProduct: {
          id: product.id,
          name: product.name,
          price: product.price,
          image: product.image,
        },
      })
      .from(itemRequest)
      .leftJoin(user, eq(itemRequest.customerId, user.id))
      .leftJoin(product, eq(itemRequest.suggestedProductId, product.id))
      .where(whereClause)
      .orderBy(desc(itemRequest.createdAt))
      .limit(limit)
      .offset(offset);

    return {
      success: true,
      data: {
        requests: requests as ItemRequestWithRelations[],
        pagination: {
          page,
          limit,
          totalCount,
          totalPages: Math.ceil(totalCount / limit),
        },
      },
    };
  } catch (error) {
    console.error("Error fetching all item requests:", error);
    return { success: false, error: "Failed to fetch requests", data: null };
  }
}

// Get request stats for admin dashboard
export async function getItemRequestStats() {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id || session.user.role !== "admin") {
      return { success: false, error: "Admin access required", data: null };
    }

    // Get counts using separate queries for each status (Drizzle-style)
    const [totalResult] = await db.select({ count: count() }).from(itemRequest);

    const [pendingResult] = await db
      .select({ count: count() })
      .from(itemRequest)
      .where(eq(itemRequest.status, "pending"));

    const [approvedResult] = await db
      .select({ count: count() })
      .from(itemRequest)
      .where(eq(itemRequest.status, "approved"));

    const [rejectedResult] = await db
      .select({ count: count() })
      .from(itemRequest)
      .where(eq(itemRequest.status, "rejected"));

    const [suggestedResult] = await db
      .select({ count: count() })
      .from(itemRequest)
      .where(eq(itemRequest.status, "suggested"));

    return {
      success: true,
      data: {
        total: totalResult?.count || 0,
        pending: pendingResult?.count || 0,
        approved: approvedResult?.count || 0,
        rejected: rejectedResult?.count || 0,
        suggested: suggestedResult?.count || 0,
      },
    };
  } catch (error) {
    console.error("Error fetching item request stats:", error);
    return { success: false, error: "Failed to fetch stats", data: null };
  }
}
