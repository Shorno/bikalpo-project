"use client";

import {
  getVariantDefinition,
  VARIANT_CONTAINERS,
  type VariantOptionLike,
} from "@bikalpo-project/db/variant-definition";
import {
  DELIVERY_COST_METHODS,
  INVENTORY_UNITS,
  LOOSE_UNITS,
  parseConversionRule,
} from "@bikalpo-project/db/product-client-options";
import { Children, type ReactNode, useId } from "react";
import { Checkbox } from "@/components/ui/checkbox";
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
    // Radix can report "" when the value changes from outside; ignore it.
    <Select
      value={value}
      onValueChange={(next) => next && onChange(next)}
      disabled={disabled}
    >
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

// ── Client layout: Inventory & Product Rules ────────────────────

export type ClientRuleValues = {
  variantAttr1: string;
  variantAttr2: string;
  inventoryUnit: string;
  inventoryLooseUnitEnabled: boolean;
  inventoryLooseUnit: string;
  conversionEnabled: boolean;
  conversionRule: string;
  returnPolicyEnabled: boolean;
  isReturnablePack: boolean;
  defaultPackDepositAmount: string;
  trackingType: "none" | "batch" | "serial";
  damageControlEnabled: boolean;
  expiryEnabled: boolean;
  minimumOrderEnabled: boolean;
  minimumOrderQty: string;
  deliveryCostMethod: string;
};

const NO_ATTRIBUTE = "__none__";

/** "Label            ☐ Enable", the client's rule cell header. */
function EnableHeader({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-2">
      <p className="min-w-0 text-[13px] font-medium leading-tight">{label}</p>
      <label
        htmlFor={id}
        className="flex shrink-0 cursor-pointer items-center gap-1.5 text-xs text-muted-foreground"
      >
        <Checkbox
          id={id}
          checked={checked}
          onCheckedChange={(next) => onChange(next === true)}
        />
        Enable
      </label>
    </div>
  );
}

function EnableCell({
  label,
  checked,
  onChange,
  children,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  children?: ReactNode;
}) {
  return (
    <div className="min-w-0 space-y-2 bg-card p-3">
      <EnableHeader label={label} checked={checked} onChange={onChange} />
      {children}
    </div>
  );
}

/** Keeps typed amounts to at most 8 digits and 2 decimals. */
function amountInput(next: string) {
  const tidy = next.trim();
  return /^\d{0,8}(\.\d{0,2})?$/.test(tidy) ? tidy : null;
}

/**
 * Inventory & Product Rules exactly as the client's layout: twelve cells in
 * their order, each optional rule switched by an "Enable" checkbox that
 * greys out its input when off.
 */
