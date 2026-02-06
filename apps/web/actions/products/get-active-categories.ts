"use server";

import { db } from "@/db/config";

export async function getActiveCategories() {
  return await db.query.category.findMany({
    where: (category, { eq }) => eq(category.isActive, true),
    orderBy: (category, { asc }) => [asc(category.displayOrder)],
  });
}
