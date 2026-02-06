"use server";

import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { db } from "@/db/config";
import { estimate } from "@/db/schema/estimate";
import {
  type NewOrder,
  type NewOrderItem,
  order,
  orderItem,
} from "@/db/schema/order";
import { product } from "@/db/schema/product";
import { auth } from "@/lib/auth";
import {
  type ConvertEstimateFormValues,
  convertEstimateSchema,
} from "@/schema/estimate.schema";

// Generate unique order number
function generateOrderNumber(): string {
  const prefix = "ORD";
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
}

export async function convertEstimateToOrder(data: ConvertEstimateFormValues) {
  try {
    console.log("Attempting to convert estimate to order with data:", data);

    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      console.warn(
        "Unauthorized attempt to convert estimate: No session user ID.",
      );
      return { success: false, error: "Unauthorized" };
    }

    // Allow admin, salesman, or the customer who owns the estimate
    if (
      session.user.role !== "admin" &&
      session.user.role !== "salesman" &&
      session.user.role !== "customer"
    ) {
      return {
        success: false,
        error: "Unauthorized",
      };
    }

    console.log("Validating data with schema...");
    // Validate input
    const validatedData = convertEstimateSchema.safeParse(data);
    if (!validatedData.success) {
      console.error(
        "Schema validation failed:",
        JSON.stringify(validatedData.error.issues, null, 2),
      );
      return {
        success: false,
        error: validatedData.error.issues[0]?.message || "Invalid input",
      };
    }

    const {
      estimateId,
      shippingName,
      shippingPhone,
      shippingAddress,
      shippingCity,
      shippingArea,
      shippingPostalCode,
      customerNote,
    } = validatedData.data;

    console.log("Validated data:", validatedData.data);

    console.log("Fetching estimate from DB, ID:", estimateId);
    // Get estimate with items
    const estimateData = await db.query.estimate.findFirst({
      where: eq(estimate.id, estimateId),
      with: { items: true },
    });

    console.log(
      "Estimate found:",
      estimateData ? "Yes" : "No",
      "Status:",
      estimateData?.status,
    );

    if (!estimateData) {
      console.error("Estimate not found in DB for ID:", estimateId);
      return { success: false, error: "Estimate not found" };
    }

    // If user is a customer, verify ownership
    if (
      session.user.role === "customer" &&
      estimateData.customerId !== session.user.id
    ) {
      return {
        success: false,
        error: "Unauthorized: You do not own this estimate",
      };
    }

    // Check if customer has an active order (not delivered or cancelled)
    const activeOrder = await db.query.order.findFirst({
      where: sql`${order.userId} = ${estimateData.customerId} 
        AND ${order.status} NOT IN ('delivered', 'cancelled')`,
    });

    if (activeOrder) {
      return {
        success: false,
        error:
          "Customer already has an active order. Please wait until it's delivered or cancelled before converting this estimate.",
      };
    }

    console.log("Estimate Status Check:", estimateData.status);
    if (estimateData.status === "converted") {
      return { success: false, error: "Estimate has already been converted" };
    }

    // Customers can only convert "sent" estimates
    // Admins/Salesmen might force convert "approved" ones too, but standard flow is "sent".
    // Let's allow "sent" and "approved" (approved implies it's ready but maybe not explicitly 'sent' yet? No, workflow says Approved -> Sent)
    // Actually, create-estimate sets "approved" estimates to "sent" via update? No.
    // Wait, the workflow says: Discount -> Pending -> Admin Approves -> Sent.
    // So "Approved" is the action that transitions it to "Sent"?
    // Or is "Approved" a status?
    // Looking at `admin-estimate-actions.ts` (not visible but assumed), it probably sets status to 'approved' or 'sent'.
    // In `create-estimate.ts` I set it to `sent` directly if no discount.
    // So `sent` is the correct status for conversion by customer.
    // `approved` might be an intermediate status if admin clicked "Approve" but didn't "Send"?
    // Let's look at `estimateData.status !== "approved"` check I am replacing.
    // It was strict on "approved".
    // I should allow "sent" OR "approved".

    if (estimateData.status !== "approved" && estimateData.status !== "sent") {
      return {
        success: false,
        error: `Only sent or approved estimates can be converted. Current status: ${estimateData.status}`,
      };
    }

    console.log("Starting DB transaction...");
    // Convert in a transaction
    const result = await db.transaction(async (tx) => {
      console.log("Inserting Order record...");
      // Create the order
      const [newOrder] = await tx
        .insert(order)
        .values({
          orderNumber: generateOrderNumber(),
          userId: estimateData.customerId,
          subtotal: estimateData.subtotal,
          discount: estimateData.discount,
          total: estimateData.total,
          shippingCost: "0",
          status: "pending",
          paymentStatus: "pending",
          paymentMethod: "cash_on_delivery",
          shippingName,
          shippingPhone,
          shippingEmail: null,
          shippingAddress,
          shippingCity,
          shippingArea: shippingArea || null,
          shippingPostalCode: shippingPostalCode || null,
          customerNote: customerNote || null,
        } as NewOrder)
        .returning();

      if (!newOrder) {
        console.error("Failed to get back newOrder from insert.");
        throw new Error("Failed to create order");
      }
      console.log("Order created with ID:", newOrder.id);

      console.log("Creating order items...");
      // Create order items from estimate items
      const orderItems: NewOrderItem[] = estimateData.items.map((item) => ({
        orderId: newOrder.id,
        productId: item.productId,
        productName: item.productName,
        productImage: item.productImage || "",
        productSize: "N/A", // Estimates don't track size, using placeholder
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice,
      }));

      await tx.insert(orderItem).values(orderItems);
      console.log(`Inserted ${orderItems.length} order items.`);

      // Reduce stock for each product
      console.log("Updating product stock...");
      for (const item of estimateData.items) {
        console.log(
          `Reducing stock for product ${item.productId} by ${item.quantity}`,
        );
        await tx
          .update(product)
          .set({
            stockQuantity: sql`${product.stockQuantity} - ${item.quantity}`,
          })
          .where(eq(product.id, item.productId));
      }

      // Update estimate status to converted
      console.log("Updating estimate status to 'converted'...");
      await tx
        .update(estimate)
        .set({
          status: "converted",
          convertedOrderId: newOrder.id,
          convertedAt: new Date(),
        })
        .where(eq(estimate.id, estimateId));

      return newOrder;
    });

    console.log("Transaction successfully completed. New Order ID:", result.id);

    revalidatePath("/employee/estimates");
    revalidatePath("/dashboard/admin/estimates");
    revalidatePath("/dashboard/orders");
    revalidatePath("/orders");
    revalidatePath("/customer/account/orders");

    return { success: true, order: result };
  } catch (error: any) {
    console.error("CRITICAL error converting estimate to order:", error);
    return {
      success: false,
      error: "System Error: " + (error.message || "Unknown error"),
    };
  }
}
