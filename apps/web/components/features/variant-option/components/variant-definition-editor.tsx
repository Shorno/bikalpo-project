"use client";

import { inferProductTypeFamily } from "@bikalpo-project/db/fulfillment";
import {
  RECOMMENDED_VARIANT_CONTAINERS,
  resolveVariantOperations,
  VARIANT_CONTAINERS,
  type VariantContainerCode,
  type VariantDefinition,
  withDerivedOperationalUnit,
} from "@bikalpo-project/db/variant-definition";
import * as React from "react";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const VARIANT_DEFINITION_KINDS = [
  "measurement",
  "loose",
  "attribute",
] as const;
export const VARIANT_MEASUREMENT_UNITS = [
  "KG",
  "Gram",
  "ML",
  "L",
  "Piece",
] as const;

export type VariantDefinitionKind = (typeof VARIANT_DEFINITION_KINDS)[number];

export type ProductTypeOption = {
  id: number;
  name: string;
  slug?: string | null;
  family?:
    | "grocery"
    | "fashion"
    | "footwear"
    | "electronics"
    | "lpg"
    | "bulk_liquid"
    | "generic"
    | null;
  inventoryBehaviour?: "auto_break" | "loose_convert" | "fixed_pack" | null;
};

export type CategoryOption = {
  id: number;
  name: string;
  typeId: number | null;
};

export type VariantDraft = {
  kind: VariantDefinitionKind;
  value: string;
  measurementUnit: string;
  container: string;
  attribute: string;
  displayAlias: string;
  typeId: string;
  categoryId: string;
  sortOrder: number;
};

export type StructuredVariantRequestPayload = {
  definition: VariantDefinition;
  displayAlias?: string;
  typeId: number;
  categoryId: number | null;
  sortOrder: number;
};

export const EMPTY_VARIANT_DRAFT: VariantDraft = {
  kind: "measurement",
  value: "",
  measurementUnit: "KG",
  container: "unit",
  attribute: "Size",
  displayAlias: "",
  typeId: "",
  categoryId: "none",
  sortOrder: 0,
};

export function buildVariantDefinition(value: VariantDraft): VariantDefinition {
  if (value.kind === "measurement") {
    return {
      kind: value.kind,
      value: value.value,
      measurementUnit: value.measurementUnit,
      container: value.container,
    };
  }
  if (value.kind === "loose") {
    return {
      kind: value.kind,
      measurementUnit: value.measurementUnit,
    };
  }
  return {
    kind: value.kind,
    attribute: value.attribute,
    value: value.value,
  };
}

export function variantDraftToPayload(
  draft: VariantDraft,
): StructuredVariantRequestPayload {
  return {
    definition: buildVariantDefinition(draft),
    displayAlias: draft.displayAlias || undefined,
    typeId: Number(draft.typeId),
    categoryId: draft.categoryId === "none" ? null : Number(draft.categoryId),
    sortOrder: draft.sortOrder,
  };
}

export function structuredPayloadToVariantDraft(
  payload: Record<string, unknown>,
): VariantDraft | null {
  const definition = payload.definition;
  if (
    !definition ||
    typeof definition !== "object" ||
    !("kind" in definition)
  ) {
    return null;
  }
  const value = definition as Record<string, unknown>;
  if (!VARIANT_DEFINITION_KINDS.includes(value.kind as VariantDefinitionKind)) {
    return null;
  }
  return {
    ...EMPTY_VARIANT_DRAFT,
    kind: value.kind as VariantDefinitionKind,
    value: typeof value.value === "string" ? value.value : "",
    measurementUnit:
      typeof value.measurementUnit === "string" ? value.measurementUnit : "KG",
    container: typeof value.container === "string" ? value.container : "unit",
    attribute: typeof value.attribute === "string" ? value.attribute : "Size",
    displayAlias:
      typeof payload.displayAlias === "string" ? payload.displayAlias : "",
    typeId:
      typeof payload.typeId === "number" && payload.typeId > 0
        ? String(payload.typeId)
        : "",
    categoryId:
      typeof payload.categoryId === "number" && payload.categoryId > 0
        ? String(payload.categoryId)
        : "none",
    sortOrder: typeof payload.sortOrder === "number" ? payload.sortOrder : 0,
  };
}

export function isVariantDraftComplete(draft: VariantDraft) {
  if (!draft.typeId) return false;
  if (draft.kind === "loose") return Boolean(draft.measurementUnit.trim());
  if (draft.kind === "attribute") {
    return Boolean(draft.attribute.trim() && draft.value.trim());
  }
  return Boolean(
    draft.value.trim() &&
      draft.measurementUnit.trim() &&
      draft.container.trim(),
  );
}

