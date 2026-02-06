"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { db } from "@/db/config";
import { cart, cartItem } from "@/db/schema/cart";
import { product } from "@/db/schema/product";
import { auth } from "@/lib/auth";

// Get current user's session
async function getCurrentUser() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  return session?.user;
}

// Get or create cart for user
async function getOrCreateCart(userId: string) {
  let userCart = await db.query.cart.findFirst({
    where: eq(cart.userId, userId),
  });

  if (!userCart) {
    const [newCart] = await db.insert(cart).values({ userId }).returning();
    userCart = newCart;
  }

  return userCart;
}

// Get cart with items for the current user
export async function getCart() {
  const user = await getCurrentUser();

  if (!user) {
    return { items: [], totalItems: 0, totalPrice: 0 };
  }

  const userCart = await db.query.cart.findFirst({
    where: eq(cart.userId, user.id),
    with: {
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
              inStock: true,
            },
            with: {
              category: {
                columns: {
                  slug: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!userCart) {
    return { items: [], totalItems: 0, totalPrice: 0 };
  }

  const items = userCart.items.map((item) => ({
    id: item.id,
    productId: item.productId,
    name: item.product.name,
    slug: item.product.slug,
    categorySlug: item.product.category.slug,
    image: item.product.image,
    size: item.product.size,
    price: Number(item.price),
    currentPrice: Number(item.product.price),
    quantity: item.quantity,
    inStock: item.product.inStock,
  }));

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );

  return { items, totalItems, totalPrice };
}

// Add item to cart
export async function addToCart(productId: number, quantity: number = 1) {
  const user = await getCurrentUser();

  if (!user) {
    return { success: false, error: "Please login to add items to cart" };
  }

  try {
    // Get product details
    const productData = await db.query.product.findFirst({
      where: eq(product.id, productId),
    });

    if (!productData) {
      return { success: false, error: "Product not found" };
    }

    if (!productData.inStock) {
      return { success: false, error: "Product is out of stock" };
    }

    // Get or create cart
    const userCart = await getOrCreateCart(user.id);

    // Check if item already exists in cart
    const existingItem = await db.query.cartItem.findFirst({
      where: and(
        eq(cartItem.cartId, userCart.id),
        eq(cartItem.productId, productId),
      ),
    });

    if (existingItem) {
      // Update quantity
      await db
        .update(cartItem)
        .set({
          quantity: existingItem.quantity + quantity,
          price: productData.price,
        })
        .where(eq(cartItem.id, existingItem.id));
    } else {
      // Add new item
      await db.insert(cartItem).values({
        cartId: userCart.id,
        productId,
        quantity,
        price: productData.price,
      });
    }

    revalidatePath("/");
    return { success: true, message: "Item added to cart" };
  } catch (error) {
    console.error("Error adding to cart:", error);
    return { success: false, error: "Failed to add item to cart" };
  }
}

// Update cart item quantity
export async function updateCartItemQuantity(
  cartItemId: number,
  quantity: number,
) {
  const user = await getCurrentUser();

  if (!user) {
    return { success: false, error: "Please login to update cart" };
  }

  try {
    if (quantity < 1) {
      return removeFromCart(cartItemId);
    }

    // Verify the cart item belongs to the user
    const item = await db.query.cartItem.findFirst({
      where: eq(cartItem.id, cartItemId),
      with: {
        cart: true,
      },
    });

    if (!item || item.cart.userId !== user.id) {
      return { success: false, error: "Cart item not found" };
    }

    await db
      .update(cartItem)
      .set({ quantity })
      .where(eq(cartItem.id, cartItemId));

    revalidatePath("/");
    return { success: true, message: "Cart updated" };
  } catch (error) {
    console.error("Error updating cart:", error);
    return { success: false, error: "Failed to update cart" };
  }
}

// Remove item from cart
export async function removeFromCart(cartItemId: number) {
  const user = await getCurrentUser();

  if (!user) {
    return { success: false, error: "Please login to update cart" };
  }

  try {
    // Verify the cart item belongs to the user
    const item = await db.query.cartItem.findFirst({
      where: eq(cartItem.id, cartItemId),
      with: {
        cart: true,
      },
    });

    if (!item || item.cart.userId !== user.id) {
      return { success: false, error: "Cart item not found" };
    }

    await db.delete(cartItem).where(eq(cartItem.id, cartItemId));

    revalidatePath("/");
    return { success: true, message: "Item removed from cart" };
  } catch (error) {
    console.error("Error removing from cart:", error);
    return { success: false, error: "Failed to remove item from cart" };
  }
}

// Clear entire cart
export async function clearCart() {
  const user = await getCurrentUser();

  if (!user) {
    return { success: false, error: "Please login to clear cart" };
  }

  try {
    const userCart = await db.query.cart.findFirst({
      where: eq(cart.userId, user.id),
    });

    if (userCart) {
      await db.delete(cartItem).where(eq(cartItem.cartId, userCart.id));
    }

    revalidatePath("/");
    return { success: true, message: "Cart cleared" };
  } catch (error) {
    console.error("Error clearing cart:", error);
    return { success: false, error: "Failed to clear cart" };
  }
}
