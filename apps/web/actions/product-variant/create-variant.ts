"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db/config";
import type {
  BulkRateTier,
  QuantitySelectorOption,
} from "@/db/schema/product-variant";
import { productVariant } from "@/db/schema/product-variant";

export type CreateVariantInput = {
  productId: number;
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

export async function createVariant(input: CreateVariantInput) {
  const [created] = await db
    .insert(productVariant)
    .values({
      productId: input.productId,
      sku: input.sku ?? null,
      unitLabel: input.unitLabel,
      quantitySelectorLabel: input.quantitySelectorLabel ?? null,
      packagingType: input.packagingType,
      weightKg: input.weightKg,
      pieceWeightKg: input.pieceWeightKg ?? null,
      piecesPerUnit: input.piecesPerUnit ?? null,
      pricingType: input.pricingType ?? "per_unit",
      price: input.price,
      orderMin: input.orderMin ?? "1",
      orderMax: input.orderMax ?? null,
      orderIncrement: input.orderIncrement ?? "1",
      orderUnit: input.orderUnit ?? "piece",
      quantitySelectorOptions: input.quantitySelectorOptions ?? [],
      priceTiers: input.priceTiers ?? [],
      stockQuantity: input.stockQuantity ?? 0,
      reorderLevel: input.reorderLevel ?? 0,
      origin: input.origin ?? null,
      shelfLife: input.shelfLife ?? null,
      packagingNote: input.packagingNote ?? null,
      care: input.care ?? null,
      note: input.note ?? null,
      sortOrder: input.sortOrder ?? 0,
    })
    .returning();

  revalidatePath("/dashboard/admin/products");
  return created;
}