export function VariantDefinitionEditor({
  value,
  onChange,
  types,
  categories,
  locked = false,
}: {
  value: VariantDraft;
  onChange: (value: VariantDraft) => void;
  types: ProductTypeOption[];
  categories: CategoryOption[];
  locked?: boolean;
}) {
  const set = (key: keyof VariantDraft, next: string | number) =>
    onChange({ ...value, [key]: next });
  const filteredCategories = categories.filter(
    (category) => String(category.typeId) === value.typeId,
  );
  const selectedType = types.find((type) => String(type.id) === value.typeId);
  const family = selectedType
    ? inferProductTypeFamily(selectedType)
    : "generic";
  const recommended = RECOMMENDED_VARIANT_CONTAINERS[family];
  const moreContainers = (
    Object.keys(VARIANT_CONTAINERS) as VariantContainerCode[]
  ).filter((code) => !recommended.includes(code));
  const operationsPreview = React.useMemo(() => {
    try {
      const definition = withDerivedOperationalUnit(
        buildVariantDefinition(value),
        family,
      );
      return resolveVariantOperations({
        name: "Variant preview",
        definitionKind: definition.kind,
        definition,
        needsReview: false,
      });
    } catch {
      return null;
    }
  }, [family, value]);
  const titleCase = (text: string) =>
    text.charAt(0).toUpperCase() + text.slice(1);

  return (
    <div className="space-y-4">
      {locked && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          This definition is in use. Structure and scope are locked; only the
          display alias and status can change.
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field>
          <FieldLabel>Product Type *</FieldLabel>
          <Select
            value={value.typeId}
            onValueChange={(nextTypeId) => {
              const nextType = types.find(
                (type) => String(type.id) === nextTypeId,
              );
              const nextFamily = nextType
                ? inferProductTypeFamily(nextType)
                : "generic";
              onChange({
                ...value,
                typeId: nextTypeId,
                categoryId: "none",
                container:
                  RECOMMENDED_VARIANT_CONTAINERS[nextFamily][0] ?? "unit",
              });
            }}
            disabled={locked}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a product type" />
            </SelectTrigger>
            <SelectContent>
              {types.map((type) => (
                <SelectItem key={type.id} value={String(type.id)}>
                  {type.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldDescription>
            Variants are type-scoped to prevent cross-category contamination.
          </FieldDescription>
        </Field>
        <Field>
          <FieldLabel>Category</FieldLabel>
          <Select
            value={value.categoryId}
            onValueChange={(next) => set("categoryId", next)}
            disabled={locked || !value.typeId}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">All categories of this type</SelectItem>
              {filteredCategories.map((category) => (
                <SelectItem key={category.id} value={String(category.id)}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      <Field>
        <FieldLabel>Definition Kind *</FieldLabel>
        <Select
          value={value.kind}
          onValueChange={(next) => set("kind", next as VariantDefinitionKind)}
          disabled={locked}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {VARIANT_DEFINITION_KINDS.map((kind) => (
              <SelectItem value={kind} key={kind}>
                {kind[0]!.toUpperCase() + kind.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <div className="grid gap-4 sm:grid-cols-3">
        {(value.kind === "measurement" || value.kind === "attribute") && (
          <Field>
            <FieldLabel>
              {value.kind === "attribute"
                ? "Attribute value"
                : "Measurement value"}{" "}
              *
            </FieldLabel>
            <Input
              value={value.value}
              onChange={(event) => set("value", event.target.value)}
              disabled={locked}
              placeholder={value.kind === "attribute" ? "XL" : "12"}
            />
          </Field>
        )}
        {value.kind === "attribute" && (
          <Field>
            <FieldLabel>Attribute *</FieldLabel>
            <Input
              value={value.attribute}
              onChange={(event) => set("attribute", event.target.value)}
              disabled={locked}
              placeholder="Size"
            />
          </Field>
        )}
        {(value.kind === "measurement" || value.kind === "loose") && (
          <Field>
            <FieldLabel>Measurement unit</FieldLabel>
            <Select
              value={value.measurementUnit}
              onValueChange={(next) => set("measurementUnit", next)}
              disabled={locked}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VARIANT_MEASUREMENT_UNITS.map((unit) => (
                  <SelectItem value={unit} key={unit}>
                    {unit}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        )}
        {value.kind === "measurement" && (
          <Field>
            <FieldLabel>Container</FieldLabel>
            <Select
              value={value.container}
              onValueChange={(next) => set("container", next)}
              disabled={locked}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {recommended.map((code) => (
                  <SelectItem value={code} key={code}>
                    {VARIANT_CONTAINERS[code]}
                  </SelectItem>
                ))}
                {moreContainers.length > 0 && (
                  <>
                    <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                      More containers
                    </div>
                    {moreContainers.map((code) => (
                      <SelectItem value={code} key={code}>
                        {VARIANT_CONTAINERS[code]}
                      </SelectItem>
                    ))}
                  </>
                )}
              </SelectContent>
            </Select>
          </Field>
        )}
      </div>

      <Field>
        <FieldLabel>Display alias</FieldLabel>
        <Input
          value={value.displayAlias}
          onChange={(event) => set("displayAlias", event.target.value)}
          placeholder="Optional label override"
        />
        <FieldDescription>
          Leave blank to use the generated canonical label.
        </FieldDescription>
      </Field>

      {operationsPreview && (
        <div className="rounded-md border bg-muted/30 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Inventory preview
          </p>
          <dl className="mt-2 grid gap-3 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-muted-foreground">Operational Unit</dt>
              <dd className="font-medium">
                {titleCase(operationsPreview.operationalUnit)}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Stock Entry</dt>
              <dd className="font-medium">
                {titleCase(operationsPreview.receivingMode)}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Quantity</dt>
              <dd className="font-medium">
                {operationsPreview.allowsDecimal
                  ? `Decimal ${operationsPreview.operationalUnit}`
                  : `Whole ${operationsPreview.operationalUnit}${operationsPreview.operationalUnit.endsWith("s") ? "" : "s"}`}
              </dd>
            </div>
          </dl>
        </div>
      )}
    </div>
  );
}
