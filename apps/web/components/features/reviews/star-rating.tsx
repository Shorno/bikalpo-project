"use client";

import { Star } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface StarRatingProps {
  rating: number;
  maxRating?: number;
  size?: "sm" | "md" | "lg";
  interactive?: boolean;
  onRatingChange?: (rating: number) => void;
}

const sizeClasses = {
  sm: "h-4 w-4",
  md: "h-5 w-5",
  lg: "h-6 w-6",
};

export function StarRating({
  rating,
  maxRating = 5,
  size = "md",
  interactive = false,
  onRatingChange,
}: StarRatingProps) {
  const [hoverRating, setHoverRating] = useState(0);

  return (
    <div
      className="flex items-center gap-0.5"
      onMouseLeave={() => interactive && setHoverRating(0)}
    >
      {Array.from({ length: maxRating }, (_, i) => {
        const starValue = i + 1;
        // Show hover state if hovering, otherwise show actual rating
        const isFilled =
          hoverRating > 0 ? starValue <= hoverRating : starValue <= rating;

        return (
          <button
            key={starValue}
            type="button"
            disabled={!interactive}
            onClick={() => interactive && onRatingChange?.(starValue)}
            onMouseEnter={() => interactive && setHoverRating(starValue)}
            className={cn(
              "transition-all duration-100",
              interactive && "cursor-pointer hover:scale-110",
              !interactive && "cursor-default",
            )}
          >
            <Star
              className={cn(
                sizeClasses[size],
                isFilled
                  ? "fill-yellow-400 text-yellow-400"
                  : "fill-gray-200 text-gray-200",
              )}
            />
          </button>
        );
      })}
    </div>
  );
}
