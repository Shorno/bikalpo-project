"use client";

import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ImageIcon,
  Loader,
  Package,
  Save,
  Settings,
  Tag,
  Truck,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import AdditionalImagesUploader from "@/components/AdditionalImagesUploader";
import ImageUploader from "@/components/ImageUploader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { useSubCategories } from "@/hooks/use-categories";
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

interface ProductFormProps {
  mode: "create" | "edit";
  product?: ProductWithRelations;
}

export default function ProductForm({ mode, product }: ProductFormProps) {
  const router = useRouter();
  const queryClient = useQueryClient();

  // === State for cascading selection ===
  const [selectedTypeId, setSelectedTypeId] = useState<number | null>(null);
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
  const [selectedBrandIds, setSelectedBrandIds] = useState<number[]>(() => {
    // Pre-populate from existing product brands (edit mode)
    const pbs = (product as any)?.productBrands;
    if (pbs && Array.isArray(pbs)) return pbs.map((pb: any) => pb.brandId);
    return [];
  });

  // === Per-variant settings (variantOptionId → full settings) ===
  const [variantPrices, setVariantPrices] = useState<
    Record<number, VariantPriceSettings>
  >(() => {
    // Pre-populate from existing product variant prices (edit mode)
    const existing = (product as any)?.variantPrices;
    if (!existing || !Array.isArray(existing) || existing.length === 0) return {};
    const map: Record<number, VariantPriceSettings> = {};
    for (const vp of existing) {
      map[vp.variantOptionId] = {
        variantOptionId: vp.variantOptionId,
        variantType: vp.variantType || null,
        consumerPrice: vp.consumerPrice || "",
        pricingType: vp.pricingType || "per_unit",
        orderMin: vp.orderMin || "1",
        orderMax: vp.orderMax || "",
        orderIncrement: vp.orderIncrement || "1",
        orderUnit: vp.orderUnit || "piece",
        minMarginPercent: vp.minMarginPercent || "",
        minMarginAmount: vp.minMarginAmount || "",
        isPackReturnRequired: vp.isPackReturnRequired ?? false,
        packDepositAmount: vp.packDepositAmount || "",
        linkedRetailVariantOptionId: vp.linkedRetailVariantOptionId || null,
        conversionRatio: vp.conversionRatio || "",
        conversionLossPercent: vp.conversionLossPercent || "0",
        autoConvert: vp.autoConvert ?? true,
      };
    }
    return map;
  });

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
      inStock: product?.inStock ?? true,
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
      deliveryCostPerCarton: (product as any)?.deliveryCostPerCarton ?? "",
      unitSize: (product as any)?.unitSize ?? "",
      visibility: (product as any)?.visibility ?? "public",
      status: (product as any)?.status ?? "active",
    },
    validators: {
      //@ts-expect-error
      onSubmit: isEdit ? updateProductSchema : createProductSchema,
    },
    onSubmit: async ({ value }) => {
      // Build variant prices array from state (full settings per variant)
      const vpArray = Object.values(variantPrices)
        .filter((vp) => vp && vp.variantOptionId)
        .map((vp) => ({
          variantOptionId: vp.variantOptionId,
          variantType: (vp.variantType || null) as "trade" | "retail" | null,
          consumerPrice: vp.consumerPrice || "0",
          pricingType: (vp.pricingType || "per_unit") as "per_unit" | "bulk_rate",
          orderMin: vp.orderMin || "1",
          orderMax: vp.orderMax || null,
          orderIncrement: vp.orderIncrement || "1",
          orderUnit: vp.orderUnit || "piece",
          minMarginPercent: vp.minMarginPercent || null,
          minMarginAmount: vp.minMarginAmount || null,
          isPackReturnRequired: vp.isPackReturnRequired ?? false,
          packDepositAmount: vp.packDepositAmount || null,
          // Conversion
          linkedRetailVariantOptionId: vp.linkedRetailVariantOptionId || null,
          conversionRatio: vp.conversionRatio || null,
          conversionLossPercent: vp.conversionLossPercent || "0",
          autoConvert: vp.autoConvert ?? true,
        }));

      const payload = {
        ...value,
        coreProductId: selectedCoreProductId,
        brandIds: selectedBrandIds.length > 0 ? selectedBrandIds : undefined,
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

                    {selectedCoreProduct && (
                      <div className="bg-muted/50 rounded-lg p-4 text-sm space-y-2">
                        <p className="font-medium text-green-600">
                          ✓ Core Identity Selected
                        </p>
                        <div className="grid grid-cols-2 gap-2 text-muted-foreground">
                          <span>Name: <span className="text-foreground font-medium">{selectedCoreProduct.name}</span></span>
                          <span>Category: <span className="text-foreground font-medium">{selectedCoreProduct.category?.name}</span></span>
                          <span>Brands: <span className="text-foreground font-medium">{selectedCoreProduct.brands?.length ?? 0} linked</span></span>
                          <span>SKU: <span className="text-foreground font-mono">{selectedCoreProduct.sku}</span></span>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* ── 2. Brand Selection (Multi) ── */}
              {selectedCoreProduct && selectedCoreProduct.brands?.length > 0 && (
                <Card>
                  <CardHeader className="pb-4">
                    <div className="flex items-center gap-2">
                      <Tag className="h-4 w-4 text-muted-foreground" />
                      <CardTitle className="text-base">
                        Brand Selection
                      </CardTitle>
                    </div>
                    <CardDescription>
                      Select which brands this product stocks (from Core
                      Identity's linked brands)
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {selectedCoreProduct.brands.map((b: any) => {
                        const isChecked = selectedBrandIds.includes(b.brandId);
                        return (
                          <label
                            key={b.brandId}
                            className={`flex items-center gap-2 border rounded-md px-3 py-2 cursor-pointer transition-colors ${
                              isChecked
                                ? "border-primary bg-primary/5"
                                : "border-border hover:border-primary/30"
                            }`}
                          >
                            <input
                              type="checkbox"
                              className="accent-primary h-4 w-4"
                              checked={isChecked}
                              onChange={() => {
                                setSelectedBrandIds((prev) =>
                                  isChecked
                                    ? prev.filter((id) => id !== b.brandId)
                                    : [...prev, b.brandId],
                                );
                              }}
                            />
                            <span className="text-sm font-medium">
                              {b.brand.name}
                            </span>
                            {b.isDefault && (
                              <Badge variant="secondary" className="text-[10px] ml-auto">
                                Default
                              </Badge>
                            )}
                          </label>
                        );
                      })}
                    </div>
                    {selectedBrandIds.length > 0 && (
                      <p className="text-xs text-muted-foreground mt-2">
                        {selectedBrandIds.length} brand{selectedBrandIds.length > 1 ? "s" : ""} selected
                      </p>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* ── 3. Variant Structure (read-only) + Pricing ── */}
              {selectedCoreProduct && (
                <VariantPricingCard
                  coreProductId={selectedCoreProduct.id}
                  variantPrices={variantPrices}
                  setVariantPrices={setVariantPrices}
                />
              )}

              {/* ── Legacy Variants (edit mode only, for backward compat) ── */}
              {isEdit && product?.id && !selectedCoreProductId && (
                <ProductVariantsCard
                  productId={product.id}
                  initialVariants={product?.variants ?? []}
                />
              )}
              {!isEdit && !selectedCoreProductId && (
                <ProductDraftVariantsCard
                  draftVariants={draftVariants}
                  setDraftVariants={setDraftVariants}
                />
              )}

              {/* ── 4. Delivery Cost ── */}
              <Card>
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-2">
                    <Truck className="h-4 w-4 text-muted-foreground" />
                    <CardTitle className="text-base">Unit Size & Delivery</CardTitle>
                  </div>
                  <CardDescription>
                    Define the total unit size (carton/sack) and delivery cost.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <form.Field name="unitSize">
                      {(field) => (
                        <Field>
                          <FieldLabel>Total Unit Size (KG)</FieldLabel>
                          <Input
                            value={field.state.value}
                            onChange={(e) => field.handleChange(e.target.value)}
                            placeholder="e.g. 50 for 50KG carton"
                            type="number"
                            step="1"
                            min="1"
                            className="w-full"
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            Conversion: unitSize ÷ variant size = packs per unit
                          </p>
                        </Field>
                      )}
                    </form.Field>
                    <form.Field name="deliveryCostPerCarton">
                      {(field) => (
                        <Field>
                          <FieldLabel>Per Carton (৳)</FieldLabel>
                          <Input
                            value={field.state.value}
                            onChange={(e) => field.handleChange(e.target.value)}
                            placeholder="e.g. 50"
                            type="number"
                            step="0.01"
                            className="w-full"
                          />
                        </Field>
                      )}
                    </form.Field>
                  </div>
                </CardContent>
              </Card>

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
                  <form.Field name="inStock">
                    {(field) => (
                      <div className="flex items-center justify-between">
                        <div>
                          <FieldLabel className="text-sm font-medium">
                            In Stock
                          </FieldLabel>
                          <p className="text-xs text-muted-foreground">
                            Available for purchase
                          </p>
                        </div>
                        <Switch
                          checked={field.state.value}
                          onCheckedChange={field.handleChange}
                        />
                      </div>
                    )}
                  </form.Field>

                  <Separator />

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

              {/* Organization (edit mode or legacy) */}
              {(isEdit || !selectedCoreProductId) && (
                <Card>
                  <CardHeader className="pb-4">
                    <div className="flex items-center gap-2">
                      <Tag className="h-4 w-4 text-muted-foreground" />
                      <CardTitle className="text-base">Organization</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {!selectedCoreProductId && (
                      <>
                        <form.Field name="name">
                          {(field) => (
                            <Field>
                              <FieldLabel>Name</FieldLabel>
                              <Input
                                value={field.state.value}
                                onChange={(e) => {
                                  field.handleChange(e.target.value);
                                  autoGenerateSlugFromName(e.target.value);
                                }}
                                placeholder="Product name"
                              />
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
                      </>
                    )}

                    <form.Field name="supplier">
                      {(field) => (
                        <Field>
                          <FieldLabel>Supplier (optional)</FieldLabel>
                          <Input
                            value={field.state.value ?? ""}
                            onChange={(e) =>
                              field.handleChange(e.target.value || "")
                            }
                            placeholder="e.g. ABC Suppliers"
                          />
                        </Field>
                      )}
                    </form.Field>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}

// ============================================================
// Per-variant settings type
// ============================================================

export type VariantPriceSettings = {
  variantOptionId: number;
  variantType?: "trade" | "retail" | null;
  consumerPrice: string;
  pricingType: string;
  orderMin: string;
  orderMax: string;
  orderIncrement: string;
  orderUnit: string;
  minMarginPercent: string;
  minMarginAmount: string;
  isPackReturnRequired: boolean;
  packDepositAmount: string;
  // Conversion (trade only)
  linkedRetailVariantOptionId?: number | null;
  conversionRatio: string;
  conversionLossPercent: string;
  autoConvert: boolean;
};

// ============================================================
// Variant Pricing Card — shows read-only variants with per-variant config
// ============================================================

function VariantPricingCard({
  coreProductId,
  variantPrices,
  setVariantPrices,
}: {
  coreProductId: number;
  variantPrices: Record<number, VariantPriceSettings>;
  setVariantPrices: (prices: Record<number, VariantPriceSettings>) => void;
}) {
  // Fetch the core product's linked variant options
  const { data: cpData } = useQuery(
    orpc.adminCoreProduct.getById.queryOptions({
      input: { id: coreProductId },
    }),
  );

  const linkedVariants = cpData?.coreProduct?.variantLinks ?? [];

  const getSettings = (variantOptionId: number): VariantPriceSettings => {
    return variantPrices[variantOptionId] ?? {
      variantOptionId,
      variantType: null,
      consumerPrice: "",
      pricingType: "per_unit",
      orderMin: "1",
      orderMax: "",
      orderIncrement: "1",
      orderUnit: "piece",
      minMarginPercent: "",
      minMarginAmount: "",
      isPackReturnRequired: false,
      packDepositAmount: "",
      linkedRetailVariantOptionId: null,
      conversionRatio: "",
      conversionLossPercent: "0",
      autoConvert: true,
    };
  };

  const updateField = (variantOptionId: number, field: keyof VariantPriceSettings, value: any) => {
    const current = getSettings(variantOptionId);
    setVariantPrices({
      ...variantPrices,
      [variantOptionId]: { ...current, variantOptionId, [field]: value },
    });
  };

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center gap-2">
          <Package className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-base">Variant Configuration</CardTitle>
        </div>
        <CardDescription>
          Variants are auto-populated from the Core Identity. Configure type,
          pricing, and order rules for each.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {linkedVariants.length === 0 ? (
          <div className="text-center py-6 border border-dashed rounded-lg">
            <Package className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">
              No variants linked to this Core Identity.
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Link variants from the Core Product detail page first.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {linkedVariants.map((link: any) => {
              const v = link.variantOption;
              const settings = getSettings(v.id);
              const isTrade = settings.variantType === "trade";

              return (
                <div
                  key={link.id}
                  className="border rounded-lg p-4 space-y-3 hover:border-primary/30 transition-colors"
                >
                  {/* Row 1: Variant identity (read-only) + Type selector + Price */}
                  <div className="grid grid-cols-1 sm:grid-cols-[1fr_130px_130px_120px] gap-3 items-end">
                    {/* Variant info (pre-populated, read-only) */}
                    <div className="space-y-0.5">
                      <p className="text-sm font-medium">{v.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {v.size ? `${v.size} ${v.unit}` : v.unit}
                        {v.variantType && (
                          <Badge variant="outline" className="ml-2 text-[10px]">
                            {v.variantType === "pack" ? "Pack" : "Loose"}
                          </Badge>
                        )}
                      </p>
                    </div>

                    {/* Channel: Trade / Retail */}
                    <Field>
                      <FieldLabel className="text-xs">Channel</FieldLabel>
                      <Select
                        value={settings.variantType ?? "none"}
                        onValueChange={(val) =>
                          updateField(v.id, "variantType", val === "none" ? null : val)
                        }
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Not set</SelectItem>
                          <SelectItem value="trade">Trade (B2B)</SelectItem>
                          <SelectItem value="retail">Retail (B2C)</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>

                    {/* Pricing Type (auto-determined from variant type) */}
                    <Field>
                      <FieldLabel className="text-xs">Pricing</FieldLabel>
                      <div className="h-8 flex items-center px-3 border rounded-md bg-muted/50 text-xs text-muted-foreground">
                        {v.variantType === "loose" ? "Per KG" : "Per Unit"}
                      </div>
                    </Field>

                    {/* Price */}
                    <Field>
                      <FieldLabel className="text-xs">
                        Price (৳) {!isTrade && "*"}
                      </FieldLabel>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder={isTrade ? "Set by shop" : "0"}
                        className="h-8 text-xs"
                        value={isTrade ? "" : settings.consumerPrice}
                        onChange={(e) =>
                          updateField(v.id, "consumerPrice", e.target.value)
                        }
                        disabled={isTrade}
                      />
                    </Field>
                  </div>

                  {/* Trade B2B notice */}
                  {isTrade && (
                    <p className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/30 dark:text-amber-300 rounded px-2 py-1">
                      ⚠ Trade variant — price set by shop owners. Warehouse buys this unit.
                    </p>
                  )}

                  {/* Row 2: Order Rules (collapsible) */}
                  <details className="group">
                    <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground select-none">
                      ▸ Order rules &amp; advanced settings
                    </summary>
                    <div className="mt-3 pt-3 border-t space-y-3">
                      {/* Order rules */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <Field>
                          <FieldLabel className="text-xs">Min Qty</FieldLabel>
                          <Input
                            className="h-8 text-xs"
                            value={settings.orderMin}
                            onChange={(e) =>
                              updateField(v.id, "orderMin", e.target.value)
                            }
                            placeholder="1"
                          />
                        </Field>
                        <Field>
                          <FieldLabel className="text-xs">Max Qty</FieldLabel>
                          <Input
                            className="h-8 text-xs"
                            value={settings.orderMax}
                            onChange={(e) =>
                              updateField(v.id, "orderMax", e.target.value)
                            }
                            placeholder="No limit"
                          />
                        </Field>
                        <Field>
                          <FieldLabel className="text-xs">Step</FieldLabel>
                          <Input
                            className="h-8 text-xs"
                            value={settings.orderIncrement}
                            onChange={(e) =>
                              updateField(v.id, "orderIncrement", e.target.value)
                            }
                            placeholder="1"
                          />
                        </Field>
                        <Field>
                          <FieldLabel className="text-xs">Order Unit</FieldLabel>
                          <Select
                            value={settings.orderUnit}
                            onValueChange={(val) =>
                              updateField(v.id, "orderUnit", val)
                            }
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="piece">Piece</SelectItem>
                              <SelectItem value="kg">KG</SelectItem>
                              <SelectItem value="carton">Carton</SelectItem>
                              <SelectItem value="sack">Sack</SelectItem>
                              <SelectItem value="box">Box</SelectItem>
                              <SelectItem value="liter">Liter</SelectItem>
                            </SelectContent>
                          </Select>
                        </Field>
                      </div>

                      {/* Trade-only: Margin rules + Pack return */}
                      {isTrade && (
                        <div className="space-y-3">
                          <div className="grid grid-cols-2 gap-3">
                            <Field>
                              <FieldLabel className="text-xs">
                                Min Margin (%)
                              </FieldLabel>
                              <Input
                                className="h-8 text-xs"
                                value={settings.minMarginPercent}
                                onChange={(e) =>
                                  updateField(v.id, "minMarginPercent", e.target.value)
                                }
                                placeholder="e.g. 5"
                              />
                            </Field>
                            <Field>
                              <FieldLabel className="text-xs">
                                Min Margin (৳)
                              </FieldLabel>
                              <Input
                                className="h-8 text-xs"
                                value={settings.minMarginAmount}
                                onChange={(e) =>
                                  updateField(v.id, "minMarginAmount", e.target.value)
                                }
                                placeholder="e.g. 50"
                              />
                            </Field>
                          </div>
                          <div className="grid grid-cols-2 gap-3 items-center">
                            <div className="flex items-center justify-between border rounded-lg p-2">
                              <span className="text-xs">Pack Return Required</span>
                              <Switch
                                checked={settings.isPackReturnRequired}
                                onCheckedChange={(val) =>
                                  updateField(v.id, "isPackReturnRequired", val)
                                }
                              />
                            </div>
                            {settings.isPackReturnRequired && (
                              <Field>
                                <FieldLabel className="text-xs">
                                  Deposit (৳)
                                </FieldLabel>
                                <Input
                                  className="h-8 text-xs"
                                  value={settings.packDepositAmount}
                                  onChange={(e) =>
                                    updateField(v.id, "packDepositAmount", e.target.value)
                                  }
                                  placeholder="e.g. 200"
                                />
                              </Field>
                            )}
                          </div>

                          {/* Conversion: Trade → Retail */}
                          <div className="space-y-2 pt-2 border-t">
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                              Conversion Rules
                            </p>
                            <div className="grid grid-cols-2 gap-3">
                              <Field>
                                <FieldLabel className="text-xs">
                                  Target Retail Variant
                                </FieldLabel>
                                <Select
                                  value={settings.linkedRetailVariantOptionId?.toString() ?? "none"}
                                  onValueChange={(val) =>
                                    updateField(v.id, "linkedRetailVariantOptionId",
                                      val === "none" ? null : Number(val))
                                  }
                                >
                                  <SelectTrigger className="h-8 text-xs">
                                    <SelectValue placeholder="Select retail variant" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="none">None</SelectItem>
                                    {linkedVariants
                                      .filter((lv: any) => {
                                        const otherId = lv.variantOption.id;
                                        const otherSettings = getSettings(otherId);
                                        return otherSettings.variantType === "retail" && otherId !== v.id;
                                      })
                                      .map((lv: any) => (
                                        <SelectItem key={lv.variantOption.id} value={lv.variantOption.id.toString()}>
                                          {lv.variantOption.name}
                                        </SelectItem>
                                      ))}
                                  </SelectContent>
                                </Select>
                              </Field>
                              <Field>
                                <FieldLabel className="text-xs">
                                  Conversion Ratio (1:{settings.conversionRatio || "?"})
                                </FieldLabel>
                                <Input
                                  className="h-8 text-xs"
                                  type="number"
                                  value={settings.conversionRatio}
                                  onChange={(e) =>
                                    updateField(v.id, "conversionRatio", e.target.value)
                                  }
                                  placeholder="e.g. 10"
                                />
                              </Field>
                            </div>
                            <div className="grid grid-cols-2 gap-3 items-center">
                              <Field>
                                <FieldLabel className="text-xs">
                                  Loss %
                                </FieldLabel>
                                <Input
                                  className="h-8 text-xs"
                                  type="number"
                                  step="0.1"
                                  value={settings.conversionLossPercent}
                                  onChange={(e) =>
                                    updateField(v.id, "conversionLossPercent", e.target.value)
                                  }
                                  placeholder="0"
                                />
                              </Field>
                              <div className="flex items-center justify-between border rounded-lg p-2">
                                <span className="text-xs">Auto Convert on Delivery</span>
                                <Switch
                                  checked={settings.autoConvert}
                                  onCheckedChange={(val) =>
                                    updateField(v.id, "autoConvert", val)
                                  }
                                />
                              </div>
                            </div>
                            {settings.linkedRetailVariantOptionId && settings.conversionRatio && (
                              <p className="text-xs text-blue-600 bg-blue-50 dark:bg-blue-950/30 dark:text-blue-300 rounded px-2 py-1">
                                📦 1 × {v.name} → {settings.conversionRatio} ×{" "}
                                {linkedVariants.find((lv: any) =>
                                  lv.variantOption.id === settings.linkedRetailVariantOptionId
                                )?.variantOption?.name || "Retail"}
                                {Number(settings.conversionLossPercent) > 0 &&
                                  ` (${settings.conversionLossPercent}% loss)`}
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </details>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}


