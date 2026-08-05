"use client";

import { inferProductTypeFamily } from "@bikalpo-project/db/fulfillment";
import {
  RECOMMENDED_VARIANT_CONTAINERS,
  VARIANT_CONTAINERS,
  type VariantContainerCode,
  type VariantDefinition,
} from "@bikalpo-project/db/variant-definition";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as React from "react";
import { toast } from "sonner";
import { SetupFormDialog } from "@/components/features/product-setup";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { client, orpc } from "@/utils/orpc";
import type { VariantOptionRow } from "./variant-option-columns";

const MEASUREMENT_UNITS = ["KG", "Gram", "ML", "L", "Piece"];
const KINDS = ["measurement", "loose", "attribute"] as const;
type Kind = (typeof KINDS)[number];
type DialogMode = "create" | "edit";
type InternalMode = DialogMode | "clone";
type ProductTypeOption = {
  id: number;
  name: string;
  slug?: string | null;
  inventoryBehaviour?: "auto_break" | "loose_convert" | "fixed_pack" | null;
};
type CategoryOption = { id: number; name: string; typeId: number | null };
type VariantDraft = {
  kind: Kind;
  value: string;
  measurementUnit: string;
  container: string;
  attribute: string;
  displayAlias: string;
  typeId: string;
  categoryId: string;
  sortOrder: number;
};

