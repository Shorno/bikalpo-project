export const VARIANT_DEFINITION_KINDS = [
  "measurement",
  "loose",
  "attribute",
] as const;

export type VariantDefinitionKind = (typeof VARIANT_DEFINITION_KINDS)[number];

export type VariantDefinition =
  | {
      kind: "measurement";
      value: string;
      measurementUnit: string;
      container: string;
      operationalUnit?: string;
    }
  | {
      kind: "loose";
      measurementUnit: string;
      operationalUnit?: string;
    }
  | {
      kind: "attribute";
      attribute: string;
      value: string;
      operationalUnit?: string;
    };

export type VariantProductFamily = "grocery" | "fashion" | "footwear" | "electronics" | "lpg" | "bulk_liquid" | "generic";
export const PRODUCT_VARIANT_PACK_TYPES = [
  "sack",
  "carton",
  "packet",
  "loose",
  "bottle",
  "can",
  "jar",
  "pouch",
  "box",
  "unit",
  "pair",
  "cylinder",
  "drum",
  "bundle",
] as const;

export type ProductVariantPackType =
  (typeof PRODUCT_VARIANT_PACK_TYPES)[number];
export type VariantContainerCode = Exclude<ProductVariantPackType, "loose">;

export const VARIANT_CONTAINERS: Record<VariantContainerCode, string> = {
  sack: "Sack", carton: "Carton", packet: "Pack / Packet", bottle: "Bottle",
  can: "Can", jar: "Jar", pouch: "Pouch", box: "Box", unit: "Unit",
  pair: "Pair", cylinder: "Cylinder", drum: "Drum", bundle: "Bundle",
};

export const RECOMMENDED_VARIANT_CONTAINERS: Record<VariantProductFamily, readonly VariantContainerCode[]> = {
  lpg: ["cylinder"],
  grocery: ["packet", "pouch", "bottle", "jar", "can", "box", "sack"],
  fashion: ["unit", "box"],
  footwear: ["pair", "box"],
  electronics: ["unit", "box"],
  bulk_liquid: ["bottle", "can", "jar", "drum"],
  generic: ["unit", "packet", "box"],
};

const containerOperationalUnit: Record<VariantContainerCode, string> = {
  sack: "sack", carton: "carton", packet: "pack", bottle: "bottle", can: "can",
  jar: "jar", pouch: "pouch", box: "box", unit: "unit", pair: "pair",
  cylinder: "cylinder", drum: "drum", bundle: "bundle",
};

export function deriveVariantOperationalUnit(definition: VariantDefinition, family: VariantProductFamily = "generic"): string {
  if (definition.operationalUnit) return definition.operationalUnit;
  if (definition.kind === "loose") return tidy(definition.measurementUnit).toLowerCase();
  if (definition.kind === "attribute") {
    if (family === "fashion") return "piece";
    if (family === "footwear") return "pair";
    return "unit";
  }
  const container = definition.kind === "measurement" ? definition.container : "unit";
  return containerOperationalUnit[container.toLowerCase() as VariantContainerCode] ?? (tidy(container).toLowerCase() || "unit");
}

export function withDerivedOperationalUnit(definition: VariantDefinition, family: VariantProductFamily): VariantDefinition {
  return { ...definition, operationalUnit: deriveVariantOperationalUnit({ ...definition, operationalUnit: undefined }, family) };
}

const tidy = (value: string | undefined) => value?.trim().replace(/\s+/g, " ") ?? "";

export function formatVariantDefinition(definition: VariantDefinition): string {
  switch (definition.kind) {
    case "measurement":
      return [definition.value, definition.measurementUnit, definition.container]
        .map(tidy)
        .filter(Boolean)
        .join(" ");
    case "loose":
      return `Loose (per ${tidy(definition.measurementUnit)})`;
    case "attribute":
      return [definition.attribute, definition.value].map(tidy).filter(Boolean).join(" ");
  }
}

export function variantDefinitionSignature(definition: VariantDefinition): string {
  const structuralEntries = Object.entries(definition).filter(
    ([key]) => !["operationalUnit", "stockUnit", "orderUnit"].includes(key),
  );
  return JSON.stringify(
    Object.fromEntries(
      structuralEntries.map(([key, value]) => [key, tidy(String(value)).toLowerCase()]),
    ),
  );
}

export type VariantOptionLike = {
  name?: string | null;
  unit?: string | null;
  size?: string | null;
  variantType?: string | null;
  definitionKind?: string | null;
  definition?: unknown;
  displayAlias?: string | null;
  needsReview?: boolean | null;
};

