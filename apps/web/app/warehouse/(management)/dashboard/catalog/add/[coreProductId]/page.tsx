"use client";

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
  Search,
  Settings,
  Tag,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import ImageUploader from "@/components/ImageUploader";
import AdditionalImagesUploader from "@/components/AdditionalImagesUploader";
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
  selectedVariantIds: number[];
  variantSettings: Record<number, VariantConfig>;
};

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
  const [trackingType, setTrackingType] = useState<"none" | "batch" | "serial">("none");
  const [expiryEnabled, setExpiryEnabled] = useState(false);
  const [damageControlEnabled, setDamageControlEnabled] = useState(false);
  const [isReturnablePack, setIsReturnablePack] = useState(false);

  // Visibility
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [status, setStatus] = useState<"active" | "draft">("active");

  // Brand configuration
  const [brandConfigs, setBrandConfigs] = useState<BrandConfig[]>([]);
  const [expandedBrandId, setExpandedBrandId] = useState<number | null>(null);
  const [brandModalOpen, setBrandModalOpen] = useState(false);
  const [brandSearch, setBrandSearch] = useState("");

  // Track if we've already initialized from core product
  const [initialized, setInitialized] = useState(false);

  // === Queries ===

  const { data: coreProductData, isLoading: loadingCoreProduct } = useQuery({
    queryKey: ["warehouse", "getCoreProductById", { id: coreProductId }],
    queryFn: () => (orpc.warehouse as any).getCoreProductById.call({ id: coreProductId }),
    enabled: !!coreProductId && !isNaN(coreProductId),
  });

  const coreProduct = coreProductData?.coreProduct;

  // Auto-fill from core product on load (once)
  if (coreProduct && !initialized) {
    setName(coreProduct.name);
    setSlug(coreProduct.slug);
    setMainImage(coreProduct.image || "");
    setInitialized(true);
  }

  const { data: brandsAndVariantsData } = useQuery({
    queryKey: [
      "warehouse",
      "getBrandsAndVariants",
      { typeId: coreProduct?.category?.typeId, categoryId: coreProduct?.categoryId },
    ],
    queryFn: () =>
      (orpc.warehouse as any).getBrandsAndVariants.call({
        typeId: coreProduct?.category?.typeId,
        categoryId: coreProduct?.categoryId,
      }),
    enabled: !!coreProduct,
  });

  const allBrands: any[] = brandsAndVariantsData?.brands ?? [];
  const allVariantOptions: any[] = brandsAndVariantsData?.variantOptions ?? [];

  // === Mutation ===

  const createMutation = useMutation({
    mutationFn: (data: any) => (orpc.warehouse as any).createWarehouseProduct.call(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["warehouse"] });
      toast.success("Product created successfully!");
      router.push("/warehouse/dashboard/catalog");
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
  const availableBrands = allBrands.filter((b: any) => !configuredBrandIds.has(b.id));

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
          const newIds = bc.selectedVariantIds.filter((id) => id !== variantOptionId);
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

  const updateRetailerPrice = (
    brandId: number,
    variantOptionId: number,
    price: string,
  ) => {
    setBrandConfigs((prev) =>
      prev.map((bc) => {
        if (bc.brandId !== brandId) return bc;
        const current = bc.variantSettings[variantOptionId] ?? {
          variantOptionId,
          retailerPrice: "",
        };
        return {
          ...bc,
          variantSettings: {
            ...bc.variantSettings,
            [variantOptionId]: { ...current, retailerPrice: price },
          },
        };
      }),
    );
  };

  const handleSubmit = (submitStatus: "active" | "draft") => {
    if (!name.trim()) {
      toast.error("Product name is required");
      return;
    }
    if (!mainImage) {
      toast.error("Product image is required");
      return;
    }
    if (brandConfigs.length === 0) {
      toast.error("Add at least one brand");
      return;
    }

    // Check that each brand has at least one variant with a price
    for (const bc of brandConfigs) {
      if (bc.selectedVariantIds.length === 0) {
        toast.error(`Brand "${bc.brandName}" needs at least one variant`);
        return;
      }
      for (const voId of bc.selectedVariantIds) {
        const settings = bc.variantSettings[voId];
        if (!settings?.retailerPrice || Number(settings.retailerPrice) <= 0) {
          toast.error(`Set a retailer price for all variants in "${bc.brandName}"`);
          return;
        }
      }
    }

    const payload = {
      coreProductId,
      name: name.trim(),
      slug: slug.trim() || generateSlug(name),
      shortDescription: shortDescription || null,
      description: description || null,
      image: mainImage,
      categoryId: coreProduct?.categoryId,
      subCategoryId: coreProduct?.subCategoryId || null,
      brandConfigs: brandConfigs.map((bc) => ({
        brandId: bc.brandId,
        variants: bc.selectedVariantIds.map((voId) => ({
          variantOptionId: voId,
          retailerPrice: bc.variantSettings[voId]?.retailerPrice || "0",
        })),
      })),
      trackingType,
      expiryEnabled,
      damageControlEnabled,
      isReturnablePack,
      status: submitStatus,
      visibility,
      additionalImages: additionalImages.length > 0 ? additionalImages : undefined,
      videoUrl: videoUrl || null,
    };

    createMutation.mutate(payload);
  };

  // === Loading ===

  if (loadingCoreProduct) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading product template...</p>
        </div>
      </div>
    );
  }

  if (!coreProduct) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-center">
          <Package className="h-12 w-12 text-muted-foreground/30" />
          <p className="text-lg font-semibold text-muted-foreground">Core product not found</p>
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
              <Button onClick={() => handleSubmit("active")} disabled={isPending}>
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
                  <CardTitle className="text-base">Core Product Identity</CardTitle>
                </div>
                <CardDescription>
                  This product is based on the following core identity (read-only)
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
                    <p className="font-semibold text-foreground">{coreProduct.name}</p>
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
                  Set the display name for this product. Pre-filled from Core Identity but can be customized.
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
                    Brand & Variant Configuration
                  </CardTitle>
                </div>
                <CardDescription>
                  Select brands and configure variant pack sizes with retailer prices for each.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Brand configs */}
                {brandConfigs.map((bc) => (
                  <BrandConfigCard
                    key={bc.brandId}
                    config={bc}
                    variantOptions={allVariantOptions}
                    isExpanded={expandedBrandId === bc.brandId}
                    onToggleExpand={() =>
                      setExpandedBrandId(expandedBrandId === bc.brandId ? null : bc.brandId)
                    }
                    onRemove={() => handleRemoveBrand(bc.brandId)}
                    onToggleVariant={(voId) => handleToggleVariant(bc.brandId, voId)}
                    onUpdatePrice={(voId, price) => updateRetailerPrice(bc.brandId, voId, price)}
                  />
                ))}

                {/* Add Brand Button */}
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
                    Add a brand...
                  </Button>
                  {brandConfigs.length === 0 && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Select a brand to begin configuring variants for this product.
                    </p>
                  )}
                </div>

                {/* Brand Selector Modal */}
                <Dialog open={brandModalOpen} onOpenChange={setBrandModalOpen}>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>Select Brand</DialogTitle>
                      <DialogDescription>
                        Search and select a brand to add to this product.
                      </DialogDescription>
                    </DialogHeader>
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
                            b.name.toLowerCase().includes(brandSearch.toLowerCase()),
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
                                <img
                                  src={b.logo}
                                  alt={b.name}
                                  className="h-8 w-8 rounded-md object-cover border"
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
                  </DialogContent>
                </Dialog>

                {brandConfigs.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {brandConfigs.length} brand{brandConfigs.length > 1 ? "s" : ""} configured
                    {" "} — one product will be created with all brands attached
                  </p>
                )}
              </CardContent>
            </Card>

            {/* ── 4. Product Details ── */}
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-base">Product Details</CardTitle>
                <CardDescription>Additional product information</CardDescription>
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
                      <p className="text-xs text-muted-foreground">Visible to all shops</p>
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
                      <p className="text-xs text-muted-foreground">Only visible to you</p>
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
                    <span className="text-muted-foreground">Brands</span>
                    <span className="font-medium">{brandConfigs.length}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Total Variants</span>
                    <span className="font-medium">
                      {brandConfigs.reduce((sum, bc) => sum + bc.selectedVariantIds.length, 0)}
                    </span>
                  </div>
                  <Separator />
                  <div className="space-y-1.5">
                    {brandConfigs.map((bc) => (
                      <div key={bc.brandId} className="text-xs">
                        <span className="font-medium">{bc.brandName}</span>
                        <span className="text-muted-foreground ml-1">
                          ({bc.selectedVariantIds.length} variant{bc.selectedVariantIds.length !== 1 ? "s" : ""})
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
  isExpanded,
  onToggleExpand,
  onRemove,
  onToggleVariant,
  onUpdatePrice,
}: {
  config: BrandConfig;
  variantOptions: any[];
  isExpanded: boolean;
  onToggleExpand: () => void;
  onRemove: () => void;
  onToggleVariant: (variantOptionId: number) => void;
  onUpdatePrice: (variantOptionId: number, price: string) => void;
}) {
  return (
    <div className="space-y-3">
      {/* Brand header */}
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
          {config.selectedVariantIds.length} variant
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
            {variantOptions.map((v: any) => {
              const isIncluded = config.selectedVariantIds.includes(v.id);
              const settings = isIncluded ? config.variantSettings[v.id] : null;

              return (
                <div
                  key={v.id}
                  className={`flex items-center gap-3 rounded-md px-3 py-2 transition-colors ${
                    isIncluded ? "bg-muted/50" : "hover:bg-muted/30"
                  }`}
                >
                  <Checkbox
                    checked={isIncluded}
                    onCheckedChange={() => onToggleVariant(v.id)}
                  />
                  <span
                    className={`text-sm flex-1 min-w-0 ${
                      isIncluded ? "text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    {v.name}
                    {v.size && (
                      <span className="text-muted-foreground ml-1">
                        · {v.size} {v.unit}
                      </span>
                    )}
                  </span>
                  {isIncluded && settings && (
                    <div className="relative w-28 shrink-0">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
                        ৳
                      </span>
                      <Input
                        className="h-7 text-sm pl-6 pr-2 text-right"
                        type="number"
                        step="0.01"
                        value={settings.retailerPrice}
                        onChange={(e) => onUpdatePrice(v.id, e.target.value)}
                        placeholder="Price"
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
