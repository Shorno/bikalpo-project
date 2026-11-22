import { FULFILLMENT_UNIT_CODES } from "@bikalpo-project/db/fulfillment";
import { DELIVERY_COST_UNIT_CODES } from "@bikalpo-project/db/product-delivery";
import * as z from "zod";

const featureGroupSchema = z.object({
  title: z.string().trim().min(1, "Feature group title is required"),
  items: z
    .array(
      z.object({
        key: z.string().trim().min(1, "Feature name is required"),
        value: z.string().trim().min(1, "Feature value is required"),
      }),
    )
    .min(1, "Add at least one feature"),
});

export const coreProductTemplateSchema = z.object({
  name: z.string().trim().min(1, "Display name is required").max(120),
  description: z.string().optional().nullable(),
  shortDescription: z.string().max(500).optional().nullable(),
  videoUrl: z.string().max(500).optional().nullable(),
  image: z.string().min(1, "Main image is required"),
  additionalImages: z.array(z.string()).max(6).default([]),
  features: z.array(featureGroupSchema).default([]),
  trackingType: z.enum(["none", "batch", "serial"]).default("none"),
  returnPolicyEnabled: z.boolean().default(true),
  expiryEnabled: z.boolean().default(false),
  damageControlEnabled: z.boolean().default(false),
  stockTrackingEnabled: z.boolean().default(true),
  minimumOrderEnabled: z.boolean().default(true),
  minimumOrderQty: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, "Use a valid minimum quantity")
    .default("1"),
  conversionEnabled: z.boolean().default(false),
  inventoryLooseUnitEnabled: z.boolean().default(false),
  inventoryLooseUnit: z.enum(FULFILLMENT_UNIT_CODES).default("kg"),
  isReturnablePack: z.boolean().default(false),
  defaultPackDepositAmount: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, "Use a valid deposit amount")
    .default("0"),
  // Delivery Configuration: unit ("" = from the variant Type) and cost.
  deliveryCostUnit: z
    .enum(DELIVERY_COST_UNIT_CODES)
    .or(z.literal(""))
    .optional()
    .default(""),
  defaultDeliveryCost: z
    .string()
    .regex(/^(\d{1,8}(\.\d{1,2})?)?$/, "Use a valid delivery cost")
    .optional()
    .default(""),
  visibility: z.enum(["public", "private"]).default("public"),
});

export const coreProductBrandConfigSchema = z.object({
  brandId: z.number().int().positive(),
  variants: z
    .array(
      z.object({
        variantOptionId: z.number().int().positive(),
        consumerPrice: z
          .string()
          .regex(/^\d+(\.\d{1,2})?$/, "Enter a valid reference price"),
        // Seller Pricing: New price and, for cylinders, Exchange price.
        retailPrice: z.string().optional(),
        exchangePrice: z.string().optional(),
        // Filled in on save from the prices above.
        exchangeEnabled: z.boolean().optional(),
        exchangeCreditAmount: z.string().optional(),
      }),
    )
    .min(1, "Select at least one variant for every brand"),
});

export const coreProductConfigSchema = z
  .object({
    template: coreProductTemplateSchema,
    brands: z
      .array(coreProductBrandConfigSchema)
      .min(1, "Add at least one brand"),
  })
  .superRefine((value, context) => {
    const brandIds = value.brands.map((brand) => brand.brandId);
    if (new Set(brandIds).size !== brandIds.length) {
      context.addIssue({
        code: "custom",
        message: "A brand can only be added once",
        path: ["brands"],
      });
    }

    value.brands.forEach((brand, index) => {
      const optionIds = brand.variants.map(
        (variant) => variant.variantOptionId,
      );
      if (new Set(optionIds).size !== optionIds.length) {
        context.addIssue({
          code: "custom",
          message: "A variant can only be selected once",
          path: ["brands", index, "variants"],
        });
      }
    });
  });

export type CoreProductConfigValues = z.infer<typeof coreProductConfigSchema>;