const emptyVariantDraft: VariantDraft = {
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

function buildVariantDefinition(value: VariantDraft): VariantDefinition {
  if (value.kind === "measurement") {
    return {
      kind: value.kind,
      value: value.value,
      measurementUnit: value.measurementUnit,
      container: value.container,
    } as const;
  }
  if (value.kind === "loose") {
    return {
      kind: value.kind,
      measurementUnit: value.measurementUnit,
    } as const;
  }
  if (value.kind === "attribute") {
    return {
      kind: value.kind,
      attribute: value.attribute,
      value: value.value,
    } as const;
  }
  throw new Error("Unsupported variant definition kind");
}

function variantOptionToDraft(option: VariantOptionRow): VariantDraft {
  const definition = (option.definition || {}) as Record<string, string>;
  const legacyMeasurement = option.name.match(
    /(^|\s)(\d+(?:\.\d+)?)\s*(kg|gram|ml|l)\b/i,
  );
  const legacyUnit = legacyMeasurement?.[3]
    ? ({ kg: "KG", gram: "Gram", ml: "ML", l: "L" } as const)[
        legacyMeasurement[3].toLowerCase() as "kg" | "gram" | "ml" | "l"
      ]
    : undefined;
  const legacyContainer = /\bcylinder\b/i.test(option.name)
    ? "cylinder"
    : "unit";
  const containerCode = (input: string | undefined, fallback: string) => {
    const value = (input || fallback).toLowerCase();
    return value === "pack" ? "packet" : value;
  };
  return {
    kind: (option.definitionKind ||
      definition.kind ||
      (option.variantType === "loose" ? "loose" : "measurement")) as Kind,
    value: definition.value || option.size || legacyMeasurement?.[2] || "",
    measurementUnit:
      definition.measurementUnit || legacyUnit || option.unit || "Piece",
    container: containerCode(definition.container, legacyContainer),
    attribute: definition.attribute || "Size",
    displayAlias: option.displayAlias || "",
    typeId: option.typeId ? String(option.typeId) : "",
    categoryId: option.categoryId ? String(option.categoryId) : "none",
    sortOrder: option.sortOrder,
  };
}

function VariantDefinitionFields({
  value,
  onChange,
  types,
  categories,
  locked,
}: {
  value: VariantDraft;
  onChange: (value: VariantDraft) => void;
  types: ProductTypeOption[];
  categories: CategoryOption[];
  locked: boolean;
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

  const measurementSelect = (label: string, key: "measurementUnit") => (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      <Select
        value={value[key]}
        onValueChange={(next) => set(key, next)}
        disabled={locked}
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {MEASUREMENT_UNITS.map((unit) => (
            <SelectItem value={unit} key={unit}>
              {unit}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );

  const containerSelect = (label: string, key: "container") => (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      <Select
        value={value[key]}
        onValueChange={(next) => set(key, next)}
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
  );

  return (
    <div className="space-y-4">
      {locked && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          This definition is in use. Structure and scope are locked; only the
          display alias, status, and sort order can change.
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
              const nextContainer =
                RECOMMENDED_VARIANT_CONTAINERS[nextFamily][0] ?? "unit";
              onChange({
                ...value,
                typeId: nextTypeId,
                categoryId: "none",
                container: nextContainer,
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
          onValueChange={(next) => set("kind", next as Kind)}
          disabled={locked}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {KINDS.map((kind) => (
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
        {(value.kind === "measurement" || value.kind === "loose") &&
          measurementSelect("Measurement unit", "measurementUnit")}
        {value.kind === "measurement" &&
          containerSelect("Container", "container")}
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
    </div>
  );
}

export default function VariantOptionDialog({
  open,
  onOpenChange,
  mode,
  variantOption,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: DialogMode;
  variantOption?: VariantOptionRow;
  onSaved?: () => void | Promise<void>;
}) {
  const queryClient = useQueryClient();
  const [internalMode, setInternalMode] = React.useState<InternalMode>(mode);
  const [draft, setDraft] = React.useState<VariantDraft>(emptyVariantDraft);
  const [active, setActive] = React.useState(true);
  const { data: typesData } = useQuery({
    ...orpc.adminProductType.getAll.queryOptions({ input: {} }),
    enabled: open,
  });
  const { data: categoriesData } = useQuery({
    ...orpc.category.getAll.queryOptions(),
    enabled: open,
  });

  React.useEffect(() => {
    if (!open) return;
    setInternalMode(mode);
    setDraft(
      mode === "edit" && variantOption
        ? variantOptionToDraft(variantOption)
        : { ...emptyVariantDraft },
    );
    setActive(mode === "edit" ? (variantOption?.isActive ?? true) : true);
  }, [mode, open, variantOption]);

  const commonPayload = () => ({
    definition: buildVariantDefinition(draft),
    displayAlias: draft.displayAlias || undefined,
    typeId: Number(draft.typeId),
    categoryId: draft.categoryId === "none" ? null : Number(draft.categoryId),
    sortOrder: draft.sortOrder,
  });
  const finish = async (message: string) => {
    await queryClient.invalidateQueries({
      queryKey: orpc.adminVariantOption.getAll.key(),
    });
    toast.success(message);
    await onSaved?.();
    onOpenChange(false);
  };
  const createMutation = useMutation({
    mutationFn: () => client.adminVariantOption.create(commonPayload()),
    onSuccess: () =>
      finish(
        internalMode === "clone"
          ? "New variant created from this definition"
          : "Variant created",
      ),
    onError: (error) => toast.error(error.message),
  });
  const updateMutation = useMutation({
    mutationFn: () =>
      client.adminVariantOption.update({
        id: variantOption!.id,
        ...commonPayload(),
        isActive: active,
      }),
    onSuccess: () => finish("Variant updated"),
    onError: (error) => toast.error(error.message),
  });
  const pending = createMutation.isPending || updateMutation.isPending;
  const locked =
    internalMode === "edit" &&
    Boolean(variantOption?.structuralLocked) &&
    !variantOption?.needsReview;
  const isCreate = internalMode === "create";
  const isClone = internalMode === "clone";
  const definitionComplete =
    Boolean(draft.typeId) &&
    (draft.kind === "loose"
      ? Boolean(draft.measurementUnit.trim())
      : draft.kind === "attribute"
        ? Boolean(draft.attribute.trim() && draft.value.trim())
        : Boolean(
            draft.value.trim() &&
              draft.measurementUnit.trim() &&
              draft.container.trim(),
          ));
  const title = isCreate
    ? "Create Variant Option"
    : isClone
      ? "Clone Variant Option"
      : "Edit Variant Option";
  const description = isCreate
    ? "Create one reusable, type-scoped definition. The canonical label is generated from its structure."
    : isClone
      ? "Change the structure or scope, then save it as a new reusable definition."
      : variantOption?.needsReview
        ? "Complete this one-time definition review. The existing variant ID and every product reference will be preserved."
        : "Canonical structure is locked after the option is used. Display aliases remain editable.";
  const initialDraft =
    mode === "edit" && variantOption
      ? variantOptionToDraft(variantOption)
      : emptyVariantDraft;
  const hasUnsavedChanges = () =>
    internalMode !== mode ||
    active !== (mode === "edit" ? (variantOption?.isActive ?? true) : true) ||
    JSON.stringify(draft) !== JSON.stringify(initialDraft);
  const submitLabel = isCreate
    ? "Create Variant"
    : isClone
      ? "Save New Variant"
      : "Update Variant";

  return (
    <SetupFormDialog
      description={description}
      footerActions={
        locked ? (
          <Button
            disabled={pending}
            onClick={() => setInternalMode("clone")}
            type="button"
            variant="secondary"
          >
            Clone as new
          </Button>
        ) : undefined
      }
      hasUnsavedChanges={hasUnsavedChanges}
      isSubmitting={pending}
      onOpenChange={onOpenChange}
      onSubmit={() =>
        internalMode === "edit"
          ? updateMutation.mutate()
          : createMutation.mutate()
      }
      open={open}
      size="large"
      submitDisabled={!definitionComplete}
      submitLabel={submitLabel}
      title={title}
    >
      {variantOption?.needsReview && internalMode === "edit" && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
          This legacy variant remains linked to its current products. Confirm
          its concrete structure once; its ID, prices, stock, and history will
          not change.
        </div>
      )}
      <VariantDefinitionFields
        value={draft}
        onChange={setDraft}
        types={(typesData?.types ?? []).filter(
          (type) => internalMode === "edit" || type.isActive,
        )}
        categories={(categoriesData ?? [])
          .filter((category) => internalMode === "edit" || category.isActive)
          .map((category) => ({
            id: category.id,
            name: category.name,
            typeId: category.typeId,
          }))}
        locked={locked}
      />
      {internalMode === "edit" && (
        <div className="flex items-center justify-between rounded-md border p-3">
          <span className="text-sm font-medium">Active</span>
          <Switch checked={active} onCheckedChange={setActive} />
        </div>
      )}
    </SetupFormDialog>
  );
}
