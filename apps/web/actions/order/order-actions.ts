"use server";

import { desc, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { calculateDeliveryCost } from "@/actions/delivery-rule/calculate-delivery-cost";
import { db } from "@/db/config";
import { cart, cartItem } from "@/db/schema/cart";
import { deliveryGroupInvoice } from "@/db/schema/delivery";
import { estimate } from "@/db/schema/estimate";
import { invoice } from "@/db/schema/invoice";
import { order, orderItem, type PaymentMethod } from "@/db/schema/order";
import { product } from "@/db/schema/product";
import { productVariant } from "@/db/schema/product-variant";
import { auth } from "@/lib/auth";

function parseWeightFromSize(size: string | null): number {
  if (!size || typeof size !== "string") return 0;
  const match = size.match(/(\d+(?:\.\d+)?)/);
  return match ? Number(match[1]) : 0;
}

interface ShippingInfo {
  name: string;
  phone: string;
  email?: string;
  address: string;
  city: string;
  area?: string;
  postalCode?: string;
  customerNote?: string;
}

// Generate unique order number
function generateOrderNumber(): string {
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `ORD-${year}${month}${day}-${random}`;
}

export async function placeOrder(
  shippingInfo: ShippingInfo,
  paymentMethod: PaymentMethod = "cash_on_delivery",
) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return {
        success: false,
        error: "You must be logged in to place an order",
      };
    }

    const userId = session.user.id;

    // Check if user has an active order (not delivered or cancelled)
    const activeOrder = await db.query.order.findFirst({
      where: sql`${order.userId} = ${userId} 
        AND ${order.status} NOT IN ('delivered', 'cancelled')`,
    });

    if (activeOrder) {
      return {
        success: false,
        error:
          "You already have an active order. Please wait until it's delivered or cancelled before placing a new order.",
      };
    }

    // Get user's cart with items (include variant for weight and delivery cost)
    const userCart = await db.query.cart.findFirst({
      where: eq(cart.userId, userId),
      with: {
        items: {
          with: {
            product: true,
            variant: true,
          },
        },
      },
    });

    if (!userCart || userCart.items.length === 0) {
      return { success: false, error: "Your cart is empty" };
    }

    // Validate stock and prepare order items; compute total weight for delivery
    const orderItems: Array<{
      productId: number;
      variantId: number | null;
      productName: string;
      productImage: string;
      productSize: string;
      quantity: number;
      unitPrice: string;
      totalPrice: string;
    }> = [];

    let subtotal = 0;
    let totalWeightKg = 0;

    for (const item of userCart.items) {
      if (!item.product) {
        return { success: false, error: `Product not found for cart item` };
      }

      if (!item.product.inStock) {
        return {
          success: false,
          error: `${item.product.name} is out of stock`,
        };
      }

      const stockQty = item.variant
        ? item.variant.stockQuantity
        : item.product.stockQuantity;
      if (stockQty < item.quantity) {
        return {
          success: false,
          error: `Insufficient stock for ${item.product.name}. Available: ${stockQty}`,
        };
      }

      const itemTotal = Number(item.price) * item.quantity;
      subtotal += itemTotal;

      const weightPerUnit = item.variant
        ? Number(item.variant.weightKg)
        : parseWeightFromSize(item.product.size);
      totalWeightKg += weightPerUnit * item.quantity;

      const displaySize =
        item.variant?.quantitySelectorLabel ?? item.product.size;

      orderItems.push({
        productId: item.productId,
        variantId: item.variantId ?? null,
        productName: item.product.name,
        productImage: item.product.image,
        productSize: displaySize,
        quantity: item.quantity,
        unitPrice: item.price,
        totalPrice: itemTotal.toFixed(2),
      });
    }

    const shippingCost = await calculateDeliveryCost(
      totalWeightKg,
      shippingInfo.area ?? undefined,
    );
    const discount = 0;
    const total = subtotal + shippingCost - discount;

    // Create order and order items in a transaction
    const result = await db.transaction(async (tx) => {
      // Create order
      const [newOrder] = await tx
        .insert(order)
        .values({
          orderNumber: generateOrderNumber(),
          userId,
          subtotal: subtotal.toFixed(2),
          shippingCost: shippingCost.toFixed(2),
          discount: discount.toFixed(2),
          total: total.toFixed(2),
          status: "pending",
          paymentStatus: "pending",
          paymentMethod,
          shippingName: shippingInfo.name,
          shippingPhone: shippingInfo.phone,
          shippingEmail: shippingInfo.email,
          shippingAddress: shippingInfo.address,
          shippingCity: shippingInfo.city,
          shippingArea: shippingInfo.area,
          shippingPostalCode: shippingInfo.postalCode,
          customerNote: shippingInfo.customerNote,
        })
        .returning();

      // Create order items (include variantId when present)
      await tx.insert(orderItem).values(
        orderItems.map((item) => ({
          orderId: newOrder.id,
          productId: item.productId,
          variantId: item.variantId,
          productName: item.productName,
          productImage: item.productImage,
          productSize: item.productSize,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice,
        })),
      );

      // Update stock (variant if present, else product)
      for (const item of orderItems) {
        if (item.variantId != null) {
          await tx
            .update(productVariant)
            .set({
              stockQuantity: sql`${productVariant.stockQuantity} - ${item.quantity}`,
            })
            .where(eq(productVariant.id, item.variantId));
        } else {
          await tx
            .update(product)
            .set({
              stockQuantity: sql`${product.stockQuantity} - ${item.quantity}`,
            })
            .where(eq(product.id, item.productId));
        }
      }

      // Clear cart
      await tx.delete(cartItem).where(eq(cartItem.cartId, userCart.id));

      return newOrder;
    });

    revalidatePath("/");
    revalidatePath("/orders");
    revalidatePath("/checkout");

    return {
      success: true,
      orderNumber: result.orderNumber,
      orderId: result.id,
    };
  } catch (error) {
    console.error("Error placing order:", error);
    return { success: false, error: "Failed to place order" };
  }
}

