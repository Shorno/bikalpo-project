"use server";

import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db/config";
import { category } from "@/db/schema/category";
import { order, orderItem } from "@/db/schema/order";
import { product } from "@/db/schema/product";

export type CustomerProduct = {
  productId: number;
  productName: string;
  productImage: string;
  productSize: string;
  categoryName: string | null;
  totalQuantity: number;
  totalOrders: number;
  lastOrderedAt: Date;
};

export async function getCustomerProducts(customerId: string) {
  try {
    // Get all products ordered by this customer, aggregated
    const products = await db
      .select({
        productId: orderItem.productId,
        productName: orderItem.productName,
        productImage: orderItem.productImage,
        productSize: orderItem.productSize,
        totalQuantity: sql<number>`SUM(${orderItem.quantity})::int`,
        totalOrders: sql<number>`COUNT(DISTINCT ${orderItem.orderId})::int`,
        lastOrderedAt: sql<Date>`MAX(${order.createdAt})`,
        categoryId: product.categoryId,
      })
      .from(orderItem)
      .innerJoin(order, eq(orderItem.orderId, order.id))
      .innerJoin(product, eq(orderItem.productId, product.id))
      .where(eq(order.userId, customerId))
      .groupBy(
        orderItem.productId,
        orderItem.productName,
        orderItem.productImage,
        orderItem.productSize,
        product.categoryId,
      )
      .orderBy(desc(sql`MAX(${order.createdAt})`))
      .limit(20);

    // Get category names for the products
    const categoryIds = [
      ...new Set(products.map((p) => p.categoryId).filter(Boolean)),
    ];

    let categoryMap: Record<number, string> = {};
    if (categoryIds.length > 0) {
      const categories = await db
        .select({ id: category.id, name: category.name })
        .from(category)
        .where(
          sql`${category.id} IN (${sql.join(
            categoryIds.map((id) => sql`${id}`),
            sql`, `,
          )})`,
        );

      categoryMap = Object.fromEntries(categories.map((c) => [c.id, c.name]));
    }

    // Combine data
    const productsWithCategory: CustomerProduct[] = products.map((p) => ({
      productId: p.productId,
      productName: p.productName,
      productImage: p.productImage,
      productSize: p.productSize,
      categoryName: p.categoryId ? categoryMap[p.categoryId] || null : null,
      totalQuantity: Number(p.totalQuantity) || 0,
      totalOrders: Number(p.totalOrders) || 0,
      lastOrderedAt: p.lastOrderedAt,
    }));

    return {
      success: true,
      data: productsWithCategory,
    };
  } catch (error) {
    console.error("Error fetching customer products:", error);
    return {
      success: false,
      error: "Failed to fetch customer products",
      data: [],
    };
  }
}
