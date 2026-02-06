import { z } from "zod";

// Customer submit request schema
export const createItemRequestSchema = z.object({
  itemName: z.string().min(2, "Item name must be at least 2 characters"),
  brand: z.string().optional(),
  category: z.string().optional(),
  quantity: z.number().min(1, "Quantity must be at least 1").default(1),
  description: z.string().optional(),
  image: z.string().optional(), // Cloudinary image URL
});

export type CreateItemRequestFormValues = z.infer<
  typeof createItemRequestSchema
>;

// Admin process request schema
export const processItemRequestSchema = z.object({
  requestId: z.number(),
  status: z.enum(["approved", "rejected", "suggested"]),
  adminResponse: z.string().optional(),
  suggestedProductId: z.number().optional(),
  addToProductId: z.number().optional(), // required when status is "approved"
});

export type ProcessItemRequestFormValues = z.infer<
  typeof processItemRequestSchema
>;

// Filter schema for listing
export const itemRequestFilterSchema = z.object({
  status: z
    .enum(["all", "pending", "approved", "rejected", "suggested"])
    .optional(),
  search: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(10),
});

export type ItemRequestFilterValues = z.infer<typeof itemRequestFilterSchema>;
