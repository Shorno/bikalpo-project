"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db/config";
import { brand } from "@/db/schema/brand";

export default async function getBrandById(brandId: number) {
  return await db.query.brand.findFirst({
    where: eq(brand.id, brandId),
  });
}
