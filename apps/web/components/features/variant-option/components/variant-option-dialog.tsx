"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as React from "react";
import { toast } from "sonner";
import { SetupFormDialog } from "@/components/features/product-setup";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { client, orpc } from "@/utils/orpc";
import {
  EMPTY_VARIANT_DRAFT,
  isVariantDraftComplete,
  VariantDefinitionEditor,
  type VariantDefinitionKind,
  type VariantDraft,
  variantDraftToPayload,
} from "./variant-definition-editor";
import type { VariantOptionRow } from "./variant-option-columns";

type DialogMode = "create" | "edit";
type InternalMode = DialogMode | "clone";

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
      (option.variantType === "loose"
        ? "loose"
        : "measurement")) as VariantDefinitionKind,
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
  const [draft, setDraft] = React.useState<VariantDraft>({
    ...EMPTY_VARIANT_DRAFT,
  });
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
        : { ...EMPTY_VARIANT_DRAFT },
    );
    setActive(mode === "edit" ? (variantOption?.isActive ?? true) : true);
  }, [mode, open, variantOption]);

  const commonPayload = () => variantDraftToPayload(draft);
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
      : EMPTY_VARIANT_DRAFT;
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
      submitDisabled={!isVariantDraftComplete(draft)}
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
      <VariantDefinitionEditor
        value={draft}
        onChange={setDraft}
        types={(typesData?.types ?? [])
          .filter((type) => internalMode === "edit" || type.isActive)
          .map((type) => ({
            id: type.id,
            name: type.name,
            slug: type.slug,
            family: type.family,
            inventoryBehaviour: type.inventoryBehaviour,
          }))}
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
