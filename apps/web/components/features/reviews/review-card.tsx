"use client";

import type { ReviewWithUser } from "@bikalpo-project/db/schema";
import { formatDistanceToNow } from "date-fns";
import { Loader, Pencil } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useUpdateReview } from "@/hooks/use-customer-api";
import { StarRating } from "./star-rating";

interface ReviewCardProps {
  review: ReviewWithUser;
  canEdit?: boolean;
}

export function ReviewCard({ review, canEdit = false }: ReviewCardProps) {
  const [editOpen, setEditOpen] = useState(false);
  const [rating, setRating] = useState(review.rating);
  const [title, setTitle] = useState(review.title ?? "");
  const [comment, setComment] = useState(review.comment);
  const mutation = useUpdateReview(review.productId);

  useEffect(() => {
    setRating(review.rating);
    setTitle(review.title ?? "");
    setComment(review.comment);
  }, [review.comment, review.rating, review.title]);

  const submitUpdate = () => {
    if (comment.trim().length < 1 || rating < 1) {
      toast.error("Please provide a rating and review.");
      return;
    }

    mutation.mutate(
      {
        reviewId: review.id,
        rating,
        title: title.trim(),
        comment: comment.trim(),
      },
      {
        onSuccess: () => setEditOpen(false),
      },
    );
  };

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
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-500">
                {formatDistanceToNow(new Date(review.updatedAt), {
                  addSuffix: true,
                })}
              </span>
              {canEdit && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-gray-500 hover:text-gray-900"
                  onClick={() => setEditOpen(true)}
                >
                  <Pencil className="mr-1 h-3.5 w-3.5" />
                  Edit
                </Button>
              )}
            </div>
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
          {canEdit &&
            new Date(review.updatedAt).getTime() >
              new Date(review.createdAt).getTime() && (
              <p className="mt-2 text-xs text-gray-400">Edited</p>
            )}
        </div>
      </div>

      {canEdit && (
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit your review</DialogTitle>
              <DialogDescription>
                Update the rating or any part of this review. Other reviews on
                this product will remain unchanged.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <p className="mb-2 text-sm font-medium">Your Rating</p>
                <StarRating
                  rating={rating}
                  size="lg"
                  interactive
                  onRatingChange={setRating}
                />
              </div>
              <div>
                <label
                  className="mb-2 block text-sm font-medium"
                  htmlFor={`review-title-${review.id}`}
                >
                  Review Title (Optional)
                </label>
                <Input
                  id={`review-title-${review.id}`}
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  maxLength={100}
                />
              </div>
              <div>
                <label
                  className="mb-2 block text-sm font-medium"
                  htmlFor={`review-comment-${review.id}`}
                >
                  Your Review
                </label>
                <Textarea
                  id={`review-comment-${review.id}`}
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                  rows={5}
                  maxLength={1000}
                />
                <p className="mt-1 text-xs text-gray-500">
                  {comment.length}/1000 characters
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditOpen(false)}
                disabled={mutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={submitUpdate}
                disabled={mutation.isPending || rating === 0 || !comment.trim()}
              >
                {mutation.isPending && (
                  <Loader className="mr-2 h-4 w-4 animate-spin" />
                )}
                Save changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
