/**
 * Option lists from the client's Create Product layout
 * (Bikalpo_Product_Management_Variant_MultiSelect.html). Codes are stored;
 * labels are what the client's form shows.
 */

/** Inventory & Product Rules → Inventory Unit. */
export const INVENTORY_UNITS = {
  pcs: "Piece (PCS)",
  unit: "Unit (UNIT)",
  pack: "Pack (PACK)",
  pkt: "Packet (PKT)",
  box: "Box (BOX)",
  ctn: "Carton (CTN)",
  set: "Set (SET)",
  pr: "Pair (PR)",
  doz: "Dozen (DOZ)",
  bdl: "Bundle (BDL)",
  bag: "Bag (BAG)",
  sack: "Sack (SACK)",
  btl: "Bottle (BTL)",
  jar: "Jar (JAR)",
  can: "Can (CAN)",
  tin: "Tin (TIN)",
  roll: "Roll (ROLL)",
  m: "Meter (M)",
  ft: "Feet (FT)",
  kg: "Kilogram (KG)",
  g: "Gram (G)",
  l: "Litre (L)",
  ml: "Millilitre (ML)",
  cyl: "Cylinder (CYL)",
} as const satisfies Record<string, string>;

export type InventoryUnitCode = keyof typeof INVENTORY_UNITS;
export const INVENTORY_UNIT_CODES = Object.keys(INVENTORY_UNITS) as [
  InventoryUnitCode,
  ...InventoryUnitCode[],
];

export function isInventoryUnit(value: unknown): value is InventoryUnitCode {
  return typeof value === "string" && value in INVENTORY_UNITS;
}

/**
 * The variant container a new variant gets from the Inventory Unit, or the
 * measurement unit for units sold by length, weight or volume.
 */
export const INVENTORY_UNIT_VARIANT: Record<
  InventoryUnitCode,
  { container: string } | { measurementUnit: string }
> = {
  pcs: { container: "unit" },
  unit: { container: "unit" },
  pack: { container: "packet" },
  pkt: { container: "packet" },
  box: { container: "box" },
  ctn: { container: "carton" },
  set: { container: "unit" },
  pr: { container: "pair" },
  doz: { container: "unit" },
  bdl: { container: "bundle" },
  bag: { container: "sack" },
  sack: { container: "sack" },
  btl: { container: "bottle" },
  jar: { container: "jar" },
  can: { container: "can" },
  tin: { container: "can" },
  roll: { container: "unit" },
  m: { measurementUnit: "m" },
  ft: { measurementUnit: "ft" },
  kg: { measurementUnit: "kg" },
  g: { measurementUnit: "g" },
  l: { measurementUnit: "liter" },
  ml: { measurementUnit: "ml" },
  cyl: { container: "cylinder" },
};

/** The Inventory Unit that matches a variant container (for older products). */
export function inventoryUnitFromContainer(
  container?: string | null,
): InventoryUnitCode | null {
  switch (container) {
    case "cylinder":
      return "cyl";
    case "sack":
      return "sack";
    case "carton":
      return "ctn";
    case "packet":
    case "pouch":
      return "pkt";
    case "bottle":
      return "btl";
    case "can":
      return "can";
    case "jar":
      return "jar";
    case "box":
      return "box";
    case "pair":
      return "pr";
    case "bundle":
      return "bdl";
    case "unit":
    case "drum":
      return "unit";
    default:
      return null;
  }
}

/**
 * Inventory & Product Rules → Inventory Loose Unit. "liter" and "piece" keep
 * the codes already stored on products.
 */
export const LOOSE_UNITS = {
  kg: "Kilogram (KG)",
  g: "Gram (G)",
  mg: "Milligram (MG)",
  liter: "Litre (L)",
  ml: "Millilitre (ML)",
  m: "Meter (M)",
  cm: "Centimeter (CM)",
  mm: "Millimeter (MM)",
  ft: "Feet (FT)",
  in: "Inch (IN)",
  piece: "Piece (PCS)",
} as const satisfies Record<string, string>;

export type LooseUnitCode = keyof typeof LOOSE_UNITS;
export const LOOSE_UNIT_CODES = Object.keys(LOOSE_UNITS) as [
  LooseUnitCode,
  ...LooseUnitCode[],
];

/** Delivery Cost Counting / Delivery cost method, with the client's help text. */
export const DELIVERY_COST_METHODS = {
  free: { label: "Free Delivery", help: "No delivery charge will be added." },
  fixed_per_order: {
    label: "Fixed Per Order",
    help: "One fixed charge per order.",
  },
  per_product: {
    label: "Per Product",
    help: "Charge multiplied by product quantity.",
  },
  per_unit: {
    label: "Per Unit",
    help: "Charge multiplied by inventory units.",
  },
  per_kg: {
    label: "Per KG",
    help: "Charge calculated by weight in kilograms.",
  },
  per_litre: { label: "Per Litre", help: "Charge calculated by litres." },
  per_box: { label: "Per Box", help: "Charge multiplied by boxes." },
  area_based: {
    label: "Area Based",
    help: "Set area-wise delivery charges in the delivery settings.",
  },
  volume_based: {
    label: "Volume Based",
    help: "Charge calculated from product dimensions.",
  },
} as const satisfies Record<string, { label: string; help: string }>;

