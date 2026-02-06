"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db/config";
import { category } from "@/db/schema/category";

export async function getCategoriesForSelect() {
  return await db.query.category.findMany({
    where: eq(category.isActive, true),
    with: {
      subCategory: {
        where: (subCategory, { eq }) => eq(subCategory.isActive, true),
      },
    },
    orderBy: (category, { asc }) => [asc(category.displayOrder)],
  });
}
