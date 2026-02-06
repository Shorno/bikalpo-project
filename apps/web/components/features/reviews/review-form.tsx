"use client";

import { useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import createReview from "@/actions/review/create-review";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createReviewSchema } from "@/schema/review.schema";
import { StarRating } from "./star-rating";

interface ReviewFormProps {
  productId: number;
  onSuccess?: () => void;
  variant?: "default" | "emerald";
}

export function ReviewForm({
  productId,
  onSuccess,
  variant = "default",
}: ReviewFormProps) {
  const [rating, setRating] = useState(0);
  const queryClient = useQueryClient();
  const isEmerald = variant === "emerald";

  const mutation = useMutation({
    mutationFn: createReview,
    onSuccess: (result) => {
      if (!result.success) {
        switch (result.status) {
          case 401:
            toast.error("You must be logged in to leave a review.");
            break;
          case 403:
            toast.error("You can only review products you have ordered.");
            break;
          case 409:
            toast.error("You have already reviewed this product.");
            break;
          default:
            toast.error(result.error || "Something went wrong.");
        }
        return;
      }
      queryClient.invalidateQueries({
        queryKey: ["product-reviews", productId],
      });
      toast.success("Review submitted successfully!");
      form.reset();
      setRating(0);
      onSuccess?.();
    },
    onError: () => {
      toast.error("An unexpected error occurred.");
    },
  });

  const form = useForm({
    defaultValues: {
      productId: productId,
      rating: 0,
      title: "",
      comment: "",
    },
    validators: {
      //@ts-expect-error
      onSubmit: createReviewSchema,
    },
    onSubmit: async ({ value }) => {
      mutation.mutate({ ...value, rating });
    },
  });

  return (
    <div className="bg-gray-50 rounded-lg p-6">
      <h3 className="text-lg font-semibold mb-4">Write a Review</h3>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          form.handleSubmit();
        }}
        className="space-y-4"
      >
        {/* Rating */}
        <Field>
          <FieldLabel>Your Rating *</FieldLabel>
          <div className="flex items-center gap-3">
            <StarRating
              rating={rating}
              size="lg"
              interactive
              onRatingChange={(newRating) => {
                setRating(newRating);
                form.setFieldValue("rating", newRating);
              }}
            />
            <span className="text-sm text-gray-500">
              {rating > 0 ? `${rating} out of 5` : "Click to rate"}
            </span>
          </div>
          {rating === 0 && (
            <p className="text-sm text-red-500 mt-1">Please select a rating</p>
          )}
        </Field>

        {/* Title */}
        <form.Field name="title">
          {(field) => (
            <Field>
              <FieldLabel htmlFor={field.name}>
                Review Title (Optional)
              </FieldLabel>
              <Input
                id={field.name}
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                placeholder="Summarize your experience"
                maxLength={100}
                className={isEmerald ? "focus-visible:ring-emerald-500" : ""}
              />
            </Field>
          )}
        </form.Field>

        {/* Comment */}
        <form.Field name="comment">
          {(field) => {
            const isInvalid =
              field.state.meta.isTouched && !field.state.meta.isValid;
            return (
              <Field data-invalid={isInvalid}>
                <FieldLabel htmlFor={field.name}>Your Review *</FieldLabel>
                <Textarea
                  id={field.name}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="Share your experience with this product..."
                  rows={4}
                  maxLength={1000}
                  className={isEmerald ? "focus-visible:ring-emerald-500" : ""}
                />
                <FieldDescription>
                  {field.state.value.length}/1000 characters
                </FieldDescription>
                {isInvalid && <FieldError errors={field.state.meta.errors} />}
              </Field>
            );
          }}
        </form.Field>

        <Button
          type="submit"
          disabled={mutation.isPending || rating === 0}
          className={`w-full sm:w-auto ${isEmerald ? "bg-emerald-600 hover:bg-emerald-700" : ""}`}
        >
          {mutation.isPending && (
            <Loader className="mr-2 h-4 w-4 animate-spin" />
          )}
          Submit Review
        </Button>
      </form>
    </div>
  );
}