export function getVariantDefinition(option?: VariantOptionLike | null): VariantDefinition | null {
  const value = option?.definition;
  if (!value || typeof value !== "object" || !("kind" in value)) return null;
  if (!VARIANT_DEFINITION_KINDS.includes((value as { kind: VariantDefinitionKind }).kind)) return null;
  const candidate = value as Record<string, unknown> & { kind: VariantDefinitionKind };
  const hasText = (field: unknown) =>
    typeof field === "string" && Boolean(tidy(field));
  if (
    candidate.kind === "measurement" &&
    (!hasText(candidate.value) ||
      !hasText(candidate.measurementUnit) ||
      !hasText(candidate.container))
  ) return null;
  if (
    candidate.kind === "loose" &&
    !hasText(candidate.measurementUnit)
  ) return null;
  if (
    candidate.kind === "attribute" &&
    (!hasText(candidate.attribute) || !hasText(candidate.value))
  ) return null;
  return value as VariantDefinition;
}

export class ConcreteVariantDefinitionError extends Error {
  constructor(public readonly variantName: string) {
    super(`Variant "${variantName}" requires Admin definition review`);
    this.name = "ConcreteVariantDefinitionError";
  }
}

export type VariantMeasurementDimension = "mass" | "volume" | "count";

export type VariantStockSemantics = {
  displayLabel: string;
  canonicalLabel: string;
  packType: ProductVariantPackType;
  operationalUnit: string;
  entryType: "loose" | "pack";
  measurementDimension: VariantMeasurementDimension;
  measurementUnit: "KG" | "L" | null;
  massKgPerUnit: number;
  volumeLPerUnit: number;
};

export type MovementSemantics = {
  family: VariantProductFamily;
  movementKind: "direct" | "loose" | "container";
  enteredUnit: string;
  inventoryUnit: string;
  quantityKind: VariantMeasurementDimension;
  allowsDecimal: boolean;
  conversionFactor: string;
  referenceMeasurement?: {
    unit: "kg" | "liter";
    perInventoryUnit: string;
  };
};

const parsePositiveNumber = (value: string | undefined) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

const normalizedMeasurement = (value: string, unit: string) => {
  const amount = parsePositiveNumber(value);
  switch (tidy(unit).toLowerCase()) {
    case "kg":
    case "kilogram":
    case "kilograms":
      return { dimension: "mass" as const, unit: "KG" as const, amount };
    case "g":
    case "gm":
    case "gram":
    case "grams":
      return { dimension: "mass" as const, unit: "KG" as const, amount: amount / 1000 };
    case "l":
    case "ltr":
    case "liter":
    case "liters":
    case "litre":
    case "litres":
      return { dimension: "volume" as const, unit: "L" as const, amount };
    case "ml":
    case "milliliter":
    case "milliliters":
    case "millilitre":
    case "millilitres":
      return { dimension: "volume" as const, unit: "L" as const, amount: amount / 1000 };
    default:
      return { dimension: "count" as const, unit: null, amount: 0 };
  }
};

/** Canonical inventory and presentation semantics for one structured option. */
export function resolveVariantStockSemantics(option: VariantOptionLike): VariantStockSemantics {
  const resolved = resolveConcreteVariantOption(option);
  const definition = resolved.definition!;
  const operationalUnit = resolved.orderUnit || "unit";

  if (definition.kind === "attribute") {
    return {
      displayLabel: resolved.label,
      canonicalLabel: resolved.canonicalLabel,
      packType: resolved.packType,
      operationalUnit,
      entryType: "pack",
      measurementDimension: "count",
      measurementUnit: null,
      massKgPerUnit: 0,
      volumeLPerUnit: 0,
    };
  }

  const measurement = normalizedMeasurement(
    definition.kind === "loose" ? "1" : definition.value,
    definition.measurementUnit,
  );
  return {
    displayLabel: resolved.label,
    canonicalLabel: resolved.canonicalLabel,
    packType: resolved.packType,
    operationalUnit,
    entryType: definition.kind === "loose" ? "loose" : "pack",
    measurementDimension: measurement.dimension,
    measurementUnit: measurement.unit,
    massKgPerUnit: measurement.dimension === "mass" ? measurement.amount : 0,
    volumeLPerUnit: measurement.dimension === "volume" ? measurement.amount : 0,
  };
}

export function areVariantOptionsStructurallyCompatible(
  source: VariantOptionLike,
  target: VariantOptionLike,
) {
  const sourceDefinition = getVariantDefinition(source);
  const targetDefinition = getVariantDefinition(target);
  return Boolean(
    sourceDefinition &&
      targetDefinition &&
      variantDefinitionSignature(sourceDefinition) ===
        variantDefinitionSignature(targetDefinition),
  );
}

