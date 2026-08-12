import { VARIANT_CONTAINERS } from "@bikalpo-project/db/variant-definition";
import { z } from "zod";

const commonUnit = z.string().min(1).max(20).trim();

export const variantDefinitionInputSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("measurement"),
    value: z.string().min(1).max(20).trim(),
    measurementUnit: commonUnit,
    container: z
      .string()
      .refine(
        (value) => Object.hasOwn(VARIANT_CONTAINERS, value),
        "Select a supported container",
      ),
  }),
  z.object({ kind: z.literal("loose"), measurementUnit: commonUnit }),
  z.object({
    kind: z.literal("attribute"),
    attribute: z.string().min(1).max(30).trim(),
    value: z.string().min(1).max(30).trim(),
  }),
]);

export const structuredVariantOptionInputSchema = z.object({
  definition: variantDefinitionInputSchema,
  displayAlias: z.string().max(100).trim().optional(),
  typeId: z.number().int().positive(),
  categoryId: z.number().int().positive().nullable(),
  sortOrder: z.number().int().default(0),
});

export type StructuredVariantOptionInput = z.infer<
  typeof structuredVariantOptionInputSchema
>;
