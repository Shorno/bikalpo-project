"use server";

import { db } from "@/db/config";

export default async function getCategoryWithSubcategory() {
  return await db.query.category.findMany({
    with: {
      subCategory: true,
    },
  });
}
