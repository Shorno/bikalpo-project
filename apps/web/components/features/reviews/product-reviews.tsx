import { Star } from "lucide-react";
import {
  getProductReviewStats,
  getReviewsByProductId,
} from "@/actions/review/get-reviews";
import { checkAuth } from "@/app/(dashboard)/dashboard/admin/_actions/auth/checkAuth";
import { ReviewCard } from "./review-card";
import { ReviewFormWrapper } from "./review-form-wrapper";
import { StarRating } from "./star-rating";

interface ProductReviewsProps {
  productId: number;
  variant?: "default" | "emerald";
}

export async function ProductReviews({
  productId,
  variant = "default",
}: ProductReviewsProps) {
  const [reviews, stats, session] = await Promise.all([
    getReviewsByProductId(productId),
    getProductReviewStats(productId),
    checkAuth(),
  ]);

  const isLoggedIn = !!session?.user;
  const userId = session?.user?.id;
  const isEmerald = variant === "emerald";

  const userHasReviewed = userId
    ? reviews.some((r) => r.userId === userId)
    : false;

  const canReview = isLoggedIn && !userHasReviewed;

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
        {canReview && (
          <div className="mb-8">
            <ReviewFormWrapper productId={productId} variant={variant} />
          </div>
        )}

        {!isLoggedIn && (
          <div
            className={`${isEmerald ? "bg-emerald-50 text-emerald-700" : "bg-blue-50 text-blue-700"} px-4 py-3 rounded-lg mb-6 text-sm`}
          >
            Please log in to leave a review.
          </div>
        )}

        {isLoggedIn && userHasReviewed && (
          <div className="bg-green-50 text-green-700 px-4 py-3 rounded-lg mb-6 text-sm">
            Thank you! You have already reviewed this product.
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
            <ReviewCard key={review.id} review={review} />
          ))
        )}
      </div>
    </div>
  );
}
