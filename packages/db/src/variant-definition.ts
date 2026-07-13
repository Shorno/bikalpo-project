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
export type VariantContainerCode = "sack" | "packet" | "bottle" | "can" | "jar" | "pouch" | "box" | "unit" | "pair" | "cylinder" | "drum";

export const VARIANT_CONTAINERS: Record<VariantContainerCode, string> = {
  sack: "Sack", packet: "Pack / Packet", bottle: "Bottle",
  can: "Can", jar: "Jar", pouch: "Pouch", box: "Box", unit: "Unit",
  pair: "Pair", cylinder: "Cylinder", drum: "Drum",
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
  sack: "sack", packet: "pack", bottle: "bottle", can: "can",
  jar: "jar", pouch: "pouch", box: "box", unit: "unit", pair: "pair",
  cylinder: "cylinder", drum: "drum",
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
  definition?: unknown;
  displayAlias?: string | null;
};

export function getVariantDefinition(option?: VariantOptionLike | null): VariantDefinition | null {
  const value = option?.definition;
  if (!value || typeof value !== "object" || !("kind" in value)) return null;
  if (!VARIANT_DEFINITION_KINDS.includes((value as { kind: VariantDefinitionKind }).kind)) return null;
  return value as VariantDefinition;
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
    weightKg:
      definition?.kind === "measurement" && definition.measurementUnit.toLowerCase() === "kg"
        ? definition.value
        : option?.size || "0",
  };
}
