import * as z from "zod";

export const createCategorySchema = z.object({
  name: z
    .string()
    .min(2, "Category name must be at least 2 characters.")
    .max(100, "Category name must be at most 100 characters.")
    .trim(),
  slug: z
    .string()
    .min(2, "Slug must be at least 2 characters.")
    .max(100, "Slug must be at most 100 characters.")
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Slug must contain only lowercase letters, numbers, and hyphens (e.g., 'my-categories')",
    )
    .trim(),
  image: z
    .string()
    .max(255, "Image URL must be at most 255 characters.")
    .optional(),
  isActive: z.boolean().default(true).optional(),
  displayOrder: z
    .number()
    .int("Display order must be a whole number.")
    .min(0, "Display order must be 0 or greater.")
    .default(0)
    .optional(),
  typeId: z.number().int().nullable().optional(),
});

export const createSubcategorySchema = createCategorySchema.extend({
  categoryId: z
    .number({ error: "Category ID is required." })
    .int()
    .nonoptional(),
});

export const createNewCategorySchema = createCategorySchema.extend({
  typeId: z.number({ error: "Product Type is required." }).int().nonoptional(),
});

export const updateCategorySchema = createCategorySchema.extend({
  id: z.number({ error: "Category ID is required." }).int().nonoptional(),
});
export const updateSubcategorySchema = createSubcategorySchema.extend({
  id: z.number({ error: "Subcategory ID is required." }).int().nonoptional(),
});

export type CreateCategoryFormValues = z.infer<typeof createCategorySchema>;
export type CreateSubcategoryFormValues = z.infer<
  typeof createSubcategorySchema
>;
export type UpdateCategoryFormValues = z.infer<typeof updateCategorySchema>;
export type UpdateSubcategoryFormValues = z.infer<
  typeof updateSubcategorySchema
>;
