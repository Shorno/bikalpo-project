import { z } from "zod";

export const PACK_TYPES = [
  { value: "sack", label: "Sack" },
  { value: "carton", label: "Carton" },
  { value: "packet", label: "Packet" },
  { value: "loose", label: "Loose" },
  { value: "bottle", label: "Bottle" },
  { value: "can", label: "Can" },
  { value: "jar", label: "Jar" },
  { value: "pouch", label: "Pouch" },
  { value: "box", label: "Box" },
] as const;

export const ORDER_UNITS = [
  { value: "piece", label: "Piece" },
  { value: "kg", label: "KG" },
  { value: "liter", label: "Liter" },
  { value: "pack", label: "Pack" },
] as const;

/** Validates that a string is either empty or a valid number */
const numericString = (label: string) =>
  z
    .string()
    .refine(
      (val) => val === "" || val === undefined || !Number.isNaN(Number(val)),
      { message: `${label} must be a number` },
    );

/** Required numeric string (non-empty + valid number) */
const requiredNumericString = (label: string) =>
  z
    .string()
    .min(1, `${label} is required`)
    .refine((val) => !Number.isNaN(Number(val)), {
      message: `${label} must be a number`,
    });

export const variantFormSchema = z.object({
  // Identity
  sku: z.string().optional(),
  unitLabel: z.string().optional().default(""),
  brandId: z.number().int().optional(),

  // Type & Pack
  variantType: z.enum(["trade", "retail"]).optional(),
  packType: z
    .enum([
      "sack",
      "carton",
      "packet",
      "loose",
      "bottle",
      "can",
      "jar",
      "pouch",
      "box",
    ])
    .optional(),
  weightKg: numericString("Weight").default(""),
  innerPackSizeKg: numericString("Inner pack size"),

  // Pricing
  pricingType: z.string().default("per_unit"),
  price: numericString("Price").default(""),

  // Order Rules
  orderMin: numericString("Order min").default("1"),
  orderMax: numericString("Order max"),
  orderIncrement: numericString("Order increment").default("1"),
  orderUnit: z.string().default("piece"),

  // Status
  isActive: z.boolean().default(true),

  // Open Order & Negotiation (trade only)
  isOpenOrderAllowed: z.boolean().default(false),
  negotiationTimeoutSec: z.number().int().default(100),

  // Margin Rules (trade only)
  minMarginPercent: numericString("Min margin %"),
  minMarginAmount: numericString("Min margin amount"),

  // Pack Return & Deposit (trade only)
  isPackReturnRequired: z.boolean().default(false),
  packDepositAmount: numericString("Pack deposit"),

  // Additional Details
  origin: z.string().optional(),
  shelfLife: z.string().optional(),
  note: z.string().optional(),
  sortOrder: z.number().int().default(0),
}).superRefine((data, ctx) => {
  // Weight is required only for non-loose variants
  if (data.packType !== "loose") {
    if (!data.weightKg || data.weightKg.trim() === "") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Weight is required",
        path: ["weightKg"],
      });
    }
  }

  // Price is required only for non-trade variants
  if (data.variantType !== "trade") {
    if (!data.price || data.price.trim() === "") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Price is required for consumer/retail variants",
        path: ["price"],
      });
    } else if (Number.isNaN(Number(data.price))) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Price must be a number",
        path: ["price"],
      });
    }
  }
});

export type VariantFormValues = z.infer<typeof variantFormSchema>;
