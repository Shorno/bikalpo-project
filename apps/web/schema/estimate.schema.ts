import * as z from "zod";

// Estimate item schema
export const estimateItemSchema = z.object({
  productId: z.number().int().positive("Product ID is required"),
  productName: z.string().min(1, "Product name is required"),
  productImage: z.url().optional().nullable(),
  quantity: z.number().int().min(1, "Quantity must be at least 1"),
  unitPrice: z.number().min(0, "Unit price must be positive"),
  discount: z.number().min(0).default(0).nonoptional(),
  totalPrice: z.number().min(0, "Total price must be positive"),
});

// Create estimate schema
export const createEstimateSchema = z.object({
  customerIds: z.array(z.string()).min(1, "At least one customer is required"),
  items: z.array(estimateItemSchema).min(1, "At least one item is required"),
  discount: z.number().min(0).default(0).nonoptional(),
  validUntil: z.date().optional().nullable(),
  notes: z.string().optional().nullable(),
});

// Update estimate schema
export const updateEstimateSchema = z.object({
  id: z.number().int().positive("Estimate ID is required"),
  customerId: z.string().min(1, "Customer is required").optional(),
  items: z
    .array(estimateItemSchema)
    .min(1, "At least one item is required")
    .optional(),
  discount: z.number().min(0).optional(),
  validUntil: z.date().optional().nullable(),
  notes: z.string().optional().nullable(),
  status: z
    .enum(["draft", "pending", "sent", "approved", "rejected", "converted"])
    .optional(),
});

// Admin review schema
export const reviewEstimateSchema = z.object({
  estimateId: z.number().int().positive("Estimate ID is required"),
  action: z.enum(["approve", "reject"]),
  notes: z.string().optional(),
});

// Convert to order schema
export const convertEstimateSchema = z.object({
  estimateId: z.number(),
  shippingName: z.string().min(1, "Name is required"),
  shippingPhone: z.string().min(1, "Phone is required"),
  shippingAddress: z.string().min(1, "Address is required"),
  shippingCity: z.string().min(1, "City is required"),
  shippingArea: z.string().optional().nullable(),
  shippingPostalCode: z.string().optional().nullable(),
  customerNote: z.string().optional().nullable(),
});

// Types
export type EstimateItemFormValues = z.infer<typeof estimateItemSchema>;
export type CreateEstimateFormValues = z.infer<typeof createEstimateSchema>;
export type UpdateEstimateFormValues = z.infer<typeof updateEstimateSchema>;
export type ReviewEstimateFormValues = z.infer<typeof reviewEstimateSchema>;
export type ConvertEstimateFormValues = z.infer<typeof convertEstimateSchema>;