export async function getMyOrders() {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return { success: false, error: "Not authenticated", orders: [] };
    }

    const allOrders = await db.query.order.findMany({
      where: eq(order.userId, session.user.id),
      with: {
        items: true,
      },
      orderBy: [desc(order.createdAt)],
    });

    // Filter out orders from unapproved estimates
    // Only show orders that either:
    // 1. Were NOT created from an estimate (direct customer orders)
    // 2. Were created from an approved/sent estimate
    const filteredOrders = await Promise.all(
      allOrders.map(async (ord) => {
        // Check if this order came from an estimate
        const estimateRecord = await db.query.estimate.findFirst({
          where: eq(estimate.convertedOrderId, ord.id),
          columns: { status: true },
        });

        // If no estimate found, it's a direct order - show it
        if (!estimateRecord) {
          return ord;
        }

        // If estimate exists, only show if it's approved or converted
        if (
          estimateRecord.status === "approved" ||
          estimateRecord.status === "converted"
        ) {
          return ord;
        }

        // Hide orders from pending/draft/rejected estimates
        return null;
      }),
    );

    // Remove null entries
    const orders = filteredOrders.filter((ord) => ord !== null);

    return { success: true, orders };
  } catch (error) {
    console.error("Error getting orders:", error);
    return { success: false, error: "Failed to get orders", orders: [] };
  }
}

// Get customer's current active order (not delivered or cancelled)
export async function getActiveOrder() {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return { success: false, error: "Not authenticated" };
    }

    // Find active order (not delivered, cancelled)
    const activeOrder = await db.query.order.findFirst({
      where: sql`${order.userId} = ${session.user.id} 
        AND ${order.status} NOT IN ('delivered', 'cancelled')`,
      with: {
        items: true,
      },
      orderBy: [desc(order.createdAt)],
    });

    if (!activeOrder) {
      return { success: true, order: null };
    }

    // Check if order came from an unapproved estimate
    const estimateRecord = await db.query.estimate.findFirst({
      where: eq(estimate.convertedOrderId, activeOrder.id),
      columns: { status: true },
    });

    // If order is from an unapproved estimate, hide it from customer
    if (
      estimateRecord &&
      estimateRecord.status !== "approved" &&
      estimateRecord.status !== "converted"
    ) {
      return { success: true, order: null };
    }

    // Get delivery info if exists - now via invoices
    // First find invoices for this order, then check if any are in a delivery group
    const orderInvoices = await db.query.invoice.findMany({
      where: eq(invoice.orderId, activeOrder.id),
      columns: { id: true },
    });

    let deliveryInfo = null;
    if (orderInvoices.length > 0) {
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

      if (deliveryInvoice) {
        deliveryInfo = {
          status: deliveryInvoice.group.status,
          otp:
            deliveryInvoice.group.status === "out_for_delivery"
              ? deliveryInvoice.deliveryOtp
              : null,
        };
      }
    }

    return { success: true, order: activeOrder, deliveryInfo };
  } catch (error) {
    console.error("Error getting active order:", error);
    return { success: false, error: "Failed to get active order" };
  }
}

