import { formatDistanceToNow } from "date-fns";
import type { ReviewWithUser } from "@/db/schema/review";
import { StarRating } from "./star-rating";

interface ReviewCardProps {
  review: ReviewWithUser;
}

export function ReviewCard({ review }: ReviewCardProps) {
  return (
    <div className="border-b border-gray-100 pb-6 last:border-0">
      <div className="flex items-start gap-4">
        {/* User Avatar */}
        <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 font-semibold shrink-0">
          {review.user.name?.charAt(0).toUpperCase() || "U"}
        </div>

        <div className="flex-1">
          {/* Header */}
          <div className="flex items-center justify-between mb-1">
            <div>
              <span className="font-medium text-gray-900">
                {review.user.name || "Anonymous"}
              </span>
              {review.isVerifiedPurchase && (
                <span className="ml-2 text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                  Verified Purchase
                </span>
              )}
            </div>
            <span className="text-sm text-gray-500">
              {formatDistanceToNow(new Date(review.createdAt), {
                addSuffix: true,
              })}
            </span>
          </div>

          {/* Rating */}
          <div className="flex items-center gap-2 mb-2">
            <StarRating rating={review.rating} size="sm" />
            {review.title && (
              <span className="font-medium text-gray-900">{review.title}</span>
            )}
          </div>

          {/* Comment */}
          <p className="text-gray-600 text-sm leading-relaxed">
            {review.comment}
          </p>
        </div>
      </div>
    </div>
  );
}
