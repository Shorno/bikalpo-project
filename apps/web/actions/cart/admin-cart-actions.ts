"use server";

import { desc, eq, sql } from "drizzle-orm";
import { checkAuth } from "@/app/(dashboard)/dashboard/admin/_actions/auth/checkAuth";
import { db } from "@/db/config";
import { cart, cartItem } from "@/db/schema/cart";

// Get all carts for admin dashboard
export async function getAllCarts() {
  const session = await checkAuth();

  if (!session?.user || session.user.role !== "admin") {
    return { success: false, error: "Unauthorized", data: [] };
  }

  try {
    const carts = await db.query.cart.findMany({
      orderBy: [desc(cart.updatedAt)],
      with: {
        user: {
          columns: {
            id: true,
            name: true,
            email: true,
            shopName: true,
            phoneNumber: true,
          },
        },
        items: {
          with: {
            product: {
              columns: {
                id: true,
                name: true,
                slug: true,
                image: true,
                size: true,
                price: true,
              },
            },
          },
        },
      },
    });

    const formattedCarts = carts.map((c) => ({
      id: c.id,
      userId: c.userId,
      user: c.user,
      totalItems: c.items.reduce((sum, item) => sum + item.quantity, 0),
      totalPrice: c.items.reduce(
        (sum, item) => sum + Number(item.price) * item.quantity,
        0,
      ),
      itemCount: c.items.length,
      items: c.items.map((item) => ({
        id: item.id,
        productId: item.productId,
        productName: item.product.name,
        productImage: item.product.image,
        size: item.product.size,
        price: Number(item.price),
        quantity: item.quantity,
        subtotal: Number(item.price) * item.quantity,
      })),
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    }));

    return { success: true, data: formattedCarts };
  } catch (error) {
    console.error("Error fetching carts:", error);
    return { success: false, error: "Failed to fetch carts", data: [] };
  }
}

// Get a specific user's cart by userId
export async function getUserCart(userId: string) {
  const session = await checkAuth();

  if (!session?.user || session.user.role !== "admin") {
    return { success: false, error: "Unauthorized", data: null };
  }

  try {
    const userCart = await db.query.cart.findFirst({
      where: eq(cart.userId, userId),
      with: {
        user: {
          columns: {
            id: true,
            name: true,
            email: true,
            shopName: true,
            phoneNumber: true,
          },
        },
        items: {
          with: {
            product: {
              columns: {
                id: true,
                name: true,
                slug: true,
                image: true,
                size: true,
                price: true,
              },
            },
          },
        },
      },
    });

    if (!userCart) {
      return { success: false, error: "Cart not found", data: null };
    }

    const formattedCart = {
      id: userCart.id,
      userId: userCart.userId,
      user: userCart.user,
      totalItems: userCart.items.reduce((sum, item) => sum + item.quantity, 0),
      totalPrice: userCart.items.reduce(
        (sum, item) => sum + Number(item.price) * item.quantity,
        0,
      ),
      items: userCart.items.map((item) => ({
        id: item.id,
        productId: item.productId,
        productName: item.product.name,
        productSlug: item.product.slug,
        productImage: item.product.image,
        size: item.product.size,
        price: Number(item.price),
        currentPrice: Number(item.product.price),
        quantity: item.quantity,
        subtotal: Number(item.price) * item.quantity,
      })),
      createdAt: userCart.createdAt,
      updatedAt: userCart.updatedAt,
    };

    return { success: true, data: formattedCart };
  } catch (error) {
    console.error("Error fetching user cart:", error);
    return { success: false, error: "Failed to fetch cart", data: null };
  }
}

// Get cart statistics for admin dashboard
export async function getCartStats() {
  const session = await checkAuth();

  if (!session?.user || session.user.role !== "admin") {
    return { success: false, error: "Unauthorized", data: null };
  }

  try {
    // Get total carts with items
    const cartsWithItems = await db
      .select({
        cartCount: sql<number>`count(distinct ${cart.id})`,
        totalItems: sql<number>`sum(${cartItem.quantity})`,
        totalValue: sql<number>`sum(${cartItem.price}::numeric * ${cartItem.quantity})`,
      })
      .from(cart)
      .innerJoin(cartItem, eq(cart.id, cartItem.cartId));

    const stats = cartsWithItems[0] || {
      cartCount: 0,
      totalItems: 0,
      totalValue: 0,
    };

    return {
      success: true,
      data: {
        activeCarts: Number(stats.cartCount) || 0,
        totalItemsInCarts: Number(stats.totalItems) || 0,
        totalCartValue: Number(stats.totalValue) || 0,
      },
    };
  } catch (error) {
    console.error("Error fetching cart stats:", error);
    return { success: false, error: "Failed to fetch stats", data: null };
  }
}