export async function getOrderByNumber(orderNumber: string) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return { success: false, error: "Not authenticated" };
    }

    const orderData = await db.query.order.findFirst({
      where: eq(order.orderNumber, orderNumber),
      with: {
        items: true,
      },
    });

    if (!orderData) {
      return { success: false, error: "Order not found" };
    }

    // Check if user owns this order
    if (orderData.userId !== session.user.id) {
      return { success: false, error: "Not authorized to view this order" };
    }

    // Check if order came from an unapproved estimate
    const estimateRecord = await db.query.estimate.findFirst({
      where: eq(estimate.convertedOrderId, orderData.id),
      columns: { status: true },
    });

    // If order is from an unapproved estimate, deny access
    if (
      estimateRecord &&
      estimateRecord.status !== "approved" &&
      estimateRecord.status !== "converted"
    ) {
      return { success: false, error: "Order not found" };
    }

    return { success: true, order: orderData };
  } catch (error) {
    console.error("Error getting order:", error);
    return { success: false, error: "Failed to get order" };
  }
}

export async function cancelOrder(orderId: number) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return { success: false, error: "Not authenticated" };
    }

    const existingOrder = await db.query.order.findFirst({
      where: eq(order.id, orderId),
      with: {
        items: true,
      },
    });

    if (!existingOrder) {
      return { success: false, error: "Order not found" };
    }

    if (existingOrder.userId !== session.user.id) {
      return { success: false, error: "Not authorized to cancel this order" };
    }

    if (existingOrder.status !== "pending") {
      return { success: false, error: "Only pending orders can be cancelled" };
    }

    // Cancel order and restore stock
    await db.transaction(async (tx) => {
      // Update order status
      await tx
        .update(order)
        .set({
          status: "cancelled",
          cancelledAt: new Date(),
        })
        .where(eq(order.id, orderId));

      // Restore product stock
      for (const item of existingOrder.items) {
        await tx
          .update(product)
          .set({
            stockQuantity: sql`${product.stockQuantity} + ${item.quantity}`,
          })
          .where(eq(product.id, item.productId));
      }
    });

    revalidatePath("/orders");

    return { success: true };
  } catch (error) {
    console.error("Error cancelling order:", error);
    return { success: false, error: "Failed to cancel order" };
  }
}

// Get delivery OTP for an order (for customer to share with deliveryman)
export async function getOrderDeliveryOtp(orderId: number) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return { success: false, error: "Not authenticated" };
    }

    // Get order and verify ownership
    const orderData = await db.query.order.findFirst({
      where: eq(order.id, orderId),
    });

    if (!orderData) {
      return { success: false, error: "Order not found" };
    }

    if (orderData.userId !== session.user.id) {
      return { success: false, error: "Not authorized" };
    }

    // Get invoices for this order first
    const orderInvoices = await db.query.invoice.findMany({
      where: eq(invoice.orderId, orderId),
      columns: { id: true },
    });

    if (orderInvoices.length === 0) {
      return { success: true, otp: null, showOtp: false };
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
      return { success: true, otp: null, showOtp: false };
    }

    return {
      success: true,
      otp: deliveryInvoice.deliveryOtp,
      showOtp: true,
      deliveryStatus: deliveryInvoice.status,
    };
  } catch (error) {
    console.error("Error getting delivery OTP:", error);
    return { success: false, error: "Failed to get delivery OTP" };
  }
}

