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
  brandIds: z.array(z.number().int()).optional(),

  // These fields are auto-managed (synced from variants)
  size: z.string().max(50).default("—").optional(),
  price: z.string().default("0").optional(),
  stockQuantity: z.number().int().min(0).default(0).optional(),
  sku: z.string().max(100).trim().optional(),
  reorderLevel: z.number().int().min(0).default(0).optional(),
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

  // === New fields for Core Identity-driven flow ===
  coreProductId: z.number().int().optional().nullable(),
  shortDescription: z.string().optional().nullable(),
  videoUrl: z.string().optional().nullable(),
  // Behavior settings
  trackingType: z.enum(["none", "batch", "serial"]).default("none"),
  expiryEnabled: z.boolean().default(false),
  damageControlEnabled: z.boolean().default(false),
  isReturnablePack: z.boolean().default(false),
  // Delivery
  deliveryCostPerCarton: z.string().optional().nullable(),
  // Visibility / publish
  visibility: z.enum(["public", "private"]).default("public"),
  status: z.enum(["active", "inactive", "draft"]).default("active"),
  scheduledAt: z.string().optional().nullable(),
  // Variant prices (per-variant settings)
  variantPrices: z.array(z.object({
    variantOptionId: z.number().int(),
    variantType: z.enum(["trade", "retail"]).optional().nullable(),
    consumerPrice: z.string().default("0"),
    pricingType: z.enum(["per_unit", "bulk_rate"]).default("per_unit"),
    orderMin: z.string().optional().nullable(),
    orderMax: z.string().optional().nullable(),
    orderIncrement: z.string().optional().nullable(),
    orderUnit: z.string().optional().nullable(),
    minMarginPercent: z.string().optional().nullable(),
    minMarginAmount: z.string().optional().nullable(),
    isPackReturnRequired: z.boolean().default(false),
    packDepositAmount: z.string().optional().nullable(),
    // Conversion (trade only)
    linkedRetailVariantOptionId: z.number().int().optional().nullable(),
    conversionRatio: z.string().optional().nullable(),
    conversionLossPercent: z.string().optional().nullable(),
    autoConvert: z.boolean().default(true),
  })).optional(),
});

export const updateProductSchema = createProductSchema.extend({
  id: z.number({ error: "Product ID is required." }).int().positive(),
});

export type CreateProductFormValues = z.infer<typeof createProductSchema>;
export type UpdateProductFormValues = z.infer<typeof updateProductSchema>;
