import { FULFILLMENT_UNIT_CODES } from "@bikalpo-project/db/fulfillment";
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
  inventoryUnit: z.enum(FULFILLMENT_UNIT_CODES).default("unit"),
  conversionEnabled: z.boolean().default(false),
  inventoryLooseUnitEnabled: z.boolean().default(false),
  inventoryLooseUnit: z.enum(FULFILLMENT_UNIT_CODES).default("kg"),
  isReturnablePack: z.boolean().default(false),
  defaultPackDepositAmount: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, "Use a valid deposit amount")
    .default("0"),
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
