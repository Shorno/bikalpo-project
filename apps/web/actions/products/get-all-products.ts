"use server";
import { db } from "@/db/config";

export default async function getAllProducts() {
  return await db.query.product.findMany({
    with: {
      category: {
        columns: {
          name: true,
          slug: true,
        },
      },
    },
  });
}
