"use client";

import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronRight,
  ImageIcon,
  Loader,
  Package,
  Plus,
  Save,
  Settings,
  Tag,
  Trash2,
  Truck,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import AdditionalImagesUploader from "@/components/AdditionalImagesUploader";
import ImageUploader from "@/components/ImageUploader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import RichTextEditor from "@/components/ui/rich-text-editor";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  createProductSchema,
  updateProductSchema,
} from "@/schema/product.schema";
import { generateSlug } from "@/utils/generate-slug";
import { client, orpc } from "@/utils/orpc";
import type { ProductWithRelations } from "./product-columns";
import { ProductDraftVariantsCard } from "./product-draft-variants-card";
import ProductFeaturesInput from "./product-features-input";
import { ProductVariantsCard } from "./product-variants-card";
import type { DraftVariant } from "./variant-form-dialog";

// ============================================================
// Types
// ============================================================

export type VariantPriceSettings = {
  variantOptionId: number;
  brandId?: number | null;
  consumerPrice: string;
};

/** A saved brand configuration with its selected variant options and settings */
type BrandConfig = {
  brandId: number;
  brandName: string;
  /** Which variant option IDs are included for this brand */
  selectedVariantIds: number[];
  /** Per-variant settings keyed by variantOptionId */
  variantSettings: Record<number, VariantPriceSettings>;
};

// ============================================================
// Main Component
// ============================================================

interface ProductFormProps {
  mode: "create" | "edit";
  product?: ProductWithRelations;
}

