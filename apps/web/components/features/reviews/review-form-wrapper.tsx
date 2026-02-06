"use client";

import { ReviewForm } from "./review-form";

interface ReviewFormWrapperProps {
  productId: number;
  variant?: "default" | "emerald";
}

export function ReviewFormWrapper({
  productId,
  variant = "default",
}: ReviewFormWrapperProps) {
  return <ReviewForm productId={productId} variant={variant} />;
}
