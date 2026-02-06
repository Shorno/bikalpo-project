"use server";

import { db } from "@/db/config";

export async function getCategoryBySlug(slug: string) {
  return await db.query.category.findFirst({
    where: (category, { eq, and }) =>
      and(eq(category.slug, slug), eq(category.isActive, true)),
  });
}
