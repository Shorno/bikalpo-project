"use client";

import { Star } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useProductReviews } from "@/hooks/use-customer-api";
import { authClient } from "@/lib/auth-client";
import { ReviewCard } from "./review-card";
import { ReviewFormWrapper } from "./review-form-wrapper";
import { StarRating } from "./star-rating";

interface ProductReviewsProps {
  productId: number;
  variant?: "default" | "emerald";
  readOnly?: boolean;
}

export function ProductReviews({
  productId,
  variant = "default",
  readOnly = false,
}: ProductReviewsProps) {
  const { data: reviewData, isLoading } = useProductReviews(productId);
  const { data: session, isPending: isSessionPending } =
    authClient.useSession();

  if (isLoading) {
    return (
      <div className="mt-12 rounded-lg bg-white p-6 shadow-sm lg:p-8">
        <Skeleton className="mb-6 h-8 w-48" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  const reviews = reviewData?.reviews ?? [];
  const stats = reviewData?.stats ?? { averageRating: 0, totalReviews: 0 };
  const isLoggedIn = !!session?.user;
  const userId = session?.user?.id;
  const isEmerald = variant === "emerald";

  const canReview = !readOnly && isLoggedIn;

  return (
    <div className="mt-12 bg-white rounded-lg shadow-sm p-6 lg:p-8">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Customer Reviews
        </h2>

        {/* Rating Summary */}
        <div className="flex items-center gap-4 mb-6">
          <div className="flex items-center gap-2">
            <span className="text-4xl font-bold text-gray-900">
              {stats.averageRating.toFixed(1)}
            </span>
            <div>
              <StarRating rating={Math.round(stats.averageRating)} size="md" />
              <p className="text-sm text-gray-500 mt-1">
                {stats.totalReviews}{" "}
                {stats.totalReviews === 1 ? "review" : "reviews"}
              </p>
            </div>
          </div>
        </div>

        {/* Review Form */}
        {readOnly && (
          <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Reviews are visible, but submitting a review is disabled in customer
            preview.
          </div>
        )}

        {canReview && (
          <div className="mb-8">
            <ReviewFormWrapper productId={productId} variant={variant} />
          </div>
        )}

        {!readOnly && !isSessionPending && !isLoggedIn && (
          <div
            className={`${isEmerald ? "bg-emerald-50 text-emerald-700" : "bg-blue-50 text-blue-700"} px-4 py-3 rounded-lg mb-6 text-sm`}
          >
            Please log in to leave a review.
          </div>
        )}
      </div>

      {/* Reviews List */}
      <div className="space-y-6">
        {reviews.length === 0 ? (
          <div className="text-center py-12">
            <Star className="h-12 w-12 text-gray-200 mx-auto mb-4" />
            <p className="text-gray-500 text-lg mb-2">No reviews yet</p>
            <p className="text-gray-400 text-sm">
              Be the first to review this product
            </p>
          </div>
        ) : (
          reviews.map((review) => (
            <ReviewCard
              key={review.id}
              review={review}
              canEdit={!readOnly && review.userId === userId}
            />
          ))
        )}
      </div>
    </div>
  );
}
