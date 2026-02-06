import * as z from "zod";

// Feature item schema (key-value pair)
const featureItemSchema = z.object({
  key: z
    .string()
    .min(1, "Key is required")
    .max(100, "Key must be at most 100 characters"),
  value: z
    .string()
    .min(1, "Value is required")
    .max(500, "Value must be at most 500 characters"),
});

// Feature group schema (title + items)
const featureGroupSchema = z.object({
  title: z
    .string()
    .min(1, "Title is required")
    .max(100, "Title must be at most 100 characters"),
  items: z
    .array(featureItemSchema)
    .min(1, "At least one feature item is required"),
});

export const createProductSchema = z.object({
  name: z
    .string()
    .min(2, "Product name must be at least 2 characters.")
    .max(150, "Product name must be at most 150 characters.")
    .trim(),
  slug: z
    .string()
    .min(2, "Slug must be at least 2 characters.")
    .max(150, "Slug must be at most 150 characters.")
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Slug must contain only lowercase letters, numbers, and hyphens (e.g., 'my-product')",
    )
    .trim(),
  description: z.string().optional(),
  categoryId: z
    .number({ error: "Category is required." })
    .int()
    .positive("Please select a valid categories."),
  subCategoryId: z
    .union([z.number().int().positive(), z.undefined()])
    .optional(),
  brandId: z.union([z.number().int().positive(), z.undefined()]).optional(),
  size: z
    .string()
    .min(1, "Size is required.")
    .max(50, "Size must be at most 50 characters.")
    .trim(),
  price: z
    .string()
    .regex(
      /^\d+(\.\d{1,2})?$/,
      "Price must be a valid number with up to 2 decimal places.",
    )
    .refine((val) => parseFloat(val) > 0, "Price must be greater than 0."),
  stockQuantity: z
    .number()
    .int("Stock quantity must be a whole number.")
    .min(0, "Stock quantity cannot be negative.")
    .default(0),
  sku: z
    .string()
    .max(100, "SKU must be at most 100 characters.")
    .trim()
    .optional(),
  reorderLevel: z
    .number()
    .int("Reorder level must be a whole number.")
    .min(0, "Reorder level cannot be negative.")
    .default(0)
    .optional(),
  supplier: z.string().max(500).trim().optional(),
  image: z
    .url("Please enter a valid image URL.")
    .max(255, "Image URL must be at most 255 characters."),
  additionalImages: z
    .array(z.url("Please enter a valid image URL."))
    .max(6, "You can upload a maximum of 6 additional images.")
    .default([]),
  features: z.array(featureGroupSchema).default([]),
  inStock: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
});

export const updateProductSchema = createProductSchema.extend({
  id: z.number({ error: "Product ID is required." }).int().positive(),
});

export type CreateProductFormValues = z.infer<typeof createProductSchema>;
export type UpdateProductFormValues = z.infer<typeof updateProductSchema>;
