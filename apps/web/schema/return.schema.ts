import * as z from "zod";

// Return item schema
export const returnItemSchema = z.object({
  orderItemId: z.number().int().positive("Order item ID is required"),
  productId: z.number().int().positive("Product ID is required"),
  productName: z.string().min(1, "Product name is required"),
  quantity: z.number().int().min(1, "Quantity must be at least 1"),
  unitPrice: z.string().min(1, "Unit price is required"),
  reason: z.string().optional(),
});

// Create return request schema
export const createReturnSchema = z.object({
  orderId: z.number().int().positive("Order ID is required"),
  reason: z.string().min(1, "Reason is required"),
  returnType: z.enum(["full", "partial"]),
  items: z.array(returnItemSchema).optional(), // Required for partial returns
});

// Returned product item schema (for the form)
export const returnedProductItemSchema = z.object({
  orderItemId: z.number().int().positive("Order item ID is required"),
  productId: z.number().int().positive("Product ID is required"),
  sku: z.string().optional(),
  productName: z.string().min(1, "Product name is required"),
  orderedQty: z.number().int().positive("Ordered quantity is required"),
  deliveredQty: z.number().int().min(0, "Delivered quantity is required"),
  unitPrice: z.string().min(1, "Unit price is required"),
  returnQty: z.number().int().min(1, "Return quantity must be at least 1"),
  reason: z.enum(["damaged", "wrong_item", "defective", "expired", "other"]),
  condition: z.enum(["good", "damaged", "opened", "sealed"]),
  attachment: z.string().optional(), // Single photo URL as proof
});

// Return processing form schema (delivery/salesman side)
export const returnProcessingFormSchema = z.object({
  orderId: z.number().int().positive("Order ID is required"),
  returnedItems: z
    .array(returnedProductItemSchema)
    .min(1, "At least one item must be returned"),
  refundType: z.enum(["cash", "wallet", "adjustment"]),
  additionalCharge: z.string().default("0"),
  notes: z.string().optional(),
  attachments: z.array(z.string()).optional(),
  isDraft: z.boolean().default(false),
});

// Process return schema (admin)
export const processReturnSchema = z.object({
  returnId: z.number().int().positive("Return ID is required"),
  action: z.enum(["approve", "reject"]),
  refundType: z.enum(["cash", "wallet", "adjustment"]).optional(),
  adminNotes: z.string().optional(),
  restockItems: z.boolean().optional(),
});

// Types
export type ReturnItemFormValues = z.infer<typeof returnItemSchema>;
export type CreateReturnFormValues = z.infer<typeof createReturnSchema>;
export type ProcessReturnFormValues = z.infer<typeof processReturnSchema>;
export type ReturnedProductItemFormValues = z.infer<
  typeof returnedProductItemSchema
>;
export type ReturnProcessingFormValues = z.infer<
  typeof returnProcessingFormSchema
>;
