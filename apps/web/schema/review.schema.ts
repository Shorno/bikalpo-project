import * as z from "zod";

export const createReviewSchema = z.object({
  productId: z.number({ message: "Product ID is required." }).int().positive(),
  rating: z
    .number({ message: "Rating is required." })
    .int()
    .min(1, "Rating must be at least 1")
    .max(5, "Rating must be at most 5"),
  title: z
    .string()
    .max(100, "Title must be at most 100 characters.")
    .trim()
    .optional(),
  comment: z
    .string()
    .min(10, "Comment must be at least 10 characters.")
    .max(1000, "Comment must be at most 1000 characters.")
    .trim(),
});

export type CreateReviewFormValues = z.infer<typeof createReviewSchema>;
