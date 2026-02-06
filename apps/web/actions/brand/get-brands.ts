"use server";

import { asc } from "drizzle-orm";
import { db } from "@/db/config";
import { brand } from "@/db/schema/brand";

export default async function getBrands() {
  return await db.query.brand.findMany({
    orderBy: [asc(brand.displayOrder)],
  });
}

export async function getActiveBrands() {
  return await db.query.brand.findMany({
    where: (brand, { eq }) => eq(brand.isActive, true),
    orderBy: [asc(brand.displayOrder)],
  });
}
