import * as z from "zod";

export const createBrandSchema = z.object({
  name: z
    .string()
    .min(2, "Brand name must be at least 2 characters.")
    .max(100, "Brand name must be at most 100 characters.")
    .trim(),
  slug: z
    .string()
    .min(2, "Slug must be at least 2 characters.")
    .max(100, "Slug must be at most 100 characters.")
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Slug must contain only lowercase letters, numbers, and hyphens (e.g., 'my-brand')",
    )
    .trim(),
  logo: z
    .string()
    .max(255, "Logo URL must be at most 255 characters.")
    .optional(),
  isActive: z.boolean().default(true).optional(),
  displayOrder: z
    .number()
    .int("Display order must be a whole number.")
    .min(0, "Display order must be 0 or greater.")
    .default(0)
    .optional(),
});

export const updateBrandSchema = createBrandSchema.extend({
  id: z.number({ error: "Brand ID is required." }).int().nonoptional(),
});

export type CreateBrandFormValues = z.infer<typeof createBrandSchema>;
export type UpdateBrandFormValues = z.infer<typeof updateBrandSchema>;