// Get specific order details for the authenticated user
export async function getOrderDetails(orderId: number) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return { success: false, error: "Not authenticated" };
    }

    const orderData = await db.query.order.findFirst({
      where: eq(order.id, orderId),
      with: {
        items: true,
      },
    });

    if (!orderData) {
      return { success: false, error: "Order not found" };
    }

    if (orderData.userId !== session.user.id) {
      return { success: false, error: "Not authorized to view this order" };
    }

    // Check if order came from an unapproved estimate
    const estimateRecord = await db.query.estimate.findFirst({
      where: eq(estimate.convertedOrderId, orderData.id),
      columns: { status: true },
    });

    // If order is from an unapproved estimate, deny access
    if (
      estimateRecord &&
      estimateRecord.status !== "approved" &&
      estimateRecord.status !== "converted"
    ) {
      return { success: false, error: "Order not found" };
    }

    // Get delivery info via invoices
    const orderInvoices = await db.query.invoice.findMany({
      where: eq(invoice.orderId, orderData.id),
      columns: { id: true },
    });

    let deliveryInfo = null;
    if (orderInvoices.length > 0) {
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

      if (deliveryInvoice) {
        deliveryInfo = {
          status: deliveryInvoice.group.status,
          otp:
            deliveryInvoice.group.status === "out_for_delivery"
              ? deliveryInvoice.deliveryOtp
              : null,
        };
      }
    }

    return { success: true, order: orderData, deliveryInfo };
  } catch (error) {
    console.error("Error getting order details:", error);
    return { success: false, error: "Failed to get order details" };
  }
}

// Get order items with current product prices for reordering
export async function getReorderItems(orderId: number) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return { success: false, error: "Not authenticated" };
    }

    // Get order with items
    const orderData = await db.query.order.findFirst({
      where: eq(order.id, orderId),
      with: {
        items: true,
      },
    });

    if (!orderData) {
      return { success: false, error: "Order not found" };
    }

    // Verify ownership
    if (orderData.userId !== session.user.id) {
      return { success: false, error: "Not authorized" };
    }

    // Check if order came from an unapproved estimate
    const estimateRecord = await db.query.estimate.findFirst({
      where: eq(estimate.convertedOrderId, orderData.id),
      columns: { status: true },
    });

    // If order is from an unapproved estimate, deny access
    if (
      estimateRecord &&
      estimateRecord.status !== "approved" &&
      estimateRecord.status !== "converted"
    ) {
      return { success: false, error: "Order not found" };
    }

    // Only allow reorder for delivered orders
    if (orderData.status !== "delivered") {
      return {
        success: false,
        error: "Only delivered orders can be reordered",
      };
    }

    // Fetch current product data for each item
    const reorderItems = await Promise.all(
      orderData.items.map(async (item) => {
        const currentProduct = await db.query.product.findFirst({
          where: eq(product.id, item.productId),
          with: {
            category: true,
          },
        });

        return {
          id: item.id,
          productId: item.productId,
          productName: item.productName,
          productImage: item.productImage,
          productSize: item.productSize,
          originalQuantity: item.quantity,
          quantity: item.quantity, // Editable quantity
          originalPrice: item.unitPrice, // Price at time of original order
          currentPrice: currentProduct?.price || item.unitPrice, // Current product price
          inStock: currentProduct?.inStock ?? false,
          stockQuantity: currentProduct?.stockQuantity ?? 0,
          productExists: !!currentProduct,
        };
      }),
    );

    return {
      success: true,
      items: reorderItems,
      originalOrder: {
        id: orderData.id,
        orderNumber: orderData.orderNumber,
        shippingName: orderData.shippingName,
        shippingPhone: orderData.shippingPhone,
        shippingEmail: orderData.shippingEmail,
        shippingAddress: orderData.shippingAddress,
        shippingCity: orderData.shippingCity,
        shippingArea: orderData.shippingArea,
        shippingPostalCode: orderData.shippingPostalCode,
      },
    };
  } catch (error) {
    console.error("Error getting reorder items:", error);
    return { success: false, error: "Failed to get reorder items" };
  }
}

