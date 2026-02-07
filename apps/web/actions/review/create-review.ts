"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { checkAuth } from "@/utils/auth";
import { db } from "@/db/config";
import { order, orderItem } from "@/db/schema/order";
import { productReview } from "@/db/schema/review";
import {
  type CreateReviewFormValues,
  createReviewSchema,
} from "@/schema/review.schema";

export type ActionResult<TData = unknown> =
  | {
      success: true;
      status: number;
      data: TData;
      message?: string;
    }
  | {
      success: false;
      status: number;
      error: string;
      details?: unknown;
    };

export default async function createReview(
  formData: CreateReviewFormValues,
): Promise<ActionResult<CreateReviewFormValues>> {
  const session = await checkAuth();

  if (!session?.user) {
    return {
      success: false,
      status: 401,
      error: "You must be logged in to leave a review",
    };
  }

  try {
    const result = createReviewSchema.safeParse(formData);

    if (!result.success) {
      return {
        success: false,
        status: 400,
        error: "Validation failed",
        details: z.treeifyError(result.error),
      };
    }

    const validData = result.data;

    // Check if user has ordered this product
    const userOrders = await db
      .select({ orderId: order.id })
      .from(order)
      .innerJoin(orderItem, eq(orderItem.orderId, order.id))
      .where(
        and(
          eq(order.userId, session.user.id),
          eq(orderItem.productId, validData.productId),
        ),
      )
      .limit(1);

    if (userOrders.length === 0) {
      return {
        success: false,
        status: 403,
        error: "You can only review products you have ordered",
      };
    }

    // Check if user already reviewed this product
    const existingReview = await db.query.productReview.findFirst({
      where: and(
        eq(productReview.productId, validData.productId),
        eq(productReview.userId, session.user.id),
      ),
    });

    if (existingReview) {
      return {
        success: false,
        status: 409,
        error: "You have already reviewed this product",
      };
    }

    // Create the review
    const newReview = await db
      .insert(productReview)
      .values({
        productId: validData.productId,
        userId: session.user.id,
        rating: validData.rating,
        title: validData.title || null,
        comment: validData.comment,
        isVerifiedPurchase: true,
      })
      .returning();

    revalidatePath(`/products`);

    return {
      success: true,
      status: 201,
      data: {
        ...newReview[0],
        title: newReview[0].title ?? undefined,
      },
      message: "Review submitted successfully",
    };
  } catch (error) {
    console.error("Error creating review:", error);

    return {
      success: false,
      status: 500,
      error: "An unexpected error occurred",
    };
  }
}