export default function ProductForm({ mode, product }: ProductFormProps) {
  const router = useRouter();
  const queryClient = useQueryClient();

  // === State for cascading selection ===
  const [selectedTypeId, setSelectedTypeId] = useState<number | null>(
    (product?.category as any)?.typeId ?? null,
  );
  const [selectedCategory, setSelectedCategory] = useState<number | null>(
    product?.categoryId ?? null,
  );
  const [selectedSubCategoryId, setSelectedSubCategoryId] = useState<
    number | null
  >(product?.subCategoryId ?? null);
  const [selectedCoreProductId, setSelectedCoreProductId] = useState<
    number | null
  >((product as any)?.coreProductId ?? null);
  const [draftVariants, setDraftVariants] = useState<DraftVariant[]>([]);

  // === Brand configuration state ===
  const [brandConfigs, setBrandConfigs] = useState<BrandConfig[]>(() => {
    // Pre-populate from existing product (edit mode)
    const pbs = (product as any)?.productBrands;
    const existingVPs = (product as any)?.variantPrices;
    if (!pbs || !Array.isArray(pbs) || pbs.length === 0) return [];

    const configs: BrandConfig[] = [];
    for (const pb of pbs) {
      // Find variant prices for this brand
      const brandVPs = (existingVPs || []).filter(
        (vp: any) => (vp.brandId ?? null) === pb.brandId || (!vp.brandId && pbs.length === 1),
      );

      const variantSettings: Record<number, VariantPriceSettings> = {};
      const selectedVariantIds: number[] = [];
      for (const vp of brandVPs) {
        selectedVariantIds.push(vp.variantOptionId);
        variantSettings[vp.variantOptionId] = {
          variantOptionId: vp.variantOptionId,
          brandId: pb.brandId,
          consumerPrice: vp.consumerPrice || "",
        };
      }

      configs.push({
        brandId: pb.brandId,
        brandName: pb.brand?.name ?? `Brand #${pb.brandId}`,
        selectedVariantIds,
        variantSettings,
      });
    }
    return configs;
  });

  // Currently-editing brand (for the inline config panel)
  const [activeBrandId, setActiveBrandId] = useState<number | null>(null);
  const [expandedBrandId, setExpandedBrandId] = useState<number | null>(null);

  // === Reference data queries ===
  const { data: typesData } = useQuery(
    orpc.adminProductType.getAll.queryOptions({ input: {} }),
  );
  const productTypes = typesData?.types ?? [];

  const { data: categoriesData } = useQuery(
    orpc.category.getAll.queryOptions(),
  );
  const allCategories = Array.isArray(categoriesData) ? categoriesData : [];

  const { data: subcategoriesData } = useQuery(
    orpc.adminSubcategory.getAllGlobal.queryOptions(),
  );
  const allSubcategories = Array.isArray(subcategoriesData)
    ? subcategoriesData
    : [];

  // Core products filtered by category
  const { data: coreProductsData } = useQuery(
    orpc.adminCoreProduct.getAll.queryOptions({
      input: {
        categoryId: selectedCategory ?? undefined,
        subCategoryId: selectedSubCategoryId ?? undefined,
      },
    }),
  );
  const coreProducts = coreProductsData?.coreProducts ?? [];

  // ALL brands (global, unrestricted)
  const { data: allBrandsData } = useQuery(
    orpc.brand.getAll.queryOptions(),
  );
  const allBrands = Array.isArray(allBrandsData) ? allBrandsData : [];

  const isEdit = mode === "edit";

  // Derived: selected core product details
  const selectedCoreProduct = coreProducts.find(
    (cp: any) => cp.id === selectedCoreProductId,
  );

  // Filter cascades
  const filteredCategories = selectedTypeId
    ? allCategories.filter((c: any) => c.typeId === selectedTypeId)
    : allCategories;

  const filteredSubcategories = selectedCategory
    ? allSubcategories.filter((sc: any) => sc.categoryId === selectedCategory)
    : [];

  // Brands already configured (exclude from add-brand dropdown)
  const configuredBrandIds = new Set(brandConfigs.map((bc) => bc.brandId));
  const availableBrands = allBrands.filter(
    (b: any) => !configuredBrandIds.has(b.id),
  );

  const handleError = () => {
    toast.error(
      `An unexpected error occurred while ${isEdit ? "updating" : "creating"} the product.`,
    );
  };

  const createMutation = useMutation({
    ...orpc.product.create.mutationOptions(),
    onSuccess: async (result) => {
      if (result.product && draftVariants.length > 0) {
        const newProductId = result.product.id;
        try {
          for (const d of draftVariants) {
            await client.adminProductVariant.create({
              ...d,
              productId: newProductId,
            });
          }
        } catch {
          toast.error("Product created but some variants failed to save.");
        }
      }
      queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      toast.success("Product created successfully");
      router.push("/dashboard/admin/products");
    },
    onError: handleError,
  });

  const updateMutation = useMutation({
    ...orpc.product.update.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      toast.success("Product updated successfully");
      router.push("/dashboard/admin/products");
    },
    onError: handleError,
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  const form = useForm({
    defaultValues: {
      id: product?.id ?? 0,
      name: product?.name ?? "",
      slug: product?.slug ?? "",
      sku: product?.sku ?? "",
      description: product?.description ?? "",
      categoryId: product?.categoryId ?? 0,
      subCategoryId:
        product?.subCategoryId ?? (undefined as number | undefined),

      // These fields are auto-managed (synced from variants)
      size: product?.size ?? "—",
      price: product?.price ?? "0",
      stockQuantity: product?.stockQuantity ?? 0,
      reorderLevel: product?.reorderLevel ?? 0,
      supplier: product?.supplier ?? "",
      image: product?.image ?? "",
      additionalImages:
        product?.images?.map((img) => img.imageUrl) ?? ([] as string[]),
      features: (product?.features ?? []) as {
        title: string;
        items: { key: string; value: string }[];
      }[],
      isFeatured: product?.isFeatured ?? false,
      brandId: product?.brandId ?? (undefined as number | undefined),

      // New fields
      coreProductId: (product as any)?.coreProductId ?? null,
      shortDescription: (product as any)?.shortDescription ?? "",
      videoUrl: (product as any)?.videoUrl ?? "",
      trackingType: (product as any)?.trackingType ?? "none",
      expiryEnabled: (product as any)?.expiryEnabled ?? false,
      damageControlEnabled: (product as any)?.damageControlEnabled ?? false,
      isReturnablePack: (product as any)?.isReturnablePack ?? false,
      visibility: (product as any)?.visibility ?? "public",
      status: (product as any)?.status ?? "active",
    },
    validators: {
      //@ts-expect-error
      onSubmit: isEdit ? updateProductSchema : createProductSchema,
    },
    onSubmit: async ({ value }) => {
      // Build variant prices array from brand configs
      const vpArray: any[] = [];
      for (const bc of brandConfigs) {
        for (const voId of bc.selectedVariantIds) {
          const settings = bc.variantSettings[voId];
          if (!settings) continue;
          vpArray.push({
            variantOptionId: settings.variantOptionId,
            brandId: bc.brandId,
            consumerPrice: settings.consumerPrice || "0",
          });
        }
      }

      const brandIds = brandConfigs.map((bc) => bc.brandId);

      const payload = {
        ...value,
        coreProductId: selectedCoreProductId,
        brandIds: brandIds.length > 0 ? brandIds : undefined,
        variantPrices: vpArray.length > 0 ? vpArray : undefined,
      };

      if (isEdit) {
        updateMutation.mutate(payload);
      } else {
        createMutation.mutate(payload);
      }
    },
  });

  const autoGenerateSlugFromName = (value: string) => {
    const generatedSlug = generateSlug(value);
    form.setFieldValue("slug", generatedSlug);
  };

  // When a core product is selected, auto-fill fields
  const handleCoreProductSelect = (cpId: number | null) => {
    setSelectedCoreProductId(cpId);
    if (cpId && coreProducts.length > 0) {
      const cp = coreProducts.find((c: any) => c.id === cpId);
      if (cp) {
        form.setFieldValue("name", cp.name);
        form.setFieldValue("slug", cp.slug);
        form.setFieldValue("image", cp.image);
        form.setFieldValue("categoryId", cp.categoryId);
        form.setFieldValue("subCategoryId", cp.subCategoryId ?? undefined);
        form.setFieldValue("coreProductId", cp.id);
      }
    }
  };

  // Add a brand configuration
  const handleAddBrand = (brandId: number) => {
    const brand = allBrands.find((b: any) => b.id === brandId);
    if (!brand) return;

    const newConfig: BrandConfig = {
      brandId: brand.id,
      brandName: brand.name,
      selectedVariantIds: [],
      variantSettings: {},
    };

    setBrandConfigs((prev) => [...prev, newConfig]);
    setActiveBrandId(brandId);
    setExpandedBrandId(brandId);
  };

  // Remove a brand configuration
  const handleRemoveBrand = (brandId: number) => {
    setBrandConfigs((prev) => prev.filter((bc) => bc.brandId !== brandId));
    if (activeBrandId === brandId) setActiveBrandId(null);
    if (expandedBrandId === brandId) setExpandedBrandId(null);
  };

  // Toggle variant inclusion for a brand
  const handleToggleVariant = (brandId: number, variantOptionId: number, variantOption: any) => {
    setBrandConfigs((prev) =>
      prev.map((bc) => {
        if (bc.brandId !== brandId) return bc;
        const isIncluded = bc.selectedVariantIds.includes(variantOptionId);
        if (isIncluded) {
          const newIds = bc.selectedVariantIds.filter((id) => id !== variantOptionId);
          const { [variantOptionId]: _, ...rest } = bc.variantSettings;
          return { ...bc, selectedVariantIds: newIds, variantSettings: rest };
        } else {
          return {
            ...bc,
            selectedVariantIds: [...bc.selectedVariantIds, variantOptionId],
            variantSettings: {
              ...bc.variantSettings,
              [variantOptionId]: makeDefaultSettings(variantOptionId, brandId),
            },
          };
        }
      }),
    );
  };

  // Update a variant setting for a brand
  const updateBrandVariantField = (
    brandId: number,
    variantOptionId: number,
    field: keyof VariantPriceSettings,
    value: any,
  ) => {
    setBrandConfigs((prev) =>
      prev.map((bc) => {
        if (bc.brandId !== brandId) return bc;
        const current = bc.variantSettings[variantOptionId] ?? makeDefaultSettings(variantOptionId, brandId);
        return {
          ...bc,
          variantSettings: {
            ...bc.variantSettings,
            [variantOptionId]: { ...current, [field]: value },
          },
        };
      }),
    );
  };

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 bg-background border-b">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button asChild variant="ghost" size="icon">
                <Link href="/dashboard/admin/products">
                  <ArrowLeft className="h-4 w-4" />
                </Link>
              </Button>
              <div>
                <h1 className="text-lg font-semibold">
                  {isEdit ? "Edit Product" : "New Product"}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {isEdit
                    ? product?.name
                    : "Create a product from Core Identity"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push("/dashboard/admin/products")}
                disabled={isPending}
              >
                Discard
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  form.setFieldValue("status", "draft");
                  form.handleSubmit();
                }}
                disabled={isPending}
              >
                <Save className="mr-2 h-4 w-4" />
                Save Draft
              </Button>
              <Button onClick={() => form.handleSubmit()} disabled={isPending}>
                {isPending && (
                  <Loader className="mr-2 h-4 w-4 animate-spin" />
                )}
                <Save className="mr-2 h-4 w-4" />
                {isEdit ? "Save Changes" : "Publish Product"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          form.handleSubmit();
        }}
      >
        <div className="container mx-auto px-4 py-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Content - Left Column (2/3 width) */}
            <div className="lg:col-span-2 space-y-6">
              {/* ── 1. Core Product Selection ── */}
              {!isEdit && (
                <Card>
                  <CardHeader className="pb-4">
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4 text-muted-foreground" />
                      <CardTitle className="text-base">
                        Core Product Identity
                      </CardTitle>
                    </div>
                    <CardDescription>
                      Select a pre-defined Core Identity to create a product
                      from
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Type */}
                      <Field>
                        <FieldLabel>Type</FieldLabel>
                        <Select
                          value={
                            selectedTypeId ? String(selectedTypeId) : "all"
                          }
                          onValueChange={(v) => {
                            const val = v === "all" ? null : Number(v);
                            setSelectedTypeId(val);
                            setSelectedCategory(null);
                            setSelectedSubCategoryId(null);
                            setSelectedCoreProductId(null);
                            form.setFieldValue("categoryId", 0);
                            form.setFieldValue("subCategoryId", undefined);
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Types</SelectItem>
                            {productTypes.map((t: any) => (
                              <SelectItem key={t.id} value={String(t.id)}>
                                {t.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Field>

                      {/* Category */}
                      <Field>
                        <FieldLabel>Category *</FieldLabel>
                        <Select
                          value={
                            selectedCategory ? String(selectedCategory) : "0"
                          }
                          onValueChange={(v) => {
                            const val = Number(v);
                            setSelectedCategory(val || null);
                            setSelectedSubCategoryId(null);
                            setSelectedCoreProductId(null);
                            form.setFieldValue("categoryId", val);
                            form.setFieldValue("subCategoryId", undefined);
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="0" disabled>
                              Select category
                            </SelectItem>
                            {filteredCategories.map((c: any) => (
                              <SelectItem key={c.id} value={String(c.id)}>
                                {c.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Field>

                      {/* Sub Category */}
                      <Field>
                        <FieldLabel>Sub Category</FieldLabel>
                        <Select
                          value={
                            selectedSubCategoryId
                              ? String(selectedSubCategoryId)
                              : "none"
                          }
                          onValueChange={(v) => {
                            const val = v === "none" ? null : Number(v);
                            setSelectedSubCategoryId(val);
                            setSelectedCoreProductId(null);
                            form.setFieldValue(
                              "subCategoryId",
                              val ?? undefined,
                            );
                          }}
                          disabled={filteredSubcategories.length === 0}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">All</SelectItem>
                            {filteredSubcategories.map((sc: any) => (
                              <SelectItem key={sc.id} value={String(sc.id)}>
                                {sc.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Field>

                      {/* Core Identity */}
                      <Field>
                        <FieldLabel>Core Identity *</FieldLabel>
                        <Select
                          value={
                            selectedCoreProductId
                              ? String(selectedCoreProductId)
                              : "0"
                          }
                          onValueChange={(v) => {
                            const val = Number(v);
                            handleCoreProductSelect(val || null);
                          }}
                          disabled={!selectedCategory}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select core product" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="0" disabled>
                              Select core identity
                            </SelectItem>
                            {coreProducts.map((cp: any) => (
                              <SelectItem key={cp.id} value={String(cp.id)}>
                                {cp.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Field>
                    </div>


                  </CardContent>
                </Card>
              )}

              {/* ── 1b. Product Name (editable, separate from core identity) ── */}
              {(selectedCoreProductId || isEdit) && (
                <Card>
                  <CardHeader className="pb-4">
                    <div className="flex items-center gap-2">
                      <Tag className="h-4 w-4 text-muted-foreground" />
                      <CardTitle className="text-base">Product Name</CardTitle>
                    </div>
                    <CardDescription>
                      Set the display name for this product. Pre-filled from Core Identity but can be customized.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <form.Field name="name">
                        {(field) => (
                          <Field>
                            <FieldLabel>Product Name *</FieldLabel>
                            <Input
                              value={field.state.value}
                              onChange={(e) => {
                                field.handleChange(e.target.value);
                                autoGenerateSlugFromName(e.target.value);
                              }}
                              placeholder="Enter product display name"
                            />
                            <p className="text-xs text-muted-foreground mt-1">
                              This name will be used as the product label
                            </p>
                          </Field>
                        )}
                      </form.Field>
                      <form.Field name="slug">
                        {(field) => (
                          <Field>
                            <FieldLabel>Slug</FieldLabel>
                            <Input
                              value={field.state.value}
                              onChange={(e) =>
                                field.handleChange(e.target.value)
                              }
                              placeholder="product-slug"
                            />
                          </Field>
                        )}
                      </form.Field>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* ── 2. Brand Selection + Variant Configuration ── */}
              {(selectedCoreProductId || isEdit) && (
                <Card>
                  <CardHeader className="pb-4">
                    <div className="flex items-center gap-2">
                      <Tag className="h-4 w-4 text-muted-foreground" />
                      <CardTitle className="text-base">
                        Brand & Variant Configuration
                      </CardTitle>
                    </div>
                    <CardDescription>
                      Select brands and configure variants for each. You must complete variant setup before adding another brand.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Saved brand configs */}
                    {brandConfigs.map((bc) => (
                      <BrandConfigCard
                        key={bc.brandId}
                        config={bc}
                        coreProductId={selectedCoreProductId!}
                        isExpanded={expandedBrandId === bc.brandId}
                        onToggleExpand={() =>
                          setExpandedBrandId(
                            expandedBrandId === bc.brandId ? null : bc.brandId,
                          )
                        }
                        onRemove={() => handleRemoveBrand(bc.brandId)}
                        onToggleVariant={(voId, vo) =>
                          handleToggleVariant(bc.brandId, voId, vo)
                        }
                        onUpdateField={(voId, field, value) =>
                          updateBrandVariantField(bc.brandId, voId, field, value)
                        }
                      />
                    ))}

                    {/* Add Brand Selector */}
                    <div className="border border-dashed rounded-lg p-4">
                      <div className="flex items-center gap-3">
                        <Plus className="h-4 w-4 text-muted-foreground" />
                        <Select
                          value=""
                          onValueChange={(v) => {
                            const val = Number(v);
                            if (val) handleAddBrand(val);
                          }}
                        >
                          <SelectTrigger className="flex-1">
                            <SelectValue placeholder="Add a brand..." />
                          </SelectTrigger>
                          <SelectContent>
                            {availableBrands.length === 0 ? (
                              <SelectItem value="none" disabled>
                                No more brands available
                              </SelectItem>
                            ) : (
                              availableBrands.map((b: any) => (
                                <SelectItem key={b.id} value={String(b.id)}>
                                  {b.name}
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                      {brandConfigs.length === 0 && (
                        <p className="text-xs text-muted-foreground mt-2">
                          Select a brand to begin configuring variants for this product.
                        </p>
                      )}
                    </div>

                    {brandConfigs.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        {brandConfigs.length} brand{brandConfigs.length > 1 ? "s" : ""} configured
                        {" "} — one product will be created with all brands attached
                      </p>
                    )}
                  </CardContent>
                </Card>
              )}




              {/* ── 5. Product Details ── */}
              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="text-base">Product Details</CardTitle>
                  <CardDescription>
                    Additional product information
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <form.Field name="shortDescription">
                    {(field) => (
                      <Field>
                        <FieldLabel>Short Description</FieldLabel>
                        <Input
                          value={field.state.value}
                          onChange={(e) => field.handleChange(e.target.value)}
                          placeholder="Premium quality rice for daily consumption"
                        />
                      </Field>
                    )}
                  </form.Field>

                  <form.Field name="description">
                    {(field) => (
                      <Field>
                        <FieldLabel htmlFor={field.name}>
                          Full Description
                        </FieldLabel>
                        <RichTextEditor
                          value={field.state.value}
                          onChange={field.handleChange}
                          placeholder="Describe your product..."
                        />
                      </Field>
                    )}
                  </form.Field>
                </CardContent>
              </Card>

              {/* ── 6. Behavior Settings ── */}
              <Card>
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-2">
                    <Settings className="h-4 w-4 text-muted-foreground" />
                    <CardTitle className="text-base">
                      Behavior Settings
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <form.Field name="isReturnablePack">
                      {(field) => (
                        <div className="flex items-center justify-between border rounded-lg p-3">
                          <div>
                            <FieldLabel className="text-sm font-medium">
                              Empty Pack Return
                            </FieldLabel>
                            <p className="text-xs text-muted-foreground">
                              Require empty pack return
                            </p>
                          </div>
                          <Switch
                            checked={field.state.value}
                            onCheckedChange={field.handleChange}
                          />
                        </div>
                      )}
                    </form.Field>

                    <form.Field name="expiryEnabled">
                      {(field) => (
                        <div className="flex items-center justify-between border rounded-lg p-3">
                          <div>
                            <FieldLabel className="text-sm font-medium">
                              Expiry Tracking
                            </FieldLabel>
                            <p className="text-xs text-muted-foreground">
                              Track product expiry dates
                            </p>
                          </div>
                          <Switch
                            checked={field.state.value}
                            onCheckedChange={field.handleChange}
                          />
                        </div>
                      )}
                    </form.Field>

                    <form.Field name="damageControlEnabled">
                      {(field) => (
                        <div className="flex items-center justify-between border rounded-lg p-3">
                          <div>
                            <FieldLabel className="text-sm font-medium">
                              Damage Control
                            </FieldLabel>
                            <p className="text-xs text-muted-foreground">
                              Enable damage reporting
                            </p>
                          </div>
                          <Switch
                            checked={field.state.value}
                            onCheckedChange={field.handleChange}
                          />
                        </div>
                      )}
                    </form.Field>

                    <form.Field name="trackingType">
                      {(field) => (
                        <Field>
                          <FieldLabel>Tracking Type</FieldLabel>
                          <Select
                            value={field.state.value}
                            onValueChange={(v) => field.handleChange(v as any)}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">No Tracking</SelectItem>
                              <SelectItem value="batch">Batch</SelectItem>
                              <SelectItem value="serial">Serial</SelectItem>
                            </SelectContent>
                          </Select>
                        </Field>
                      )}
                    </form.Field>
                  </div>
                </CardContent>
              </Card>

              {/* ── 7. Features ── */}
              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="text-base">Product Features</CardTitle>
                  <CardDescription>
                    Add feature groups with key-value pairs (e.g.,
                    Specifications: Weight - 500g)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form.Field name="features">
                    {(field) => (
                      <ProductFeaturesInput
                        value={field.state.value}
                        onChange={field.handleChange}
                      />
                    )}
                  </form.Field>
                </CardContent>
              </Card>

              {/* ── 8. Media ── */}
              <Card>
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-2">
                    <ImageIcon className="h-4 w-4 text-muted-foreground" />
                    <CardTitle className="text-base">Media</CardTitle>
                  </div>
                  <CardDescription>
                    Product images and media
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <form.Field name="image">
                      {(field) => {
                        const isInvalid =
                          field.state.meta.isTouched &&
                          !field.state.meta.isValid;
                        return (
                          <Field data-invalid={isInvalid}>
                            <FieldLabel>Thumbnail / Main Image</FieldLabel>
                            <ImageUploader
                              value={field.state.value}
                              onChange={field.handleChange}
                              folder="products"
                              maxSizeMB={5}
                            />
                            {isInvalid && (
                              <FieldError errors={field.state.meta.errors} />
                            )}
                          </Field>
                        );
                      }}
                    </form.Field>

                    <form.Field name="additionalImages">
                      {(field) => (
                        <Field>
                          <FieldLabel>Gallery</FieldLabel>
                          <AdditionalImagesUploader
                            value={field.state.value}
                            onChange={field.handleChange}
                            folder="products/additional"
                            maxSizeMB={5}
                          />
                        </Field>
                      )}
                    </form.Field>
                  </div>

                  <form.Field name="videoUrl">
                    {(field) => (
                      <Field>
                        <FieldLabel>Video URL (optional)</FieldLabel>
                        <Input
                          value={field.state.value}
                          onChange={(e) => field.handleChange(e.target.value)}
                          placeholder="https://youtube.com/watch?v=..."
                        />
                      </Field>
                    )}
                  </form.Field>
                </CardContent>
              </Card>
            </div>

            {/* Sidebar - Right Column (1/3 width) */}
            <div className="space-y-6">
              {/* Visibility */}
              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="text-base">Visibility</CardTitle>
                </CardHeader>
                <CardContent>
                  <form.Field name="visibility">
                    {(field) => (
                      <div className="space-y-2">
                        <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                          <input
                            type="radio"
                            name="visibility"
                            value="public"
                            checked={field.state.value === "public"}
                            onChange={() => field.handleChange("public")}
                            className="accent-primary"
                          />
                          <div>
                            <p className="text-sm font-medium">Public</p>
                            <p className="text-xs text-muted-foreground">Visible to all customers</p>
                          </div>
                        </label>
                        <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                          <input
                            type="radio"
                            name="visibility"
                            value="private"
                            checked={field.state.value === "private"}
                            onChange={() => field.handleChange("private")}
                            className="accent-primary"
                          />
                          <div>
                            <p className="text-sm font-medium">Private</p>
                            <p className="text-xs text-muted-foreground">Only visible to admins</p>
                          </div>
                        </label>
                      </div>
                    )}
                  </form.Field>
                </CardContent>
              </Card>

              {/* Status Controls */}
              <Card>
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-2">
                    <Settings className="h-4 w-4 text-muted-foreground" />
                    <CardTitle className="text-base">Status</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">


                  <form.Field name="isFeatured">
                    {(field) => (
                      <div className="flex items-center justify-between">
                        <div>
                          <FieldLabel className="text-sm font-medium">
                            Featured
                          </FieldLabel>
                          <p className="text-xs text-muted-foreground">
                            Show in featured section
                          </p>
                        </div>
                        <Switch
                          checked={field.state.value}
                          onCheckedChange={field.handleChange}
                        />
                      </div>
                    )}
                  </form.Field>
                </CardContent>
              </Card>


            </div>
          </div>
        </div>
      </form>
    </div>
  );
}


// ============================================================
// Helper: default variant settings
// ============================================================

function makeDefaultSettings(
  variantOptionId: number,
  brandId: number | null,
): VariantPriceSettings {
  return {
    variantOptionId,
    brandId,
    consumerPrice: "",
  };
}


// ============================================================
// Brand Config Card — collapsible per-brand variant config
// ============================================================

function BrandConfigCard({
  config,
  coreProductId,
  isExpanded,
  onToggleExpand,
  onRemove,
  onToggleVariant,
  onUpdateField,
}: {
  config: BrandConfig;
  coreProductId: number;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onRemove: () => void;
  onToggleVariant: (variantOptionId: number, variantOption: any) => void;
  onUpdateField: (
    variantOptionId: number,
    field: keyof VariantPriceSettings,
    value: any,
  ) => void;
}) {
  // Fetch core product's linked variant options
  const { data: cpData } = useQuery(
    orpc.adminCoreProduct.getById.queryOptions({
      input: { id: coreProductId },
    }),
  );

  const linkedVariants = cpData?.coreProduct?.variantLinks ?? [];

  return (
    <div className="space-y-3">
      {/* Brand header — flat row */}
      <div
        className="flex items-center gap-3 cursor-pointer group"
        onClick={onToggleExpand}
      >
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
        <span className="font-semibold text-sm">{config.brandName}</span>
        <Badge variant="outline" className="text-[10px] font-normal">
          {config.selectedVariantIds.length} variant{config.selectedVariantIds.length !== 1 ? "s" : ""}
        </Badge>
        <div className="flex-1" />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-destructive/60 hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <div className="pl-7 space-y-3">
          {/* Variant selection + pricing — unified list */}
          <div className="space-y-1.5">
            {linkedVariants.map((link: any) => {
              const v = link.variantOption;
              const isIncluded = config.selectedVariantIds.includes(v.id);
              const settings = isIncluded
                ? (config.variantSettings[v.id] ?? makeDefaultSettings(v.id, config.brandId))
                : null;

              return (
                <div
                  key={v.id}
                  className={`flex items-center gap-3 rounded-md px-3 py-2 transition-colors ${
                    isIncluded
                      ? "bg-muted/50"
                      : "hover:bg-muted/30"
                  }`}
                >
                  <Checkbox
                    checked={isIncluded}
                    onCheckedChange={() => onToggleVariant(v.id, v)}
                  />
                  <span className={`text-sm flex-1 min-w-0 ${isIncluded ? "text-foreground" : "text-muted-foreground"}`}>
                    {v.name}
                    {v.size && (
                      <span className="text-muted-foreground ml-1">· {v.size} {v.unit}</span>
                    )}
                  </span>
                  {isIncluded && settings && (
                    <div className="relative w-24 shrink-0">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">৳</span>
                      <Input
                        className="h-7 text-sm pl-6 pr-2 text-right"
                        type="number"
                        step="0.01"
                        value={settings.consumerPrice}
                        onChange={(e) =>
                          onUpdateField(v.id, "consumerPrice", e.target.value)
                        }
                        placeholder="0"
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <Separator />
    </div>
  );
}



