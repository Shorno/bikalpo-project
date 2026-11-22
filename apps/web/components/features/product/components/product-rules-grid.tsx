"use client";

import {
  getVariantDefinition,
  VARIANT_CONTAINERS,
  type VariantOptionLike,
} from "@bikalpo-project/db/variant-definition";
import { Children, type ReactNode, useId } from "react";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ── Grid ────────────────────────────────────────────────────────

/**
 * Inventory & Product Rules as the client's reference lays it out: a
 * two-column grid of cells, filled left to right.
 */
export function RulesGrid({ children }: { children: ReactNode }) {
  const cells = Children.toArray(children);
  return (
    // No outer border: the section card already frames it. Only the lines
    // between cells show, and the outer cells line up with the card edge.
    <div className="grid grid-cols-2 gap-px bg-border [&>*:nth-child(-n+2)]:pt-0 [&>*:nth-child(even)]:pr-0 [&>*:nth-child(odd)]:pl-0">
      {cells}
      {cells.length % 2 === 1 && <div aria-hidden className="bg-card" />}
    </div>
  );
}

export function RuleCell({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0 space-y-2 bg-card p-3">
      <p className="text-[13px] font-medium leading-tight">{label}</p>
      {children}
    </div>
  );
}

/** A rule the product type does not use keeps its place in the grid. */
export function UnusedRuleCell({
  label,
  typeName,
}: {
  label: string;
  typeName: string;
}) {
  return (
    <RuleCell label={label}>
      <p className="text-xs text-muted-foreground">Not used for {typeName}</p>
    </RuleCell>
  );
}

// ── Controls ────────────────────────────────────────────────────

export function ChoiceRadios<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  /** Accessible name for the group. */
  label: string;
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
}) {
  const id = useId();
  return (
    <RadioGroup
      aria-label={label}
      value={value}
      onValueChange={(next) => onChange(next as T)}
      className="flex flex-wrap gap-x-3 gap-y-1.5"
    >
      {options.map((option) => (
        <label
          key={option.value}
          htmlFor={`${id}-${option.value}`}
          className="flex cursor-pointer items-center gap-1.5 text-xs"
        >
          <RadioGroupItem id={`${id}-${option.value}`} value={option.value} />
          {option.label}
        </label>
      ))}
    </RadioGroup>
  );
}

/** (•) Enable ( ) Disable */
export function EnableDisable({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <ChoiceRadios
      label={label}
      value={value ? "on" : "off"}
      options={[
        { value: "on", label: "Enable" },
        { value: "off", label: "Disable" },
      ]}
      onChange={(next) => onChange(next === "on")}
    />
  );
}

/** A labelled small input under a rule, e.g. "Minimum Order: [ __ ]". */
export function RuleAmount({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="flex items-center gap-2">
      <label
        htmlFor={id}
        className="shrink-0 text-xs text-muted-foreground"
      >
        {label}:
      </label>
      <Input
        id={id}
        inputMode="decimal"
        autoComplete="off"
        className="h-8 min-w-0 flex-1 text-right text-xs tabular-nums"
        disabled={disabled}
        value={value}
        onChange={(event) => {
          const next = event.target.value.trim();
          if (/^\d{0,8}(\.\d{0,2})?$/.test(next)) onChange(next);
        }}
      />
    </div>
  );
}

