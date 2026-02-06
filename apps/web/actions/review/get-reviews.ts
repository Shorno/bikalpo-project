"use server";

import { avg, count, desc, eq } from "drizzle-orm";
import { db } from "@/db/config";
import { productReview } from "@/db/schema/review";

export async function getReviewsByProductId(productId: number) {
  return await db.query.productReview.findMany({
    where: eq(productReview.productId, productId),
    with: {
      user: {
        columns: {
          id: true,
          name: true,
          image: true,
        },
      },
    },
    orderBy: [desc(productReview.createdAt)],
  });
}

export async function getProductReviewStats(productId: number) {
  const result = await db
    .select({
      averageRating: avg(productReview.rating),
      totalReviews: count(productReview.id),
    })
    .from(productReview)
    .where(eq(productReview.productId, productId));

  return {
    averageRating: result[0]?.averageRating
      ? parseFloat(result[0].averageRating)
      : 0,
    totalReviews: result[0]?.totalReviews || 0,
  };
}

export async function hasUserReviewedProduct(
  productId: number,
  userId: string,
) {
  const review = await db.query.productReview.findFirst({
    where: (r, { and, eq }) =>
      and(eq(r.productId, productId), eq(r.userId, userId)),
    columns: { id: true },
  });

  return !!review;
}

export async function canUserReviewProduct(productId: number, userId: string) {
  // Check if user has ordered this product
  const orderWithProduct = await db.query.orderItem.findFirst({
    where: eq(productReview.productId, productId),
    with: {
      order: {
        columns: { userId: true },
      },
    },
  });

  if (!orderWithProduct || orderWithProduct.order.userId !== userId) {
    return false;
  }

  // Check if user already reviewed
  const hasReviewed = await hasUserReviewedProduct(productId, userId);

  return !hasReviewed;
}