interface ReorderItem {
  productId: number;
  quantity: number;
}

// Place a reorder from a previous order
export async function placeReorder(
  originalOrderId: number,
  items: ReorderItem[],
  shippingInfo: ShippingInfo,
  paymentMethod: PaymentMethod = "cash_on_delivery",
) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return {
        success: false,
        error: "You must be logged in to place an order",
      };
    }

    const userId = session.user.id;

    // Verify original order belongs to user and is delivered
    const originalOrder = await db.query.order.findFirst({
      where: eq(order.id, originalOrderId),
    });

    if (!originalOrder || originalOrder.userId !== userId) {
      return { success: false, error: "Original order not found" };
    }

    if (originalOrder.status !== "delivered") {
      return {
        success: false,
        error: "Only delivered orders can be reordered",
      };
    }

    // Check if user has an active order
    const activeOrder = await db.query.order.findFirst({
      where: sql`${order.userId} = ${userId} 
        AND ${order.status} NOT IN ('delivered', 'cancelled')`,
    });

    if (activeOrder) {
      return {
        success: false,
        error:
          "You already have an active order. Please wait until it's delivered or cancelled before placing a new order.",
      };
    }

    if (items.length === 0) {
      return { success: false, error: "No items to reorder" };
    }

    // Validate stock and prepare order items with current prices
    const orderItems: Array<{
      productId: number;
      productName: string;
      productImage: string;
      productSize: string;
      quantity: number;
      unitPrice: string;
      totalPrice: string;
    }> = [];

    let subtotal = 0;

    for (const item of items) {
      const currentProduct = await db.query.product.findFirst({
        where: eq(product.id, item.productId),
      });

      if (!currentProduct) {
        return { success: false, error: `Product not found` };
      }

      if (!currentProduct.inStock) {
        return {
          success: false,
          error: `${currentProduct.name} is out of stock`,
        };
      }

      if (currentProduct.stockQuantity < item.quantity) {
        return {
          success: false,
          error: `Insufficient stock for ${currentProduct.name}. Available: ${currentProduct.stockQuantity}`,
        };
      }

      const itemTotal = Number(currentProduct.price) * item.quantity;
      subtotal += itemTotal;

      orderItems.push({
        productId: currentProduct.id,
        productName: currentProduct.name,
        productImage: currentProduct.image,
        productSize: currentProduct.size,
        quantity: item.quantity,
        unitPrice: currentProduct.price,
        totalPrice: itemTotal.toFixed(2),
      });
    }

    const shippingCost = 0;
    const discount = 0;
    const total = subtotal + shippingCost - discount;

    // Create order in a transaction
    const result = await db.transaction(async (tx) => {
      // Create order
      const [newOrder] = await tx
        .insert(order)
        .values({
          orderNumber: generateOrderNumber(),
          userId,
          subtotal: subtotal.toFixed(2),
          shippingCost: shippingCost.toFixed(2),
          discount: discount.toFixed(2),
          total: total.toFixed(2),
          status: "pending",
          paymentStatus: "pending",
          paymentMethod,
          shippingName: shippingInfo.name,
          shippingPhone: shippingInfo.phone,
          shippingEmail: shippingInfo.email,
          shippingAddress: shippingInfo.address,
          shippingCity: shippingInfo.city,
          shippingArea: shippingInfo.area,
          shippingPostalCode: shippingInfo.postalCode,
          customerNote: shippingInfo.customerNote,
        })
        .returning();

      // Create order items
      await tx.insert(orderItem).values(
        orderItems.map((item) => ({
          orderId: newOrder.id,
          ...item,
        })),
      );

      // Update product stock
      for (const item of orderItems) {
        await tx
          .update(product)
          .set({
            stockQuantity: sql`${product.stockQuantity} - ${item.quantity}`,
          })
          .where(eq(product.id, item.productId));
      }

      return newOrder;
    });

    revalidatePath("/");
    revalidatePath("/orders");
    revalidatePath("/customer/account/orders");

    return {
      success: true,
      orderNumber: result.orderNumber,
      orderId: result.id,
    };
  } catch (error) {
    console.error("Error placing reorder:", error);
    return { success: false, error: "Failed to place reorder" };
  }
}