export function ClientRulesGrid({
  values,
  onChange,
  attributes,
  attributesLocked = false,
}: {
  values: ClientRuleValues;
  onChange: (patch: Partial<ClientRuleValues>) => void;
  attributes: Array<{ name: string }>;
  /** LPG: the two attributes are fixed to Type and Size. */
  attributesLocked?: boolean;
}) {
  const savedOnly = [values.variantAttr1, values.variantAttr2].filter(
    (name, index, all) =>
      name &&
      all.indexOf(name) === index &&
      !attributes.some((attribute) => attribute.name === name),
  );
  const attributeOptions = [
    { value: NO_ATTRIBUTE, label: "Select attribute" },
    ...attributes.map((attribute) => ({
      value: attribute.name,
      label: attribute.name,
    })),
    // A saved attribute that is no longer listed still shows.
    ...savedOnly.map((name) => ({ value: name, label: name })),
  ];
  const conversionInvalid =
    values.conversionEnabled &&
    values.conversionRule.trim() !== "" &&
    parseConversionRule(values.conversionRule) === null;

  return (
    <RulesGrid>
      <RuleCell label="Variant Attribute">
        <RuleSelect
          label="Variant attribute 1"
          value={values.variantAttr1 || NO_ATTRIBUTE}
          options={attributeOptions}
          disabled={attributesLocked}
          onChange={(value) =>
            onChange({ variantAttr1: value === NO_ATTRIBUTE ? "" : value })
          }
        />
      </RuleCell>
      <RuleCell label="Variant Attribute">
        <RuleSelect
          label="Variant attribute 2"
          value={values.variantAttr2 || NO_ATTRIBUTE}
          options={attributeOptions}
          disabled={attributesLocked}
          onChange={(value) =>
            onChange({ variantAttr2: value === NO_ATTRIBUTE ? "" : value })
          }
        />
      </RuleCell>

      <RuleCell label="Inventory Unit">
        <RuleSelect
          label="Inventory Unit"
          value={values.inventoryUnit || "pcs"}
          options={Object.entries(INVENTORY_UNITS).map(([value, label]) => ({
            value,
            label,
          }))}
          onChange={(inventoryUnit) => onChange({ inventoryUnit })}
        />
      </RuleCell>
      <EnableCell
        label="Inventory Loose Unit"
        checked={values.inventoryLooseUnitEnabled}
        onChange={(inventoryLooseUnitEnabled) =>
          onChange({ inventoryLooseUnitEnabled })
        }
      >
        <RuleSelect
          label="Inventory loose unit"
          value={
            values.inventoryLooseUnit in LOOSE_UNITS
              ? values.inventoryLooseUnit
              : "kg"
          }
          options={Object.entries(LOOSE_UNITS).map(([value, label]) => ({
            value,
            label,
          }))}
          disabled={!values.inventoryLooseUnitEnabled}
          onChange={(inventoryLooseUnit) => onChange({ inventoryLooseUnit })}
        />
      </EnableCell>

      <EnableCell
        label="Conversion"
        checked={values.conversionEnabled}
        onChange={(conversionEnabled) => onChange({ conversionEnabled })}
      >
        <Input
          aria-label="Conversion"
          aria-invalid={conversionInvalid || undefined}
          className="h-8 text-xs"
          placeholder="e.g. 1 KG = 1000 G"
          disabled={!values.conversionEnabled}
          value={values.conversionRule}
          maxLength={60}
          onChange={(event) => onChange({ conversionRule: event.target.value })}
        />
        {conversionInvalid && (
          <p className="text-[11px] text-destructive">
            Write it like 1 KG = 1000 G
          </p>
        )}
      </EnableCell>
      <EnableCell
        label="Return Policy"
        checked={values.returnPolicyEnabled}
        onChange={(returnPolicyEnabled) => onChange({ returnPolicyEnabled })}
      />

      <EnableCell
        label="Empty Pack Return"
        checked={values.isReturnablePack}
        onChange={(isReturnablePack) => onChange({ isReturnablePack })}
      >
        <Input
          aria-label="Empty pack price"
          inputMode="decimal"
          className="h-8 text-xs tabular-nums"
          placeholder="Empty pack price ৳"
          disabled={!values.isReturnablePack}
          value={
            Number(values.defaultPackDepositAmount) === 0
              ? ""
              : values.defaultPackDepositAmount
          }
          onChange={(event) => {
            const next = amountInput(event.target.value);
            if (next !== null) {
              onChange({ defaultPackDepositAmount: next || "0" });
            }
          }}
        />
      </EnableCell>
      <EnableCell
        label="Batch Tracking"
        checked={values.trackingType !== "none"}
        onChange={(enabled) =>
          // Expiry dates are kept per batch, so expiry needs batches.
          onChange(
            enabled
              ? {
                  trackingType:
                    values.trackingType === "serial" ? "serial" : "batch",
                }
              : { trackingType: "none", expiryEnabled: false },
          )
        }
      />

      <EnableCell
        label="Damage Tracking"
        checked={values.damageControlEnabled}
        onChange={(damageControlEnabled) => onChange({ damageControlEnabled })}
      />
      <EnableCell
        label="Expiry Tracking"
        checked={values.expiryEnabled}
        onChange={(expiryEnabled) =>
          onChange(
            expiryEnabled && values.trackingType !== "batch"
              ? { expiryEnabled, trackingType: "batch" }
              : { expiryEnabled },
          )
        }
      />

      <EnableCell
        label="Minimum Order Qty"
        checked={values.minimumOrderEnabled}
        onChange={(minimumOrderEnabled) => onChange({ minimumOrderEnabled })}
      >
        <Input
          aria-label="Minimum order quantity"
          inputMode="decimal"
          className="h-8 text-xs tabular-nums"
          disabled={!values.minimumOrderEnabled}
          value={values.minimumOrderQty}
          onChange={(event) => {
            const next = amountInput(event.target.value);
            if (next !== null) onChange({ minimumOrderQty: next });
          }}
        />
      </EnableCell>
      <RuleCell label="Delivery Cost Counting">
        <DeliveryMethodSelect
          value={values.deliveryCostMethod}
          onChange={(deliveryCostMethod) => onChange({ deliveryCostMethod })}
        />
      </RuleCell>
    </RulesGrid>
  );
}

/** Delivery Cost Counting / Delivery cost method: one value, two places. */
export function DeliveryMethodSelect({
  value,
  onChange,
  className = "h-8 w-full text-xs",
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <Select
      value={value in DELIVERY_COST_METHODS ? value : "free"}
      onValueChange={(next) => next && onChange(next)}
    >
      <SelectTrigger aria-label="Delivery cost method" className={className}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {Object.entries(DELIVERY_COST_METHODS).map(([code, method]) => (
          <SelectItem key={code} value={code}>
            {method.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Publishing → Visibility help, as the client wrote it. */
export const VISIBILITY_HELP: Record<string, string> = {
  public: "Public products are visible to customers.",
  private: "Private products are hidden from customers.",
  unlisted: "Unlisted products open by link but stay out of lists and search.",
};

/** Publishing → "Featured product" (admin only). */
export function FeaturedCheckbox({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  const id = useId();
  return (
    <div className="space-y-1">
      <label
        htmlFor={id}
        className="flex cursor-pointer items-center gap-2 text-sm"
      >
        <Checkbox
          id={id}
          checked={checked}
          onCheckedChange={(next) => onChange(next === true)}
        />
        Featured product
      </label>
      <p className="text-xs text-muted-foreground">Show in featured section.</p>
    </div>
  );
}
