import { db } from "@bikalpo-project/db";
import { variantAttribute } from "@bikalpo-project/db/schema";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { adminProcedure, protectedProcedure } from "../index";

const optionList = z
  .array(z.string().trim().min(1).max(30))
  .max(100)
  .transform((values) => [
    ...new Map(values.map((value) => [value.toLowerCase(), value])).values(),
  ]);

/**
 * Create Product "Variant Attribute" choices. Everyone who
 * creates products reads them; Admin adds attributes and options.
 */
export const variantAttributeRouter = {
  list: protectedProcedure.handler(async () =>
    db.query.variantAttribute.findMany({
      where: eq(variantAttribute.isActive, true),
      orderBy: [asc(variantAttribute.sortOrder), asc(variantAttribute.name)],
      columns: { id: true, name: true, options: true },
    }),
  ),

  /** Add an attribute, or add options to an existing one (case-insensitive). */
  upsert: adminProcedure
    .input(
      z.object({
        name: z.string().trim().min(1).max(50),
        options: optionList.default([]),
      }),
    )
    .handler(async ({ input }) => {
      const existing = (
        await db.query.variantAttribute.findMany({
          columns: { id: true, name: true, options: true },
        })
      ).find((row) => row.name.toLowerCase() === input.name.toLowerCase());
      if (existing) {
        const merged = optionList.parse([...existing.options, ...input.options]);
        const [updated] = await db
          .update(variantAttribute)
          .set({ options: merged, isActive: true, updatedAt: new Date() })
          .where(eq(variantAttribute.id, existing.id))
          .returning({
            id: variantAttribute.id,
            name: variantAttribute.name,
            options: variantAttribute.options,
          });
        return updated!;
      }
      const [created] = await db
        .insert(variantAttribute)
        .values({ name: input.name, options: input.options, sortOrder: 100 })
        .returning({
          id: variantAttribute.id,
          name: variantAttribute.name,
          options: variantAttribute.options,
        });
      return created!;
    }),
};
