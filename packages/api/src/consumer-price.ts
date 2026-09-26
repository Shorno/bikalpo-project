import { z } from "zod";

export const MAX_PRICE_IMPORT_ROWS = 1000;

// decimal(10, 2), validated before either an inline edit or a workbook import.
export const referencePriceAmountSchema = z
  .string()
  .trim()
  .regex(
    /^\d{1,8}(\.\d{1,2})?$/,
    "Enter a price with at most two decimal places",
  )
  .refine((value) => Number(value) > 0, "Price must be greater than zero");

export const consumerPriceListParamsSchema = z.object({
  search: z.string().max(200).optional(),
  typeId: z.number().int().positive().optional(),
  categoryId: z.number().int().positive().optional(),
  subCategoryId: z.number().int().positive().optional(),
  coreProductId: z.number().int().positive().optional(),
});

export const consumerPriceListPagedSchema =
  consumerPriceListParamsSchema.extend({
    page: z.number().int().min(1).optional(),
    limit: z.number().int().min(1).max(100).optional(),
  });

export const updateConsumerReferencePriceSchema = z
  .object({
    variantPriceId: z.number().int().positive(),
    // The reference price is the full New price for a cylinder.
    consumerPrice: referencePriceAmountSchema,
    exchangePrice: referencePriceAmountSchema.optional(),
  })
  .superRefine((value, ctx) => {
    if (
      value.exchangePrice &&
      priceInMinorUnits(value.exchangePrice) >
        priceInMinorUnits(value.consumerPrice)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["exchangePrice"],
        message: "Exchange price cannot exceed New Cylinder price",
      });
    }
  });

export const importConsumerReferencePricesSchema = z
  .object({
    rows: z
      .array(updateConsumerReferencePriceSchema)
      .min(1)
      .max(MAX_PRICE_IMPORT_ROWS),
  })
  .superRefine(({ rows }, ctx) => {
    const ids = new Set<number>();
    rows.forEach((row, index) => {
      if (ids.has(row.variantPriceId)) {
        ctx.addIssue({
          code: "custom",
          path: ["rows", index, "variantPriceId"],
          message: "Duplicate Variant Price ID",
        });
      }
      ids.add(row.variantPriceId);
    });
  });

export type ConsumerPriceUpdate = z.infer<
  typeof updateConsumerReferencePriceSchema
>;

export function priceInMinorUnits(value: string) {
  const [whole = "0", fraction = ""] = value.split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}

export function priceFromMinorUnits(value: number) {
  return (value / 100).toFixed(2);
}

export function resolveReferencePriceUpdate(
  input: ConsumerPriceUpdate,
  existing: {
    isCylinderPricing: boolean;
    exchangeEnabled: boolean;
    exchangeCreditAmount: string;
  },
) {
  const parsed = updateConsumerReferencePriceSchema.parse(input);
  if (parsed.exchangePrice != null && !existing.isCylinderPricing) {
    throw new Error("Exchange price is only available for cylinder variants");
  }
  const newAmount = priceInMinorUnits(parsed.consumerPrice);
  // Older clients that update only the New price retain the existing credit.
  const credit =
    parsed.exchangePrice != null
      ? newAmount - priceInMinorUnits(parsed.exchangePrice)
      : priceInMinorUnits(existing.exchangeCreditAmount);
  const exchangeEnabled =
    parsed.exchangePrice != null || existing.exchangeEnabled;
  if (exchangeEnabled && credit >= newAmount) {
    throw new Error(
      "New Cylinder price must exceed the existing exchange credit; enter an Exchange price too",
    );
  }
  return {
    consumerPrice: priceFromMinorUnits(newAmount),
    exchangeEnabled,
    exchangeCreditAmount: priceFromMinorUnits(credit),
    exchangePrice: exchangeEnabled
      ? priceFromMinorUnits(newAmount - credit)
      : null,
  };
}