/** Shared, server-authoritative quantity contract for every inventory movement. */
export function resolveVariantMovementSemantics(
  option: VariantOptionLike,
  family: VariantProductFamily = "generic",
): MovementSemantics {
  const semantics = resolveVariantStockSemantics(option);
  if (family === "lpg" && semantics.operationalUnit !== "cylinder") {
    throw new ConcreteVariantDefinitionError(semantics.displayLabel);
  }

  const movementKind = semantics.entryType === "loose"
    ? "loose"
    : ["carton", "box", "bundle", "drum"].includes(semantics.packType)
      ? "container"
      : "direct";
  const referenceMeasurement = semantics.measurementDimension === "mass"
    && semantics.massKgPerUnit > 0
    ? { unit: "kg" as const, perInventoryUnit: String(semantics.massKgPerUnit) }
    : semantics.measurementDimension === "volume" && semantics.volumeLPerUnit > 0
      ? { unit: "liter" as const, perInventoryUnit: String(semantics.volumeLPerUnit) }
      : undefined;

  return {
    family,
    movementKind,
    enteredUnit: semantics.operationalUnit,
    inventoryUnit: semantics.operationalUnit,
    quantityKind: family === "lpg" ? "count" : semantics.measurementDimension,
    allowsDecimal: movementKind === "loose",
    conversionFactor: "1",
    ...(referenceMeasurement ? { referenceMeasurement } : {}),
  };
}

const formatQuantity = (value: number) =>
  Number.isInteger(value) ? String(value) : String(Math.round(value * 100) / 100);

const formatOperationalUnit = (unit: string, quantity: number) => {
  if (quantity === 1 || ["kg", "g", "gram", "l", "ml"].includes(unit.toLowerCase())) return unit;
  if (unit.endsWith("s")) return unit;
  if (unit.endsWith("x")) return `${unit}es`;
  return `${unit}s`;
};

export function formatVariantStockQuantity(
  semantics: VariantStockSemantics,
  quantity: number,
) {
	const inventory = `${formatQuantity(quantity)} ${formatOperationalUnit(semantics.operationalUnit, quantity)}`;
  if (semantics.entryType === "loose") return inventory;
  if (semantics.measurementDimension === "mass" && semantics.massKgPerUnit > 0) {
    return `${inventory} · ${formatQuantity(quantity * semantics.massKgPerUnit)} KG`;
  }
  if (semantics.measurementDimension === "volume" && semantics.volumeLPerUnit > 0) {
    return `${inventory} · ${formatQuantity(quantity * semantics.volumeLPerUnit)} L`;
  }
  return inventory;
}

/** Resolve the canonical, database-safe metadata used by generated variants. */
export function resolveConcreteVariantOption(option: VariantOptionLike) {
  const resolved = resolveVariantOption(option);
  if (
    !resolved.definition ||
    option.needsReview ||
    option.definitionKind !== resolved.definition.kind
  ) {
    throw new ConcreteVariantDefinitionError(
      tidy(option.displayAlias ?? undefined) || tidy(option.name ?? "Variant"),
    );
  }
  const packType = resolved.container.trim().toLowerCase().replace(/\s+/g, "_");
  if (
    !PRODUCT_VARIANT_PACK_TYPES.includes(packType as ProductVariantPackType) ||
    (resolved.definition.kind === "measurement" && packType === "loose")
  ) {
    throw new ConcreteVariantDefinitionError(resolved.label);
  }
  return {
    ...resolved,
    packType: packType as ProductVariantPackType,
    packagingType: packType as ProductVariantPackType,
  };
}

export function resolveVariantOption(option?: VariantOptionLike | null) {
  const definition = getVariantDefinition(option);
  const canonicalLabel = definition ? formatVariantDefinition(definition) : tidy(option?.name ?? "Unit");
  const label = tidy(option?.displayAlias ?? undefined) || canonicalLabel;
  const isLoose = definition?.kind === "loose" || (!definition && option?.variantType === "loose");
  const legacyDefinition = definition as (VariantDefinition & { stockUnit?: string; orderUnit?: string }) | null;
  const operationalUnit = definition
    ? definition.operationalUnit || legacyDefinition?.orderUnit || legacyDefinition?.stockUnit || deriveVariantOperationalUnit(definition)
    : isLoose ? tidy(option?.unit ?? undefined) : "pack";
  const stockUnit = operationalUnit || "unit";
  const orderUnit = operationalUnit || tidy(option?.unit ?? undefined) || "unit";
  const container = definition?.kind === "measurement"
    ? definition.container
    : definition?.kind === "attribute"
        ? operationalUnit === "pair" ? "pair" : "unit"
      : isLoose
        ? "loose"
        : stockUnit;

  return {
    definition,
    canonicalLabel,
    label,
    isLoose,
    stockUnit,
    orderUnit,
    container,
    weightKg: definition?.kind === "measurement"
      ? String(normalizedMeasurement(definition.value, definition.measurementUnit).dimension === "mass"
          ? normalizedMeasurement(definition.value, definition.measurementUnit).amount
          : 0)
      : "0",
  };
}
