import * as z from "zod";

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
