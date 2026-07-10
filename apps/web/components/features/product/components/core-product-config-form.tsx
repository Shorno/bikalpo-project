"use client";

import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Loader2,
  Plus,
  RotateCcw,
  Search,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  type CoreProductConfigValues,
  coreProductConfigSchema,
} from "@/schema/core-product-config.schema";
import { orpc } from "@/utils/orpc";
import {
  ProductEditorIdentity,
  ProductEditorSection,
} from "./product-editor-ui";

const PRODUCTS_BASE = "/dashboard/admin/products";

type CoreProductConfigFormProps = {
  coreProductId: number;
};

type BrandOption = {
  id: number;
  name: string;
  logo?: string | null;
};

type VariantOption = {
  id: number;
  name: string;
  unit?: string | null;
  size?: string | null;
  variantType?: string | null;
  typeId?: number | null;
  categoryId?: number | null;
};

type SelectedVariant = {
  variantOptionId: number;
  consumerPrice: string;
};

type ExistingBrandProduct = {
  status: string;
  variantOptions: Array<{
    variantOptionId: number;
    consumerPrice: string;
    isActive: boolean;
  }>;
};

export default function CoreProductConfigForm({
  coreProductId,
}: CoreProductConfigFormProps) {
  const queryClient = useQueryClient();
  const lastSyncedSignature = useRef<string | null>(null);
  const [brandDialogOpen, setBrandDialogOpen] = useState(false);
  const [brandSearch, setBrandSearch] = useState("");
  const [collapsedBrands, setCollapsedBrands] = useState<Set<number>>(
    () => new Set(),
  );
  const [saved, setSaved] = useState(false);

  const configQuery = useQuery(
    orpc.adminProductConfig.get.queryOptions({ input: { coreProductId } }),
  );
  const brandsQuery = useQuery(orpc.brand.getAll.queryOptions());
  const catalogOptionsQuery = useQuery({
    queryKey: ["adminCatalogApproval", "coreProductConfigOptions"],
    queryFn: () => orpc.adminCatalogApproval.getRequestOptions.call({}),
  });

  const configureMutation = useMutation({
    ...orpc.adminProductConfig.configure.mutationOptions(),
    onSuccess: async () => {
      setSaved(true);
      toast.success("Brand products updated");
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: orpc.adminProductConfig.get.queryKey({
            input: { coreProductId },
          }),
        }),
        queryClient.invalidateQueries({
          queryKey: orpc.adminCoreProduct.getAll.queryKey({ input: {} }),
        }),
      ]);
    },
    onError: (error) => {
      toast.error(error.message || "Could not save product changes");
    },
  });

  const form = useForm({
    defaultValues: { brands: [] } as CoreProductConfigValues,
    validators: { onSubmit: coreProductConfigSchema },
    onSubmit: async ({ value }) => {
      configureMutation.mutate({ coreProductId, brands: value.brands });
    },
  });

  const configuration = configQuery.data;
  const core = configuration?.core;
  const existingBrands = configuration?.brands ?? [];
  const allBrands = (
    Array.isArray(brandsQuery.data) ? brandsQuery.data : []
  ) as BrandOption[];
  const availableVariants = useMemo(
    () =>
      filterVariantsForCore(
        core,
        (catalogOptionsQuery.data?.variantOptions ?? []) as VariantOption[],
      ),
    [catalogOptionsQuery.data?.variantOptions, core],
  );
  const existingByBrandId = useMemo(
    () => new Map(existingBrands.map((brand) => [brand.brandId, brand])),
    [existingBrands],
  );

  useEffect(() => {
    if (!configuration) return;

    const nextBrands = configuration.brands
      .filter((brand) => brand.status !== "inactive")
      .map((brand) => ({
        brandId: brand.brandId,
        variants: brand.variantOptions
          .filter((option) => option.isActive)
          .map((option) => ({
            variantOptionId: option.variantOptionId,
            consumerPrice: option.consumerPrice || "0",
          })),
      }));

    // Signature of the server state we'd seed the form from. Re-sync whenever
    // it changes — e.g. an instantly-served stale/empty cache being replaced by
    // a fresh background refetch — so the editor never stays stuck on an
    // outdated snapshot (which previously required a full page reload to fix).
    // Never clobber the user's unsaved edits once they've started changing
    // things: only the very first sync is unconditional.
    const signature = `${coreProductId}:${JSON.stringify(nextBrands)}`;
    if (signature === lastSyncedSignature.current) return;
    if (lastSyncedSignature.current !== null && form.state.isDirty) return;

    form.reset({ brands: nextBrands });
    lastSyncedSignature.current = signature;
  }, [configuration, coreProductId, form]);

  const toggleCollapsed = (brandId: number) => {
    setCollapsedBrands((current) => {
      const next = new Set(current);
      if (next.has(brandId)) next.delete(brandId);
      else next.add(brandId);
      return next;
    });
  };

  const addBrand = (brandId: number) => {
    const current = form.state.values.brands;
    if (current.some((brand) => brand.brandId === brandId)) return;

    const existing = existingByBrandId.get(brandId);
    const previousVariants = existing?.variantOptions
      .filter((option) => option.isActive)
      .map((option) => ({
        variantOptionId: option.variantOptionId,
        consumerPrice: option.consumerPrice || "0",
      }));

    form.setFieldValue("brands", [
      ...current,
      {
        brandId,
        variants:
          previousVariants && previousVariants.length > 0
            ? previousVariants
            : availableVariants.map((variant) => ({
                variantOptionId: variant.id,
                consumerPrice: "0",
              })),
      },
    ]);
    setBrandDialogOpen(false);
    setBrandSearch("");
    setSaved(false);
  };

  const removeBrand = (brandId: number) => {
    form.setFieldValue(
      "brands",
      form.state.values.brands.filter((brand) => brand.brandId !== brandId),
    );
    setSaved(false);
  };

  const toggleVariant = (brandId: number, variantOptionId: number) => {
    form.setFieldValue(
      "brands",
      form.state.values.brands.map((brand) => {
        if (brand.brandId !== brandId) return brand;
        const selected = brand.variants.some(
          (variant) => variant.variantOptionId === variantOptionId,
        );
        return {
          ...brand,
          variants: selected
            ? brand.variants.filter(
                (variant) => variant.variantOptionId !== variantOptionId,
              )
            : [...brand.variants, { variantOptionId, consumerPrice: "0" }],
        };
      }),
    );
    setSaved(false);
  };

  const setBrandVariants = (brandId: number, variantOptionIds: number[]) => {
    form.setFieldValue(
      "brands",
      form.state.values.brands.map((brand) =>
        brand.brandId === brandId
          ? {
              ...brand,
              variants: variantOptionIds.map(
                (variantOptionId) =>
                  brand.variants.find(
                    (variant) => variant.variantOptionId === variantOptionId,
                  ) ?? { variantOptionId, consumerPrice: "0" },
              ),
            }
          : brand,
      ),
    );
    setSaved(false);
  };

  const submitChanges = () => {
    const result = coreProductConfigSchema.safeParse(form.state.values);
    if (!result.success) {
      toast.error(
        result.error.issues[0]?.message ?? "Review the brand products",
      );
      return;
    }
    form.handleSubmit();
  };

  if (configQuery.isLoading || brandsQuery.isLoading) {
    return <EditorLoading />;
  }

  if (configQuery.isError || !core) {
    return <EditorError />;
  }

  return (
    <form.Subscribe selector={(state) => state.values.brands}>
      {(selectedBrands) => {
        const selectedBrandIds = new Set(
          selectedBrands.map((brand) => brand.brandId),
        );
        const addableBrands = allBrands.filter(
          (brand) =>
            !selectedBrandIds.has(brand.id) &&
            brand.name.toLowerCase().includes(brandSearch.toLowerCase()),
        );
        const pendingDeactivations = existingBrands.filter(
          (brand) =>
            brand.status !== "inactive" && !selectedBrandIds.has(brand.brandId),
        );
        const pendingCreations = selectedBrands.filter(
          (brand) => !existingByBrandId.has(brand.brandId),
        ).length;
        const pendingReactivations = selectedBrands.filter(
          (brand) =>
            existingByBrandId.get(brand.brandId)?.status === "inactive",
        ).length;

        return (
          <div className="min-h-screen bg-muted/30">
            <div className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
              <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2.5">
                <div className="flex min-w-0 items-center gap-3">
                  <Button
                    asChild
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                  >
                    <Link href={PRODUCTS_BASE} aria-label="Back to products">
                      <ArrowLeft className="h-4 w-4" />
                    </Link>
                  </Button>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">
                      Products <span className="opacity-50">/</span> Edit brand
                      products
                    </p>
                    <div className="flex items-center gap-2">
                      <h1 className="truncate text-base font-semibold leading-tight">
                        {core.name}
                      </h1>
                      <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                        {selectedBrands.length} brands
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    asChild
                    disabled={configureMutation.isPending}
                  >
                    <Link href={PRODUCTS_BASE}>Discard</Link>
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={submitChanges}
                    disabled={configureMutation.isPending}
                  >
                    {configureMutation.isPending && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Save changes
                  </Button>
                </div>
              </div>
            </div>

            <form
              onSubmit={(event) => {
                event.preventDefault();
                event.stopPropagation();
                submitChanges();
              }}
            >
              <div className="mx-auto max-w-6xl px-4 py-6">
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
                  <div className="divide-y rounded-xl border bg-card">
                    <ProductEditorSection
                      title="Identity"
                      description="The shared core product for these independent brand products."
                    >
                      <ProductEditorIdentity
                        image={core.image}
                        name={core.name}
                        meta={[core.category?.name, core.subCategory?.name]
                          .filter(Boolean)
                          .join(" · ")}
                      />
                    </ProductEditorSection>

                    <ProductEditorSection
                      title="Brands and variants"
                      description="Choose each brand's variants. Prices are managed in Product Price."
                      action={
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8"
                          onClick={() => setBrandDialogOpen(true)}
                        >
                          <Plus className="h-4 w-4" />
                          Add brand
                        </Button>
                      }
                    >
                      {selectedBrands.length === 0 ? (
                        <div className="rounded-lg border border-dashed p-6 text-center">
                          <p className="text-sm font-medium">
                            No brands selected
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Add a brand to start configuring variants.
                          </p>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="mt-4"
                            onClick={() => setBrandDialogOpen(true)}
                          >
                            <Plus className="h-4 w-4" />
                            Add first brand
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {selectedBrands.map((selectedBrand) => {
                            const brand = allBrands.find(
                              (item) => item.id === selectedBrand.brandId,
                            );
                            if (!brand) return null;

                            return (
                              <BrandEditorCard
                                key={brand.id}
                                brand={brand}
                                existing={existingByBrandId.get(brand.id)}
                                selectedVariants={selectedBrand.variants}
                                variants={availableVariants}
                                expanded={!collapsedBrands.has(brand.id)}
                                onToggleExpanded={() =>
                                  toggleCollapsed(brand.id)
                                }
                                onRemove={() => removeBrand(brand.id)}
                                onToggleVariant={(variantId) =>
                                  toggleVariant(brand.id, variantId)
                                }
                                onSetVariants={(variantIds) =>
                                  setBrandVariants(brand.id, variantIds)
                                }
                              />
                            );
                          })}
                        </div>
                      )}
                    </ProductEditorSection>
                  </div>

                  <aside className="space-y-4 lg:sticky lg:top-[72px]">
                    <div className="rounded-xl border bg-card">
                      <div className="border-b px-4 py-3">
                        <h2 className="text-sm font-semibold">Changes</h2>
                      </div>
                      <div className="space-y-3 p-4">
                        <ImpactRow
                          label="New products"
                          value={pendingCreations}
                        />
                        <ImpactRow
                          label="Will reactivate"
                          value={pendingReactivations}
                        />
                        <ImpactRow
                          label="Will deactivate"
                          value={pendingDeactivations.length}
                        />

                        {pendingDeactivations.length > 0 && (
                          <div className="border-t pt-3">
                            <p className="text-xs leading-relaxed text-muted-foreground">
                              Removed brands keep their product data and can be
                              reactivated later.
                            </p>
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {pendingDeactivations.map((brand) => (
                                <span
                                  key={brand.brandId}
                                  className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-400"
                                >
                                  {brand.brandName}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {existingBrands.length > 0 && (
                      <div className="rounded-xl border bg-card">
                        <div className="border-b px-4 py-3">
                          <h2 className="text-sm font-semibold">
                            Generated products
                          </h2>
                        </div>
                        <div className="space-y-1 p-2">
                          {existingBrands.map((brand) => (
                            <Link
                              key={brand.productId}
                              href={`${PRODUCTS_BASE}/${brand.productId}/edit`}
                              className="group flex items-center justify-between gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-muted/60"
                            >
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium">
                                  {brand.productName}
                                </p>
                                <p className="text-xs capitalize text-muted-foreground">
                                  {brand.status}
                                </p>
                              </div>
                              <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}

                    {saved && (
                      <div className="flex items-start gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-emerald-700 dark:text-emerald-400">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                        <p className="text-sm">Changes saved successfully.</p>
                      </div>
                    )}
                  </aside>
                </div>
              </div>
            </form>

            <Dialog open={brandDialogOpen} onOpenChange={setBrandDialogOpen}>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Select brand</DialogTitle>
                  <DialogDescription>
                    New brands create products; removed brands reuse their
                    existing product.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={brandSearch}
                      onChange={(event) => setBrandSearch(event.target.value)}
                      placeholder="Search brands..."
                      className="pl-9"
                      autoFocus
                    />
                  </div>
                  <div className="-mx-1 max-h-[300px] space-y-1 overflow-y-auto px-1">
                    {addableBrands.length > 0 ? (
                      addableBrands.map((brand) => {
                        const existing = existingByBrandId.get(brand.id);
                        return (
                          <button
                            key={brand.id}
                            type="button"
                            onClick={() => addBrand(brand.id)}
                            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-muted/80"
                          >
                            <BrandMark brand={brand} />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium">
                                {brand.name}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {existing?.status === "inactive"
                                  ? "Reactivate existing product"
                                  : "Create independent product"}
                              </p>
                            </div>
                            {existing?.status === "inactive" && (
                              <RotateCcw className="h-4 w-4 text-muted-foreground" />
                            )}
                          </button>
                        );
                      })
                    ) : (
                      <p className="py-8 text-center text-sm text-muted-foreground">
                        No matching brands are available.
                      </p>
                    )}
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        );
      }}
    </form.Subscribe>
  );
}

function BrandEditorCard({
  brand,
  existing,
  selectedVariants,
  variants,
  expanded,
  onToggleExpanded,
  onRemove,
  onToggleVariant,
  onSetVariants,
}: {
  brand: BrandOption;
  existing?: ExistingBrandProduct;
  selectedVariants: SelectedVariant[];
  variants: VariantOption[];
  expanded: boolean;
  onToggleExpanded: () => void;
  onRemove: () => void;
  onToggleVariant: (variantId: number) => void;
  onSetVariants: (variantIds: number[]) => void;
}) {
  const selectedVariantIds = selectedVariants.map(
    (variant) => variant.variantOptionId,
  );
  const allSelected =
    variants.length > 0 && selectedVariants.length === variants.length;
  const state = !existing
    ? "new"
    : existing.status === "inactive"
      ? "reactivate"
      : "active";

  return (
    <div className="rounded-lg border bg-card">
      <div className="group flex items-center gap-3 p-3">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
          onClick={onToggleExpanded}
        >
          {expanded ? (
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          )}
          <BrandMark brand={brand} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate text-sm font-semibold">{brand.name}</p>
              <StatePill state={state} />
            </div>
            <p className="text-xs text-muted-foreground">
              {selectedVariants.length} variant
              {selectedVariants.length === 1 ? "" : "s"} selected
            </p>
          </div>
        </button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-destructive/60 opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
          aria-label={`Remove ${brand.name}`}
          onClick={onRemove}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      {expanded && (
        <>
          <Separator />
          <div className="space-y-3 p-3">
            {variants.length === 0 ? (
              <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                No variant options are available for this core identity.
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    Tap a variant to include it for this brand
                  </span>
                  <button
                    type="button"
                    className="text-xs font-medium text-primary hover:underline"
                    onClick={() =>
                      onSetVariants(
                        allSelected
                          ? []
                          : variants.map((variant) => variant.id),
                      )
                    }
                  >
                    {allSelected ? "Clear all" : "Select all"}
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {variants.map((variant) => {
                    const selected = selectedVariantIds.includes(variant.id);
                    return (
                      <button
                        key={variant.id}
                        type="button"
                        onClick={() => onToggleVariant(variant.id)}
                        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors ${
                          selected
                            ? "border-primary bg-primary/10 font-medium text-primary"
                            : "border-border text-muted-foreground hover:bg-muted"
                        }`}
                      >
                        {selected && <Check className="h-3.5 w-3.5" />}
                        <span>
                          {variant.name}
                          {variant.size && (
                            <span className="ml-1 opacity-70">
                              · {variant.size}
                              {variant.unit ? ` ${variant.unit}` : ""}
                            </span>
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {selectedVariants.length === 0 && (
              <p className="text-xs font-medium text-destructive">
                Select at least one variant before saving.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function BrandMark({ brand }: { brand: BrandOption }) {
  if (brand.logo) {
    return (
      <Image
        src={brand.logo}
        alt={brand.name}
        width={32}
        height={32}
        className="h-8 w-8 shrink-0 rounded-md border object-cover"
      />
    );
  }

  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-semibold text-muted-foreground">
      {brand.name.charAt(0).toUpperCase()}
    </span>
  );
}

function StatePill({ state }: { state: "new" | "reactivate" | "active" }) {
  const styles = {
    new: "bg-primary/10 text-primary",
    reactivate: "bg-sky-500/10 text-sky-700 dark:text-sky-400",
    active: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  };
  const labels = { new: "New", reactivate: "Reactivate", active: "Active" };

  return (
    <span
      className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${styles[state]}`}
    >
      {labels[state]}
    </span>
  );
}

function ImpactRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold tabular-nums">{value}</span>
    </div>
  );
}

function EditorLoading() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center bg-muted/30">
      <div className="flex items-center gap-3 rounded-xl border bg-card px-5 py-4">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
        <div>
          <p className="text-sm font-medium">Loading brand products</p>
          <p className="text-xs text-muted-foreground">
            Mapping brands and variant options…
          </p>
        </div>
      </div>
    </div>
  );
}

function EditorError() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md rounded-xl border bg-card p-6 text-center">
        <h1 className="text-base font-semibold">Core product unavailable</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          These brand products could not be loaded. They may have been removed.
        </p>
        <Button className="mt-5" variant="outline" size="sm" asChild>
          <Link href={PRODUCTS_BASE}>Back to products</Link>
        </Button>
      </div>
    </div>
  );
}

function filterVariantsForCore(
  core:
    | {
        categoryId: number;
        category?: { typeId?: number | null } | null;
      }
    | undefined,
  variants: VariantOption[],
) {
  if (!core) return [];
  const typeId = core.category?.typeId ?? null;

  return variants
    .filter((variant) => {
      const isGlobal = variant.typeId == null && variant.categoryId == null;
      const isTypeWide =
        variant.typeId === typeId && variant.categoryId == null;
      const isCategoryScoped =
        variant.typeId === typeId && variant.categoryId === core.categoryId;
      return isGlobal || isTypeWide || isCategoryScoped;
    })
    .sort((left, right) => left.name.localeCompare(right.name));
}