export function RuleSelect({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger aria-label={label} className="h-8 w-full text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// ── Variant filter (Type, Size, Inventory Unit) ─────────────────

const ALL = "all";

export type VariantFilter = { type: string; size: string; unit: string };

export const EMPTY_VARIANT_FILTER: VariantFilter = {
  type: ALL,
  size: ALL,
  unit: ALL,
};

type Facets = {
  type: string;
  typeLabel: string;
  size: string;
  unit: string;
};

function unitLabel(unit: string) {
  const lower = unit.trim().toLowerCase();
  if (lower === "kg") return "KG";
  if (lower === "l" || lower === "liter" || lower === "litre") return "L";
  if (lower === "ml") return "ML";
  if (lower === "gram" || lower === "g") return "Gram";
  if (lower === "piece" || lower === "pcs") return "Piece";
  return unit.trim();
}

function facetsOf(option: VariantOptionLike): Facets | null {
  const definition = getVariantDefinition(option);
  if (!definition) return null;
  if (definition.kind === "measurement") {
    const unit = unitLabel(definition.measurementUnit);
    return {
      type: definition.container,
      typeLabel:
        VARIANT_CONTAINERS[
          definition.container as keyof typeof VARIANT_CONTAINERS
        ] ?? definition.container,
      size: `${definition.value} ${unit}`,
      unit,
    };
  }
  if (definition.kind === "loose") {
    return {
      type: "loose",
      typeLabel: "Loose",
      size: "",
      unit: unitLabel(definition.measurementUnit),
    };
  }
  return {
    type: "attribute",
    typeLabel: definition.attribute,
    size: definition.value,
    unit: "",
  };
}

function matches(facets: Facets | null, filter: VariantFilter) {
  if (!facets) {
    return (
      filter.type === ALL && filter.size === ALL && filter.unit === ALL
    );
  }
  return (
    (filter.type === ALL || facets.type === filter.type) &&
    (filter.size === ALL || facets.size === filter.size) &&
    (filter.unit === ALL || facets.unit === filter.unit)
  );
}

export function matchesVariantFilter(
  option: VariantOptionLike,
  filter: VariantFilter,
) {
  return matches(facetsOf(option), filter);
}

/**
 * Variants a brand card offers: those matching the filter, plus any the
 * brand already has selected so a filter never hides a selection.
 */
export function filterVariantsForBrand<T extends VariantOptionLike & {
  id: number;
}>(variants: T[], filter: VariantFilter, selectedIds: number[]) {
  return variants.filter(
    (variant) =>
      selectedIds.includes(variant.id) ||
      matchesVariantFilter(variant, filter),
  );
}

function uniqueOptions(entries: Array<[string, string]>, allLabel: string) {
  const seen = new Map<string, string>();
  for (const [value, label] of entries) {
    if (value && !seen.has(value)) seen.set(value, label);
  }
  return [
    { value: ALL, label: allLabel },
    ...[...seen].map(([value, label]) => ({ value, label })),
  ];
}

/** "Variant [Type ▼] [Size ▼]" — narrows the variants offered below. */
export function VariantTypeSizeFilter({
  variants,
  filter,
  onChange,
}: {
  variants: VariantOptionLike[];
  filter: VariantFilter;
  onChange: (filter: VariantFilter) => void;
}) {
  const facets = variants.map(facetsOf).filter(Boolean) as Facets[];
  const types = uniqueOptions(
    facets.map((item) => [item.type, item.typeLabel]),
    "All types",
  );
  const sizes = uniqueOptions(
    facets
      .filter((item) =>
        matches(item, { ...filter, size: ALL }),
      )
      .map((item) => [item.size, item.size]),
    "All sizes",
  );
  return (
    <div className="grid gap-1.5">
      <RuleSelect
        label="Variant type"
        value={filter.type}
        options={types}
        onChange={(type) => onChange({ type, size: ALL, unit: filter.unit })}
      />
      <RuleSelect
        label="Variant size"
        value={sizes.some((item) => item.value === filter.size) ? filter.size : ALL}
        options={sizes}
        onChange={(size) => onChange({ ...filter, size })}
      />
    </div>
  );
}

/** "Inventory Unit [ ▼ ]" — narrows the variants offered below. */
export function InventoryUnitFilter({
  variants,
  filter,
  onChange,
}: {
  variants: VariantOptionLike[];
  filter: VariantFilter;
  onChange: (filter: VariantFilter) => void;
}) {
  const facets = variants.map(facetsOf).filter(Boolean) as Facets[];
  const units = uniqueOptions(
    facets
      .filter((item) => filter.type === ALL || item.type === filter.type)
      .map((item) => [item.unit, item.unit]),
    "All units",
  );
  return (
    <RuleSelect
      label="Inventory unit"
      value={units.some((item) => item.value === filter.unit) ? filter.unit : ALL}
      options={units}
      onChange={(unit) => onChange({ ...filter, unit, size: ALL })}
    />
  );
}
