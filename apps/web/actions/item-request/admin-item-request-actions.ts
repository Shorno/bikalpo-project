"use server";

import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { db } from "@/db/config";
import { itemRequest } from "@/db/schema/item-request";
import { product } from "@/db/schema/product";
import { stockChangeLog } from "@/db/schema/stock-change-log";
import { auth } from "@/lib/auth";
import {
  type ProcessItemRequestFormValues,
  processItemRequestSchema,
} from "@/schema/item-request.schema";

// Helper to check admin role
async function checkAdminAccess() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    return { authorized: false, error: "Unauthorized", userId: null };
  }

  if (session.user.role !== "admin") {
    return { authorized: false, error: "Admin access required", userId: null };
  }

  return { authorized: true, error: null, userId: session.user.id };
}

// Approve a request and add the requested quantity to the selected product's stock.
// addToProductId is required: stock is updated automatically on approve.
export async function approveItemRequest(
  requestId: number,
  adminResponse?: string,
  addToProductId?: number,
) {
  try {
    const { authorized, error, userId } = await checkAdminAccess();
    if (!authorized) {
      return { success: false, error };
    }

    if (addToProductId == null || addToProductId <= 0) {
      return {
        success: false,
        error:
          "Please select a product to add the requested quantity to. Stock will be updated when you approve.",
      };
    }

    const [req] = await db
      .select({
        quantity: itemRequest.quantity,
        requestNumber: itemRequest.requestNumber,
      })
      .from(itemRequest)
      .where(eq(itemRequest.id, requestId));

    if (!req) {
      return { success: false, error: "Request not found" };
    }

    if (req.quantity <= 0) {
      return { success: false, error: "Request has invalid quantity" };
    }

    const [prod] = await db
      .select({ id: product.id })
      .from(product)
      .where(eq(product.id, addToProductId));
    if (!prod) {
      return { success: false, error: "Selected product not found" };
    }

    // Add to product stock, set lastRestockedAt, and log to stock_change_log
    await db
      .update(product)
      .set({
        stockQuantity: sql`${product.stockQuantity} + ${req.quantity}`,
        inStock: true,
        lastRestockedAt: new Date(),
      })
      .where(eq(product.id, addToProductId));

    await db.insert(stockChangeLog).values({
      productId: addToProductId,
      changeType: "add",
      quantity: req.quantity,
      reason: `Item request ${req.requestNumber} approved`,
      createdById: userId,
    });

    revalidatePath("/dashboard/admin/stock");
    revalidatePath("/dashboard/admin/products");

    const [updated] = await db
      .update(itemRequest)
      .set({
        status: "approved",
        adminResponse:
          adminResponse ||
          "Your request has been approved. The item has been added to stock.",
        processedById: userId,
        processedAt: new Date(),
      })
      .where(eq(itemRequest.id, requestId))
      .returning();

    if (!updated) {
      return { success: false, error: "Request not found" };
    }

    revalidatePath("/account/requests");
    revalidatePath("/dashboard/item-requests");
    revalidatePath("/dashboard/admin/item-requests");

    return { success: true, request: updated };
  } catch (error) {
    console.error("Error approving item request:", error);
    return { success: false, error: "Failed to approve request" };
  }
}

// Reject a request
export async function rejectItemRequest(
  requestId: number,
  adminResponse?: string,
) {
  try {
    const { authorized, error, userId } = await checkAdminAccess();
    if (!authorized) {
      return { success: false, error };
    }

    const [updated] = await db
      .update(itemRequest)
      .set({
        status: "rejected",
        adminResponse: adminResponse || "Your request has been rejected",
        processedById: userId,
        processedAt: new Date(),
      })
      .where(eq(itemRequest.id, requestId))
      .returning();

    if (!updated) {
      return { success: false, error: "Request not found" };
    }

    revalidatePath("/account/requests");
    revalidatePath("/dashboard/item-requests");

    return { success: true, request: updated };
  } catch (error) {
    console.error("Error rejecting item request:", error);
    return { success: false, error: "Failed to reject request" };
  }
}

// Suggest an alternative product
export async function suggestAlternativeProduct(
  requestId: number,
  suggestedProductId: number,
  adminResponse?: string,
) {
  try {
    const { authorized, error, userId } = await checkAdminAccess();
    if (!authorized) {
      return { success: false, error };
    }

    // Verify product exists
    const productExists = await db.query.product.findFirst({
      where: eq(product.id, suggestedProductId),
    });

    if (!productExists) {
      return { success: false, error: "Suggested product not found" };
    }

    const [updated] = await db
      .update(itemRequest)
      .set({
        status: "suggested",
        suggestedProductId,
        adminResponse:
          adminResponse ||
          `We suggest trying "${productExists.name}" as an alternative`,
        processedById: userId,
        processedAt: new Date(),
      })
      .where(eq(itemRequest.id, requestId))
      .returning();

    if (!updated) {
      return { success: false, error: "Request not found" };
    }

    revalidatePath("/account/requests");
    revalidatePath("/dashboard/item-requests");

    return { success: true, request: updated };
  } catch (error) {
    console.error("Error suggesting alternative:", error);
    return { success: false, error: "Failed to suggest alternative" };
  }
}

// Process request with schema validation (unified action)
export async function processItemRequest(data: ProcessItemRequestFormValues) {
  try {
    const validatedData = processItemRequestSchema.safeParse(data);
    if (!validatedData.success) {
      return {
        success: false,
        error: validatedData.error.issues[0]?.message || "Invalid input",
      };
    }

    const {
      requestId,
      status,
      adminResponse,
      suggestedProductId,
      addToProductId,
    } = validatedData.data;

    switch (status) {
      case "approved":
        return approveItemRequest(requestId, adminResponse, addToProductId);
      case "rejected":
        return rejectItemRequest(requestId, adminResponse);
      case "suggested":
        if (!suggestedProductId) {
          return {
            success: false,
            error: "Please select a product to suggest",
          };
        }
        return suggestAlternativeProduct(
          requestId,
          suggestedProductId,
          adminResponse,
        );
      default:
        return { success: false, error: "Invalid status" };
    }
  } catch (error) {
    console.error("Error processing item request:", error);
    return { success: false, error: "Failed to process request" };
  }
}
