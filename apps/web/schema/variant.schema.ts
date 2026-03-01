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

export const PACKAGING_TYPES = [
    { value: "loose", label: "Loose" },
    { value: "carton", label: "Carton" },
    { value: "sack", label: "Sack" },
    { value: "packet", label: "Packet" },
    { value: "bottle", label: "Bottle" },
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
    z.string().refine(
        (val) => val === "" || val === undefined || !isNaN(Number(val)),
        { message: `${label} must be a number` },
    );

/** Required numeric string (non-empty + valid number) */
const requiredNumericString = (label: string) =>
    z.string().min(1, `${label} is required`).refine(
        (val) => !isNaN(Number(val)),
        { message: `${label} must be a number` },
    );

export const variantFormSchema = z.object({
    // Identity
    sku: z.string().optional(),
    unitLabel: z.string().min(1, "Unit label is required"),
    quantitySelectorLabel: z.string().optional(),

    // Type & Packaging
    variantType: z.enum(["trade", "retail"]).optional(),
    packType: z
        .enum(["sack", "carton", "packet", "loose", "bottle", "can", "jar", "pouch", "box"])
        .optional(),
    packagingType: z.string().min(1, "Packaging type is required"),
    weightKg: requiredNumericString("Weight"),
    pieceWeightKg: numericString("Piece weight"),
    piecesPerUnit: z.number().int().optional(),

    // Pack Structure
    sellUnit: z.string().optional(),
    packWeightKg: numericString("Pack weight"),
    innerPackSizeKg: numericString("Inner pack size"),
    packCountInside: z.number().int().optional(),

    // Pricing
    pricingType: z.string().default("per_unit"),
    price: requiredNumericString("Price"),

    // Order Rules
    orderMin: numericString("Order min").default("1"),
    orderMax: numericString("Order max"),
    orderIncrement: numericString("Order increment").default("1"),
    orderUnit: z.string().default("piece"),

    // Inventory
    stockQuantity: z.number().int().default(0),
    reorderLevel: z.number().int().default(0),

    // Visibility & Access
    orderType: z.enum(["b2b", "b2c"]).optional(),
    visibilityRole: z.enum(["shop_owner", "consumer", "all"]).optional(),
    isActive: z.boolean().default(true),

    // Open Order & Negotiation
    isOpenOrderAllowed: z.boolean().default(false),
    negotiationTimeoutSec: z.number().int().default(100),

    // Margin Rules
    minMarginPercent: numericString("Min margin %"),
    minMarginAmount: numericString("Min margin amount"),

    // Pack Return & Deposit
    isPackReturnRequired: z.boolean().default(false),
    packDepositAmount: numericString("Pack deposit"),

    // Additional Details
    origin: z.string().optional(),
    shelfLife: z.string().optional(),
    packagingNote: z.string().optional(),
    care: z.string().optional(),
    note: z.string().optional(),
    sortOrder: z.number().int().default(0),
});

export type VariantFormValues = z.infer<typeof variantFormSchema>;