export type DeliveryCostMethod = keyof typeof DELIVERY_COST_METHODS;
export const DELIVERY_COST_METHOD_CODES = Object.keys(
  DELIVERY_COST_METHODS,
) as [DeliveryCostMethod, ...DeliveryCostMethod[]];

export function isDeliveryCostMethod(
  value: unknown,
): value is DeliveryCostMethod {
  return typeof value === "string" && value in DELIVERY_COST_METHODS;
}

/** The method an older product's delivery cost unit stands for. */
export function deliveryMethodFromUnit(
  unit?: string | null,
): DeliveryCostMethod | null {
  if (!unit) return null;
  if (unit === "kg") return "per_kg";
  if (unit === "liter") return "per_litre";
  if (unit === "box") return "per_box";
  return "per_unit";
}

/**
 * Conversion rule, e.g. "1 KG = 1000 G". Returns the tidy form, or null
 * when the text is not "<qty> <unit> = <qty> <unit>".
 */
export function parseConversionRule(value?: string | null) {
  const match = (value ?? "")
    .trim()
    .match(
      /^(\d+(?:\.\d+)?)\s*([A-Za-z]+)\s*=\s*(\d+(?:\.\d+)?)\s*([A-Za-z]+)$/,
    );
  if (!match) return null;
  const [, fromQty, fromUnit, toQty, toUnit] = match;
  if (Number(fromQty) <= 0 || Number(toQty) <= 0) return null;
  return {
    fromQty: fromQty!,
    fromUnit: fromUnit!.toUpperCase(),
    toQty: toQty!,
    toUnit: toUnit!.toUpperCase(),
    text: `${fromQty} ${fromUnit!.toUpperCase()} = ${toQty} ${toUnit!.toUpperCase()}`,
  };
}

/** Variant attributes and their options, from the client's layout. */
export const CLIENT_VARIANT_ATTRIBUTES: Record<string, string[]> = {
  Type: ["New", "Exchange", "Refill", "Regular", "Premium", "Standard"],
  Size: [
    "XS", "S", "M", "L", "XL", "XXL", "XXXL",
    "28", "30", "32", "34", "36", "38", "39", "40", "41", "42", "43", "44",
    "12 KG", "16 KG", "30 KG", "33 KG",
  ],
  Weight: [
    "50g", "100g", "250g", "500g", "750g", "1KG", "2KG", "5KG", "10KG",
    "15KG", "20KG", "25KG", "30KG", "50KG",
  ],
  Pack: ["1 Pack", "2 Pack", "24 Pack", "Single Pack", "Family Pack", "Combo Pack"],
  Brand: [
    "ACI", "PRAN", "Unilever", "Bashundhara", "Omera", "Jamuna", "Fresh",
    "RFL", "Walton", "Samsung", "Apple", "Local Brand",
  ],
  Colour: [
    "Black", "White", "Red", "Blue", "Green", "Yellow", "Brown", "Grey",
    "Pink", "Purple", "Orange", "Navy Blue", "Silver", "Golden",
  ],
  Model: ["Custom Model"],
  Storage: [
    "4/64GB", "4/128GB", "6/128GB", "8/128GB", "8/256GB", "12/256GB",
    "12/512GB", "16/512GB", "1TB",
  ],
  Capacity: ["1L", "2L", "5L", "10L", "20L"],
  Quality: [
    "Premium", "Standard", "Regular", "Grade A", "Grade B", "Grade C",
    "Organic", "Imported", "Local",
  ],
  Grade: ["Grade A", "Grade B", "Grade C"],
};

/**
 * First-attribute options that price the same variant instead of making a
 * new one: New is the selling price, Exchange (and Refill) the price when
 * the buyer returns an empty pack.
 */
export const PRICE_MODE_OPTIONS = {
  new: ["New"],
  exchange: ["Exchange", "Refill"],
} as const;

export function priceModeOf(option: string): "new" | "exchange" | null {
  const tidy = option.trim().toLowerCase();
  if (PRICE_MODE_OPTIONS.new.some((value) => value.toLowerCase() === tidy)) {
    return "new";
  }
  if (
    PRICE_MODE_OPTIONS.exchange.some((value) => value.toLowerCase() === tidy)
  ) {
    return "exchange";
  }
  return null;
}
