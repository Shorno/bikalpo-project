"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  ImageIcon,
  Loader,
  Package,
  Plus,
  Save,
  Search,
  Settings,
  Tag,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
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
import { generateSlug } from "@/utils/generate-slug";
import { orpc } from "@/utils/orpc";

// ============================================================
// Types
// ============================================================

type VariantConfig = {
  variantOptionId: number;
  retailerPrice: string;
};

type BrandConfig = {
  brandId: number;
  brandName: string;
  colorName?: string;
  selectedVariantIds: number[];
  variantSettings: Record<number, VariantConfig>;
};

function isFashionTypeName(typeName?: string | null) {
  return (
    String(typeName || "")
      .trim()
      .toLowerCase() === "fashion"
  );
}

// ============================================================
// Main Component
// ============================================================

export default function WarehouseAddProductPage() {
  const router = useRouter();
  const params = useParams();
  const queryClient = useQueryClient();
  const coreProductId = Number(params.coreProductId);

  // === Form state ===
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [shortDescription, setShortDescription] = useState("");
  const [description, setDescription] = useState("");
  const [mainImage, setMainImage] = useState("");
  const [additionalImages, setAdditionalImages] = useState<string[]>([]);
  const [videoUrl, setVideoUrl] = useState("");

  // Supply rules
  const [trackingType, setTrackingType] = useState<"none" | "batch" | "serial">(
    "none",
  );
  const [expiryEnabled, setExpiryEnabled] = useState(false);
  const [damageControlEnabled, setDamageControlEnabled] = useState(false);
  const [isReturnablePack, setIsReturnablePack] = useState(false);

  // Visibility
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  // Brand configuration
  const [brandConfigs, setBrandConfigs] = useState<BrandConfig[]>([]);
  const [expandedBrandId, setExpandedBrandId] = useState<number | null>(null);
  const [brandModalOpen, setBrandModalOpen] = useState(false);
  const [brandSearch, setBrandSearch] = useState("");

  // Track if we've already initialized from core product
  const [initialized, setInitialized] = useState(false);

  // === Queries ===

  const { data: configurationData, isLoading: loadingCoreProduct } = useQuery({
    queryKey: [
      "warehouse",
      "getWarehouseCoreConfiguration",
      { coreProductId },
    ],
    queryFn: () =>
      (orpc.warehouse as any).getWarehouseCoreConfiguration.call({
        coreProductId,
      }),
    enabled: !!coreProductId && !Number.isNaN(coreProductId),
  });

  const coreProduct = configurationData?.core;
  const isFashionCategory = isFashionTypeName(
    coreProduct?.category?.type?.name,
  );
  // Fashion and Footwear now follow the same real-brand card invariant.
  const isFashionProduct = false;
  const primaryAttributeLabel = "Brand";
  const variantDimensionLabel = isFashionCategory ? "Size" : "Variant";

  const allBrands: any[] = configurationData?.options?.brands ?? [];
  const allVariantOptions: any[] =
    configurationData?.options?.variantOptions ?? [];

  useEffect(() => {
    if (!configurationData || initialized) return;

    const defaults = configurationData.defaults ?? {};
    setName(defaults.name || configurationData.core.name);
    setSlug(defaults.slug || configurationData.core.slug);
    setShortDescription(defaults.shortDescription || "");
    setDescription(defaults.description || "");
    setMainImage(defaults.image || configurationData.core.image || "");
    setAdditionalImages(defaults.additionalImages || []);
    setVideoUrl(defaults.videoUrl || "");
    setTrackingType(defaults.trackingType || "none");
    setExpiryEnabled(Boolean(defaults.expiryEnabled));
    setDamageControlEnabled(Boolean(defaults.damageControlEnabled));
    setIsReturnablePack(Boolean(defaults.isReturnablePack));

    const sourceBrands = configurationData.current?.length
      ? configurationData.current
      : configurationData.adminPreset?.brands ?? [];
    setBrandConfigs(
      sourceBrands
        .filter((brand: any) => brand.brandId)
        .map((brand: any) => ({
          brandId: brand.brandId,
          brandName:
            brand.brandName ||
            configurationData.options.brands.find(
              (option: any) => option.id === brand.brandId,
            )?.name ||
            "Unknown brand",
          selectedVariantIds: brand.variants
            .filter((variant: any) => variant.isActive !== false)
            .map((variant: any) => variant.variantOptionId),
          variantSettings: Object.fromEntries(
            brand.variants.map((variant: any) => [
              variant.variantOptionId,
              {
                variantOptionId: variant.variantOptionId,
                retailerPrice: "",
              },
            ]),
          ),
        })),
    );
    setInitialized(true);
  }, [configurationData, initialized]);

  const reloadAdminPreset = () => {
    if (!configurationData?.adminPreset?.available) return;
    const defaults = configurationData.adminDefaults ?? {};
    setName(defaults.name || configurationData.core.name);
    setSlug(defaults.slug || configurationData.core.slug);
    setShortDescription(defaults.shortDescription || "");
    setDescription(defaults.description || "");
    setMainImage(defaults.image || configurationData.core.image || "");
    setAdditionalImages(defaults.additionalImages || []);
    setVideoUrl(defaults.videoUrl || "");
    setTrackingType(defaults.trackingType || "none");
    setExpiryEnabled(Boolean(defaults.expiryEnabled));
    setDamageControlEnabled(Boolean(defaults.damageControlEnabled));
    setIsReturnablePack(Boolean(defaults.isReturnablePack));
    setBrandConfigs(
      configurationData.adminPreset.brands.map((brand: any) => ({
        brandId: brand.brandId,
        brandName: brand.brandName,
        selectedVariantIds: brand.variants.map(
          (variant: any) => variant.variantOptionId,
        ),
        variantSettings: Object.fromEntries(
          brand.variants.map((variant: any) => [
            variant.variantOptionId,
            { variantOptionId: variant.variantOptionId, retailerPrice: "" },
          ]),
        ),
      })),
    );
    toast.success("Current admin preset loaded. Save to apply it.");
  };

  // === Mutation ===

  const createMutation = useMutation({
    mutationFn: (data: any) =>
      (orpc.warehouse as any).configureWarehouseCoreProducts.call(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["warehouse"] });
      toast.success("Warehouse product configuration saved");
      router.push("/warehouse/dashboard/products");
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to create product");
    },
  });

  const isPending = createMutation.isPending;

  // === Handlers ===

  const handleNameChange = (value: string) => {
    setName(value);
    setSlug(generateSlug(value));
  };

  const configuredBrandIds = new Set(brandConfigs.map((bc) => bc.brandId));
  const availableBrands = allBrands.filter(
    (b: any) => !configuredBrandIds.has(b.id),
  );
  const configuredColorKeys = new Set(
    brandConfigs.map((bc) =>
      String(bc.colorName || bc.brandName)
        .trim()
        .toLowerCase(),
    ),
  );

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
    setExpandedBrandId(brandId);
  };

  const handleAddColor = (rawColor: string) => {
    const colorName = rawColor.trim();
    if (!colorName) return;

    if (configuredColorKeys.has(colorName.toLowerCase())) {
      toast.error(`Color "${colorName}" has already been added`);
      return;
    }

    const syntheticId = -Date.now();
    const newConfig: BrandConfig = {
      brandId: syntheticId,
      brandName: colorName,
      colorName,
      selectedVariantIds: [],
      variantSettings: {},
    };

    setBrandConfigs((prev) => [...prev, newConfig]);
    setExpandedBrandId(syntheticId);
    setBrandSearch("");
    setBrandModalOpen(false);
  };

  const handleAddExistingColorBrand = (brandId: number) => {
    const brand = allBrands.find((b: any) => b.id === brandId);
    if (!brand) return;

    const colorName = String(brand.name || "").trim();
    if (!colorName) return;

    if (configuredColorKeys.has(colorName.toLowerCase())) {
      toast.error(`Color "${colorName}" has already been added`);
      return;
    }

    const newConfig: BrandConfig = {
      brandId: brand.id,
      brandName: brand.name,
      colorName,
      selectedVariantIds: [],
      variantSettings: {},
    };

    setBrandConfigs((prev) => [...prev, newConfig]);
    setExpandedBrandId(brand.id);
    setBrandSearch("");
    setBrandModalOpen(false);
  };

  const handleRemoveBrand = (brandId: number) => {
    setBrandConfigs((prev) => prev.filter((bc) => bc.brandId !== brandId));
    if (expandedBrandId === brandId) setExpandedBrandId(null);
  };

  const handleToggleVariant = (brandId: number, variantOptionId: number) => {
    setBrandConfigs((prev) =>
      prev.map((bc) => {
        if (bc.brandId !== brandId) return bc;
        const isIncluded = bc.selectedVariantIds.includes(variantOptionId);
        if (isIncluded) {
          const newIds = bc.selectedVariantIds.filter(
            (id) => id !== variantOptionId,
          );
          const { [variantOptionId]: _, ...rest } = bc.variantSettings;
          return { ...bc, selectedVariantIds: newIds, variantSettings: rest };
        } else {
          return {
            ...bc,
            selectedVariantIds: [...bc.selectedVariantIds, variantOptionId],
            variantSettings: {
              ...bc.variantSettings,
              [variantOptionId]: {
                variantOptionId,
                retailerPrice: "",
              },
            },
          };
        }
      }),
    );
  };

  const handleSubmit = (_submitStatus: "active" | "draft") => {
    if (!name.trim()) {
      toast.error("Product name is required");
      return;
    }
    if (!mainImage) {
      toast.error("Product image is required");
      return;
    }
    if (brandConfigs.length === 0) {
      toast.error(`Add at least one ${primaryAttributeLabel.toLowerCase()}`);
      return;
    }

    // Every brand must have at least one approved variant.
    for (const bc of brandConfigs) {
      if (bc.selectedVariantIds.length === 0) {
        toast.error(
          `${primaryAttributeLabel} "${bc.brandName}" needs at least one ${variantDimensionLabel.toLowerCase()}`,
        );
        return;
      }
    }

    const payload = {
      coreProductId,
      expectedVersion: configurationData?.version ?? null,
      details: {
        name: name.trim(),
        shortDescription: shortDescription || null,
        description: description || null,
        image: mainImage,
        additionalImages,
        videoUrl: videoUrl || null,
        trackingType,
        expiryEnabled,
        damageControlEnabled,
        isReturnablePack,
        visibility,
      },
      brands: brandConfigs.map((bc) => ({
        brandId: bc.brandId,
        variants: bc.selectedVariantIds.map((variantOptionId) => ({
          variantOptionId,
        })),
      })),
    };

    createMutation.mutate(payload);
  };

  // === Loading ===

  if (loadingCoreProduct) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Loading product template...
          </p>
        </div>
      </div>
    );
  }

  if (!coreProduct) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-center">
          <Package className="h-12 w-12 text-muted-foreground/30" />
          <p className="text-lg font-semibold text-muted-foreground">
            Core product not found
          </p>
          <Button asChild variant="outline">
            <Link href="/warehouse/dashboard/catalog">← Back to Catalog</Link>
          </Button>
        </div>
      </div>
    );
  }

  // === Render ===

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 bg-background border-b">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button asChild variant="ghost" size="icon">
                <Link href="/warehouse/dashboard/catalog">
                  <ArrowLeft className="h-4 w-4" />
                </Link>
              </Button>
              <div>
                <h1 className="text-lg font-semibold">Add Product</h1>
                <p className="text-sm text-muted-foreground">
                  Create from: {coreProduct.name}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {configurationData?.adminPreset?.available && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={reloadAdminPreset}
                  disabled={isPending}
                >
                  Reload Admin Preset
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push("/warehouse/dashboard/catalog")}
                disabled={isPending}
              >
                Discard
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => handleSubmit("draft")}
                disabled={isPending}
              >
                <Save className="mr-2 h-4 w-4" />
                Save Draft
              </Button>
              <Button
                onClick={() => handleSubmit("active")}
                disabled={isPending}
              >
                {isPending && <Loader className="mr-2 h-4 w-4 animate-spin" />}
                <Save className="mr-2 h-4 w-4" />
                Create Product
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* ── 1. Core Identity (Read-only) ── */}
            <Card>
              <CardHeader className="pb-4">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-base">
                    Core Product Identity
                  </CardTitle>
                </div>
                <CardDescription>
                  This product is based on the following core identity
                  (read-only)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg border">
                  {coreProduct.image && (
                    <Image
                      src={coreProduct.image}
                      alt={coreProduct.name}
                      width={56}
                      height={56}
                      className="w-14 h-14 rounded-lg object-cover border"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground">
                      {coreProduct.name}
                    </p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {coreProduct.category?.type && (
                        <Badge variant="outline" className="text-[10px]">
                          {coreProduct.category.type.name}
                        </Badge>
                      )}
                      <Badge variant="secondary" className="text-[10px]">
                        {coreProduct.category?.name}
                      </Badge>
                      {coreProduct.subCategory && (
                        <Badge variant="secondary" className="text-[10px]">
                          {coreProduct.subCategory.name}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* ── 2. Product Name ── */}
            <Card>
              <CardHeader className="pb-4">
                <div className="flex items-center gap-2">
                  <Tag className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-base">Product Name</CardTitle>
                </div>
                <CardDescription>
                  Set the display name for this product. Pre-filled from Core
                  Identity but can be customized.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field>
                    <FieldLabel>Product Name *</FieldLabel>
                    <Input
                      value={name}
                      onChange={(e) => handleNameChange(e.target.value)}
                      placeholder="Enter product display name"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      This name will be used as the product label
                    </p>
                  </Field>
                  <Field>
                    <FieldLabel>Slug</FieldLabel>
                    <Input
                      value={slug}
                      onChange={(e) => setSlug(e.target.value)}
                      placeholder="product-slug"
                    />
                  </Field>
                </div>
              </CardContent>
            </Card>

            {/* ── 3. Brand & Variant Configuration ── */}
            <Card>
              <CardHeader className="pb-4">
                <div className="flex items-center gap-2">
                  <Tag className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-base">
                    {isFashionProduct
                      ? "Color & Size Configuration"
                      : "Brand & Variant Configuration"}
                  </CardTitle>
                </div>
                <CardDescription>
                  Select approved brands and the variants each brand should
                  offer. Selling prices remain managed from the Pricing page.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Brand configs */}
                {brandConfigs.map((bc) => (
                  <BrandConfigCard
                    key={bc.brandId}
                    config={bc}
                    variantOptions={allVariantOptions}
                    isFashion={isFashionCategory}
                    variantDimensionLabel={variantDimensionLabel}
                    isExpanded={expandedBrandId === bc.brandId}
                    onToggleExpand={() =>
                      setExpandedBrandId(
                        expandedBrandId === bc.brandId ? null : bc.brandId,
                      )
                    }
                    onRemove={() => handleRemoveBrand(bc.brandId)}
                    onToggleVariant={(voId) =>
                      handleToggleVariant(bc.brandId, voId)
                    }
                  />
                ))}

                {/* Add Attribute Button */}
                <div className="border border-dashed rounded-lg p-4">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-start gap-2 text-muted-foreground"
                    onClick={() => {
                      setBrandSearch("");
                      setBrandModalOpen(true);
                    }}
                  >
                    <Plus className="h-4 w-4" />
                    Add {primaryAttributeLabel.toLowerCase()}...
                  </Button>
                  {brandConfigs.length === 0 && (
                    <p className="text-xs text-muted-foreground mt-2">
                      {isFashionProduct
                        ? "Add a color to begin configuring size variants for this product."
                        : "Select a brand to begin configuring variants for this product."}
                    </p>
                  )}
                </div>

                {/* Attribute Selector Modal */}
                <Dialog open={brandModalOpen} onOpenChange={setBrandModalOpen}>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>
                        {isFashionProduct ? "Add Color" : "Select Brand"}
                      </DialogTitle>
                      <DialogDescription>
                        {isFashionProduct
                          ? "Type a color and add it as the primary Fashion attribute."
                          : "Search and select a brand to add to this product."}
                      </DialogDescription>
                    </DialogHeader>
                    {isFashionProduct ? (
                      <div className="space-y-3">
                        <div className="flex gap-2">
                          <Input
                            placeholder="Search saved colors or type a new one"
                            value={brandSearch}
                            onChange={(e) => setBrandSearch(e.target.value)}
                            autoFocus
                          />
                          <Button
                            type="button"
                            onClick={() => handleAddColor(brandSearch)}
                            disabled={
                              !brandSearch.trim() ||
                              configuredColorKeys.has(
                                brandSearch.trim().toLowerCase(),
                              )
                            }
                          >
                            Add
                          </Button>
                        </div>
                        <div className="space-y-2">
                          <p className="text-xs font-medium text-muted-foreground">
                            Saved brand/color options
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {availableBrands
                              .filter((b: any) =>
                                b.name
                                  .toLowerCase()
                                  .includes(brandSearch.toLowerCase()),
                              )
                              .slice(0, 24)
                              .map((brand: any) => (
                                <Button
                                  key={brand.id}
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() =>
                                    handleAddExistingColorBrand(brand.id)
                                  }
                                >
                                  {brand.name}
                                </Button>
                              ))}
                          </div>
                          {availableBrands.filter((b: any) =>
                            b.name
                              .toLowerCase()
                              .includes(brandSearch.toLowerCase()),
                          ).length === 0 && (
                            <p className="text-xs text-muted-foreground">
                              No saved brand/color matched your search.
                            </p>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {[
                            "Red",
                            "Blue",
                            "Green",
                            "Black",
                            "White",
                            "Yellow",
                          ].map((color) => (
                            <Button
                              key={color}
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={configuredColorKeys.has(
                                color.toLowerCase(),
                              )}
                              onClick={() => handleAddColor(color)}
                            >
                              {color}
                            </Button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            placeholder="Search brands..."
                            value={brandSearch}
                            onChange={(e) => setBrandSearch(e.target.value)}
                            className="pl-9"
                            autoFocus
                          />
                        </div>
                        <div className="max-h-[300px] overflow-y-auto space-y-1 -mx-1 px-1">
                          {(() => {
                            const filtered = availableBrands.filter((b: any) =>
                              b.name
                                .toLowerCase()
                                .includes(brandSearch.toLowerCase()),
                            );
                            if (filtered.length === 0) {
                              return (
                                <div className="text-center py-8 text-sm text-muted-foreground">
                                  {availableBrands.length === 0
                                    ? "All brands have been added."
                                    : "No brands match your search."}
                                </div>
                              );
                            }
                            return filtered.map((b: any) => (
                              <button
                                key={b.id}
                                type="button"
                                className="flex items-center gap-3 w-full rounded-lg px-3 py-2.5 text-sm text-left hover:bg-muted/80 transition-colors cursor-pointer"
                                onClick={() => {
                                  handleAddBrand(b.id);
                                  setBrandModalOpen(false);
                                  setBrandSearch("");
                                }}
                              >
                                {b.logo ? (
                                  <Image
                                    src={b.logo}
                                    alt={b.name}
                                    width={32}
                                    height={32}
                                    className="h-8 w-8 rounded-md object-cover border"
                                    unoptimized={b.logo.startsWith("http")}
                                  />
                                ) : (
                                  <div className="h-8 w-8 rounded-md bg-muted flex items-center justify-center text-xs font-semibold text-muted-foreground">
                                    {b.name.charAt(0).toUpperCase()}
                                  </div>
                                )}
                                <span className="font-medium">{b.name}</span>
                              </button>
                            ));
                          })()}
                        </div>
                      </div>
                    )}
                  </DialogContent>
                </Dialog>

                {brandConfigs.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {brandConfigs.length} {primaryAttributeLabel.toLowerCase()}
                    {brandConfigs.length > 1 ? "s" : ""} configured{" "}
                    {isFashionProduct
                      ? "with color-specific size options ready to create"
                      : "and ready to create as one product with all brands attached"}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* ── 4. Product Details ── */}
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-base">Product Details</CardTitle>
                <CardDescription>
                  Additional product information
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Field>
                  <FieldLabel>Short Description</FieldLabel>
                  <Input
                    value={shortDescription}
                    onChange={(e) => setShortDescription(e.target.value)}
                    placeholder="Premium quality product for daily use"
                  />
                </Field>
                <Field>
                  <FieldLabel>Full Description</FieldLabel>
                  <RichTextEditor
                    value={description}
                    onChange={setDescription}
                    placeholder="Describe your product..."
                  />
                </Field>
              </CardContent>
            </Card>

            {/* ── 5. Supply Rules ── */}
            <Card>
              <CardHeader className="pb-4">
                <div className="flex items-center gap-2">
                  <Settings className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-base">Supply Rules</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                      checked={isReturnablePack}
                      onCheckedChange={setIsReturnablePack}
                    />
                  </div>

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
                      checked={expiryEnabled}
                      onCheckedChange={setExpiryEnabled}
                    />
                  </div>

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
                      checked={damageControlEnabled}
                      onCheckedChange={setDamageControlEnabled}
                    />
                  </div>

                  <Field>
                    <FieldLabel>Tracking Type</FieldLabel>
                    <Select
                      value={trackingType}
                      onValueChange={(v) => setTrackingType(v as any)}
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
                </div>
              </CardContent>
            </Card>

            {/* ── 6. Media ── */}
            <Card>
              <CardHeader className="pb-4">
                <div className="flex items-center gap-2">
                  <ImageIcon className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-base">Media</CardTitle>
                </div>
                <CardDescription>Product images and media</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Field>
                    <FieldLabel>Thumbnail / Main Image *</FieldLabel>
                    <ImageUploader
                      value={mainImage}
                      onChange={setMainImage}
                      folder="products"
                      maxSizeMB={5}
                    />
                  </Field>
                  <Field>
                    <FieldLabel>Gallery</FieldLabel>
                    <AdditionalImagesUploader
                      value={additionalImages}
                      onChange={setAdditionalImages}
                      folder="products/additional"
                      maxSizeMB={5}
                    />
                  </Field>
                </div>
                <Field>
                  <FieldLabel>Video URL (optional)</FieldLabel>
                  <Input
                    value={videoUrl}
                    onChange={(e) => setVideoUrl(e.target.value)}
                    placeholder="https://youtube.com/watch?v=..."
                  />
                </Field>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Visibility */}
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-base">Visibility</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                    <input
                      type="radio"
                      name="visibility"
                      value="public"
                      checked={visibility === "public"}
                      onChange={() => setVisibility("public")}
                      className="accent-primary"
                    />
                    <div>
                      <p className="text-sm font-medium">Public</p>
                      <p className="text-xs text-muted-foreground">
                        Visible to all shops
                      </p>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                    <input
                      type="radio"
                      name="visibility"
                      value="private"
                      checked={visibility === "private"}
                      onChange={() => setVisibility("private")}
                      className="accent-primary"
                    />
                    <div>
                      <p className="text-sm font-medium">Private</p>
                      <p className="text-xs text-muted-foreground">
                        Only visible to you
                      </p>
                    </div>
                  </label>
                </div>
              </CardContent>
            </Card>

            {/* Summary */}
            {brandConfigs.length > 0 && (
              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="text-base">Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      {primaryAttributeLabel}s
                    </span>
                    <span className="font-medium">{brandConfigs.length}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      Total Variants
                    </span>
                    <span className="font-medium">
                      {brandConfigs.reduce(
                        (sum, bc) => sum + bc.selectedVariantIds.length,
                        0,
                      )}
                    </span>
                  </div>
                  <Separator />
                  <div className="space-y-1.5">
                    {brandConfigs.map((bc) => (
                      <div key={bc.brandId} className="text-xs">
                        <span className="font-medium">{bc.brandName}</span>
                        <span className="text-muted-foreground ml-1">
                          ({bc.selectedVariantIds.length}{" "}
                          {variantDimensionLabel.toLowerCase()}
                          {bc.selectedVariantIds.length !== 1 ? "s" : ""})
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Brand Config Card Component
// ============================================================

function BrandConfigCard({
  config,
  variantOptions,
  isFashion,
  variantDimensionLabel,
  isExpanded,
  onToggleExpand,
  onRemove,
  onToggleVariant,
}: {
  config: BrandConfig;
  variantOptions: any[];
  isFashion: boolean;
  variantDimensionLabel: string;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onRemove: () => void;
  onToggleVariant: (variantOptionId: number) => void;
}) {
  return (
    <div className="space-y-3">
      {/* Attribute header */}
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
          {config.selectedVariantIds.length}{" "}
          {variantDimensionLabel.toLowerCase()}
          {config.selectedVariantIds.length !== 1 ? "s" : ""}
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

      {/* Expanded — variant list with pricing */}
      {isExpanded && (
        <div className="pl-7 space-y-3">
          <div className="space-y-1.5">
            {(() => {
              // Check if a loose variant is already selected for this config
              const hasLooseSelected = config.selectedVariantIds.some(
                (id) =>
                  variantOptions.find((v: any) => v.id === id)?.variantType ===
                  "loose",
              );

              return variantOptions.map((v: any) => {
                const isIncluded = config.selectedVariantIds.includes(v.id);
                const isLoose = v.variantType === "loose";
                // Disable this loose checkbox if another loose is already selected
                const isDisabledLoose =
                  isLoose && !isIncluded && hasLooseSelected;

                return (
                  <div
                    key={v.id}
                    className={`flex items-center gap-3 rounded-md px-3 py-2 transition-colors ${
                      isDisabledLoose
                        ? "opacity-50 cursor-not-allowed"
                        : isIncluded
                          ? "bg-muted/50"
                          : "hover:bg-muted/30"
                    }`}
                  >
                    <Checkbox
                      checked={isIncluded}
                      disabled={isDisabledLoose}
                      onCheckedChange={() => onToggleVariant(v.id)}
                    />
                    <span
                      className={`text-sm flex-1 min-w-0 ${
                        isIncluded ? "text-foreground" : "text-muted-foreground"
                      }`}
                    >
                      {v.name}
                      {!isFashion && v.size && (
                        <span className="text-muted-foreground ml-1">
                          · {v.size} {v.unit}
                        </span>
                      )}
                      {isLoose && (
                        <span className="ml-1.5 text-[10px] font-medium text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full">
                          Loose
                        </span>
                      )}
                      {isDisabledLoose && (
                        <span className="ml-1.5 text-[10px] text-muted-foreground italic">
                          (only one loose allowed)
                        </span>
                      )}
                    </span>
                    {isIncluded && (
                      <Badge variant="secondary" className="text-[10px]">
                        Price later
                      </Badge>
                    )}
                  </div>
                );
              });
            })()}
          </div>
          <p className="text-[11px] text-muted-foreground pl-1">
            Prices are intentionally excluded from product configuration.
          </p>
        </div>
      )}

      <Separator />
    </div>
  );
}
