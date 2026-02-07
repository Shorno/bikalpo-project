"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { checkAuth } from "@/utils/auth";
import { db } from "@/db/config";
import { productReview } from "@/db/schema/review";

export default async function deleteReview(reviewId: number) {
  const session = await checkAuth();

  if (!session?.user) {
    return {
      success: false,
      status: 401,
      error: "You must be logged in",
    };
  }

  try {
    // Check if review exists and belongs to user
    const review = await db.query.productReview.findFirst({
      where: eq(productReview.id, reviewId),
    });

    if (!review) {
      return {
        success: false,
        status: 404,
        error: "Review not found",
      };
    }

    // Allow deletion if user owns the review or is admin
    if (review.userId !== session.user.id && session.user.role !== "admin") {
      return {
        success: false,
        status: 403,
        error: "You can only delete your own reviews",
      };
    }

    await db.delete(productReview).where(eq(productReview.id, reviewId));

    revalidatePath("/products");

    return {
      success: true,
      status: 200,
      message: "Review deleted successfully",
    };
  } catch (error) {
    console.error("Error deleting review:", error);

    return {
      success: false,
      status: 500,
      error: "An unexpected error occurred",
    };
  }
}
