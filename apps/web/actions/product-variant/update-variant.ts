"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db/config";
import type {
  BulkRateTier,
  QuantitySelectorOption,
} from "@/db/schema/product-variant";
import { productVariant } from "@/db/schema/product-variant";

export type UpdateVariantInput = {
  id: number;
  sku?: string;
  unitLabel: string;
  quantitySelectorLabel?: string;
  packagingType: string;
  weightKg: string;
  pieceWeightKg?: string;
  piecesPerUnit?: number;
  pricingType?: string;
  price: string;
  orderMin?: string;
  orderMax?: string;
  orderIncrement?: string;
  orderUnit?: string;
  quantitySelectorOptions?: QuantitySelectorOption[];
  priceTiers?: BulkRateTier[];
  stockQuantity?: number;
  reorderLevel?: number;
  origin?: string;
  shelfLife?: string;
  packagingNote?: string;
  care?: string;
  note?: string;
  sortOrder?: number;
};

export async function updateVariant(input: UpdateVariantInput) {
  const { id, ...rest } = input;
  await db
    .update(productVariant)
    .set({
      ...rest,
      quantitySelectorLabel: rest.quantitySelectorLabel ?? null,
      priceTiers: rest.priceTiers ?? [],
      pieceWeightKg: rest.pieceWeightKg ?? null,
      piecesPerUnit: rest.piecesPerUnit ?? null,
      orderMax: rest.orderMax ?? null,
      origin: rest.origin ?? null,
      shelfLife: rest.shelfLife ?? null,
      packagingNote: rest.packagingNote ?? null,
      care: rest.care ?? null,
      note: rest.note ?? null,
    })
    .where(eq(productVariant.id, id));

  revalidatePath("/dashboard/admin/products");
}
