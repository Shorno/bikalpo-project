"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ImageIcon,
  Layers,
  Loader,
  Package,
  Plus,
  Save,
  Send,
  Settings,
  Tag,
  Trash2,
  Truck,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import ImageUploader from "@/components/ImageUploader";
import AdditionalImagesUploader from "@/components/AdditionalImagesUploader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
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

// ─── Types ─────────────────────────────────────────────────────

type CartonConfigEntry = {
  packCount: number;
  totalWeightKg: string;
  cartonPrice: string;
};

type VariantMatrixEntry = {
  brandId: number | null;
  variantOptionId: number;
  packPrice: string;
  variantType: "trade" | "retail" | null;
  orderMin: string;
  orderMax: string;
  orderIncrement: string;
  orderUnit: string;
  minMarginPercent: string;
  minMarginAmount: string;
  isPackReturnRequired: boolean;
  packDepositAmount: string;
  cartonConfigs: CartonConfigEntry[];
};

// Helper: generate a key for the matrix map
const matrixKey = (brandId: number | null, voId: number) =>
  `${brandId ?? "null"}-${voId}`;

// ─── Main Form Component ───────────────────────────────────────

export default function WarehouseProductForm() {
  const router = useRouter();
  const queryClient = useQueryClient();

  // Step 1: Classification
  const [selectedTypeId, setSelectedTypeId] = useState<number | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [selectedSubCategoryId, setSelectedSubCategoryId] = useState<number | null>(null);

  // Step 2: Core Identity
  const [selectedCoreProductId, setSelectedCoreProductId] = useState<number | null>(null);

  // Step 3: Brand & Variant Selection
  const [selectedBrandIds, setSelectedBrandIds] = useState<number[]>([]);
  const [selectedVariantOptionIds, setSelectedVariantOptionIds] = useState<number[]>([]);

  // Step 4: Product Info
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [shortDescription, setShortDescription] = useState("");
  const [mainImage, setMainImage] = useState("");
  const [additionalImages, setAdditionalImages] = useState<string[]>([]);
  const [videoUrl, setVideoUrl] = useState("");

  // Step 5: Pricing Matrix
  const [variantMatrix, setVariantMatrix] = useState<Record<string, VariantMatrixEntry>>({});

  // Step 6: Delivery
  const [unitSize, setUnitSize] = useState("");
  const [deliveryCostPerCarton, setDeliveryCostPerCarton] = useState("");

  // Step 7: Supply Rules
  const [trackingType, setTrackingType] = useState<"none" | "batch" | "serial">("none");
  const [expiryEnabled, setExpiryEnabled] = useState(false);
  const [damageControlEnabled, setDamageControlEnabled] = useState(false);
  const [isReturnablePack, setIsReturnablePack] = useState(false);

  // Step 8: Visibility
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [status, setStatus] = useState<"active" | "inactive" | "draft">("active");
  const [inStock, setInStock] = useState(true);

  // ─── Queries ─────────────────────────────────────────────────

  const { data: typesData } = useQuery(
    orpc.warehouse.getProductTypes.queryOptions({ input: {} }),
  );
  const productTypes = typesData?.types ?? [];

  const { data: categoriesData } = useQuery(
    orpc.warehouse.getFilteredCategories.queryOptions({
      input: { typeId: selectedTypeId ?? undefined },
    }),
  );
  const categories = categoriesData?.categories ?? [];

  const { data: subCategoriesData } = useQuery({
    ...orpc.warehouse.getFilteredSubCategories.queryOptions({
      input: { categoryId: selectedCategoryId! },
    }),
    enabled: !!selectedCategoryId,
  });
  const subCategories = subCategoriesData?.subCategories ?? [];

  const { data: coreProductsData } = useQuery({
    ...orpc.warehouse.getCoreProductsForCreate.queryOptions({
      input: {
        categoryId: selectedCategoryId ?? undefined,
        subCategoryId: selectedSubCategoryId ?? undefined,
      },
    }),
    enabled: !!selectedCategoryId,
  });
  const coreProducts = coreProductsData?.coreProducts ?? [];

  // Derived: selected core product
  const selectedCoreProduct = coreProducts.find(
    (cp: any) => cp.id === selectedCoreProductId,
  );

  // ─── Mutations ───────────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: (data: any) => orpc.warehouse.warehouseCreateProduct.call(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["warehouse"] });
      toast.success("Product created successfully!");
      router.push("/warehouse/dashboard/products");
    },
    onError: (error: any) => {
      toast.error(error?.message || "Failed to create product");
    },
  });

  const isPending = createMutation.isPending;

  // ─── Handlers ────────────────────────────────────────────────

  const handleCoreProductSelect = (cpId: number | null) => {
    setSelectedCoreProductId(cpId);
    if (cpId) {
      const cp = coreProducts.find((c: any) => c.id === cpId);
      if (cp) {
        setName(cp.name);
        setSlug(cp.slug);
        setMainImage(cp.image);
        setSelectedCategoryId(cp.categoryId);
        setSelectedSubCategoryId(cp.subCategoryId ?? null);
        // Auto-select all brands + variants
        const brandIds = (cp.brands || []).map((b: any) => b.brandId || b.brand?.id).filter(Boolean);
        setSelectedBrandIds(brandIds);
        const voIds = (cp.variantLinks || []).map((vl: any) => vl.variantOption?.id).filter(Boolean);
        setSelectedVariantOptionIds(voIds);
        // Initialize pricing matrix
        initializeMatrix(brandIds, voIds);
      }
    }
  };

  const initializeMatrix = (brandIds: number[], voIds: number[]) => {
    const newMatrix: Record<string, VariantMatrixEntry> = {};
    for (const bId of brandIds) {
      for (const voId of voIds) {
        const key = matrixKey(bId, voId);
        newMatrix[key] = {
          brandId: bId,
          variantOptionId: voId,
          packPrice: "",
          variantType: null,
          orderMin: "1",
          orderMax: "",
          orderIncrement: "1",
          orderUnit: "piece",
          minMarginPercent: "",
          minMarginAmount: "",
          isPackReturnRequired: false,
          packDepositAmount: "",
          cartonConfigs: [],
        };
      }
    }
    setVariantMatrix(newMatrix);
  };

  const updateMatrixField = (
    key: string,
    field: keyof VariantMatrixEntry,
    value: any,
  ) => {
    setVariantMatrix((prev) => ({
      ...prev,
      [key]: { ...prev[key], [field]: value },
    }));
  };

  const addCartonConfig = (key: string) => {
    setVariantMatrix((prev) => {
      const entry = prev[key];
      if (!entry) return prev;
      return {
        ...prev,
        [key]: {
          ...entry,
          cartonConfigs: [
            ...entry.cartonConfigs,
            { packCount: 10, totalWeightKg: "", cartonPrice: "" },
          ],
        },
      };
    });
  };

  const removeCartonConfig = (key: string, idx: number) => {
    setVariantMatrix((prev) => {
      const entry = prev[key];
      if (!entry) return prev;
      return {
        ...prev,
        [key]: {
          ...entry,
          cartonConfigs: entry.cartonConfigs.filter((_, i) => i !== idx),
        },
      };
    });
  };

  const updateCartonConfig = (
    key: string,
    idx: number,
    field: keyof CartonConfigEntry,
    value: any,
  ) => {
    setVariantMatrix((prev) => {
      const entry = prev[key];
      if (!entry) return prev;
      const newConfigs = [...entry.cartonConfigs];
      newConfigs[idx] = { ...newConfigs[idx], [field]: value };
      return {
        ...prev,
        [key]: { ...entry, cartonConfigs: newConfigs },
      };
    });
  };

  const handleSubmit = (submitStatus: "active" | "draft" = "active") => {
    if (!name.trim()) { toast.error("Product name is required"); return; }
    if (!mainImage) { toast.error("Product image is required"); return; }
    if (!selectedCategoryId) { toast.error("Category is required"); return; }

    const matrixEntries = Object.values(variantMatrix).filter(
      (e) => e.packPrice && Number(e.packPrice) > 0,
    );

    createMutation.mutate({
      name,
      slug: slug || generateSlug(name),
      description: description || null,
      shortDescription: shortDescription || null,
      image: mainImage,
      additionalImages: additionalImages.length > 0 ? additionalImages : undefined,
      videoUrl: videoUrl || null,
      categoryId: selectedCategoryId!,
      subCategoryId: selectedSubCategoryId,
      coreProductId: selectedCoreProductId,
      price: matrixEntries[0]?.packPrice || "0",
      size: "—",
      unitSize: unitSize || null,
      deliveryCostPerCarton: deliveryCostPerCarton || null,
      trackingType,
      expiryEnabled,
      damageControlEnabled,
      isReturnablePack,
      visibility,
      status: submitStatus,
      inStock,
      brandIds: selectedBrandIds.length > 0 ? selectedBrandIds : undefined,
      variantMatrix: matrixEntries.length > 0 ? matrixEntries.map((e) => ({
        brandId: e.brandId,
        variantOptionId: e.variantOptionId,
        packPrice: e.packPrice,
        variantType: e.variantType,
        orderMin: e.orderMin || null,
        orderMax: e.orderMax || null,
        orderIncrement: e.orderIncrement || null,
        orderUnit: e.orderUnit || null,
        minMarginPercent: e.minMarginPercent || null,
        minMarginAmount: e.minMarginAmount || null,
        isPackReturnRequired: e.isPackReturnRequired,
        packDepositAmount: e.packDepositAmount || null,
        cartonConfigs: e.cartonConfigs.length > 0
          ? e.cartonConfigs.filter((cc) => cc.cartonPrice && cc.totalWeightKg)
          : undefined,
      })) : undefined,
    });
  };

  // ─── Render ──────────────────────────────────────────────────

  // Get variant options from the selected core product
  const linkedVariants = selectedCoreProduct?.variantLinks ?? [];
  const linkedBrands = selectedCoreProduct?.brands ?? [];

  return (
    <div className="min-h-screen bg-gray-50/50">
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 shadow-sm">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/warehouse/dashboard/products"
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <ArrowLeft className="h-4 w-4 text-gray-500" />
              </Link>
              <div>
                <h1 className="text-lg font-semibold text-gray-900">
                  New Product
                </h1>
                <p className="text-sm text-gray-500">
                  Create a product from Core Identity
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push("/warehouse/dashboard/products")}
                disabled={isPending}
                className="text-sm"
              >
                Discard
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => handleSubmit("draft")}
                disabled={isPending}
                className="text-sm"
              >
                <Save className="mr-2 h-4 w-4" />
                Save Draft
              </Button>
              <Button
                onClick={() => handleSubmit("active")}
                disabled={isPending}
                className="text-sm bg-emerald-600 hover:bg-emerald-700"
              >
                {isPending && <Loader className="mr-2 h-4 w-4 animate-spin" />}
                <Save className="mr-2 h-4 w-4" />
                Publish Product
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content (2/3 width) */}
          <div className="lg:col-span-2 space-y-6">
            {/* ── Step 1: Classification ── */}
            <Card>
              <CardHeader className="pb-4">
                <div className="flex items-center gap-2">
                  <div className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold">1</div>
                  <CardTitle className="text-base">Classification</CardTitle>
                </div>
                <CardDescription>
                  Select the product type, category, and sub-category
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Type */}
                  <Field>
                    <FieldLabel>Type</FieldLabel>
                    <Select
                      value={selectedTypeId ? String(selectedTypeId) : "all"}
                      onValueChange={(v) => {
                        const val = v === "all" ? null : Number(v);
                        setSelectedTypeId(val);
                        setSelectedCategoryId(null);
                        setSelectedSubCategoryId(null);
                        setSelectedCoreProductId(null);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="All types" />
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
                      value={selectedCategoryId ? String(selectedCategoryId) : "0"}
                      onValueChange={(v) => {
                        const val = Number(v);
                        setSelectedCategoryId(val || null);
                        setSelectedSubCategoryId(null);
                        setSelectedCoreProductId(null);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0" disabled>Select category</SelectItem>
                        {categories.map((c: any) => (
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
                      value={selectedSubCategoryId ? String(selectedSubCategoryId) : "none"}
                      onValueChange={(v) => {
                        const val = v === "none" ? null : Number(v);
                        setSelectedSubCategoryId(val);
                        setSelectedCoreProductId(null);
                      }}
                      disabled={subCategories.length === 0}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">All</SelectItem>
                        {subCategories.map((sc: any) => (
                          <SelectItem key={sc.id} value={String(sc.id)}>{sc.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
              </CardContent>
            </Card>

            {/* ── Step 2: Core Identity Selection ── */}
            <Card>
              <CardHeader className="pb-4">
                <div className="flex items-center gap-2">
                  <div className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold">2</div>
                  <CardTitle className="text-base">Core Product Identity</CardTitle>
                </div>
                <CardDescription>
                  Select a pre-defined core identity, or{" "}
                  <span className="text-amber-600 font-medium cursor-pointer hover:underline">
                    request a new one
                  </span>{" "}
                  if not listed
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Field>
                  <FieldLabel>Core Identity *</FieldLabel>
                  <Select
                    value={selectedCoreProductId ? String(selectedCoreProductId) : "0"}
                    onValueChange={(v) => handleCoreProductSelect(Number(v) || null)}
                    disabled={!selectedCategoryId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select core product" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0" disabled>Select core identity</SelectItem>
                      {coreProducts.map((cp: any) => (
                        <SelectItem key={cp.id} value={String(cp.id)}>
                          {cp.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                {selectedCoreProduct && (
                  <div className="mt-4 bg-emerald-50 border border-emerald-200 rounded-lg p-4 text-sm space-y-2">
                    <p className="font-medium text-emerald-700 flex items-center gap-1.5">
                      <Check size={14} /> Core Identity Selected
                    </p>
                    <div className="grid grid-cols-2 gap-2 text-gray-600">
                      <span>Name: <span className="text-gray-900 font-medium">{selectedCoreProduct.name}</span></span>
                      <span>Category: <span className="text-gray-900 font-medium">{selectedCoreProduct.category?.name}</span></span>
                      <span>Brands: <span className="text-gray-900 font-medium">{linkedBrands.length} linked</span></span>
                      <span>Variants: <span className="text-gray-900 font-medium">{linkedVariants.length} options</span></span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ── Step 3: Brands & Variants (read-only toggle) ── */}
            {selectedCoreProduct && (
              <Card>
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold">3</div>
                    <CardTitle className="text-base">Brands & Variants</CardTitle>
                  </div>
                  <CardDescription>
                    Select which brands and variant options to include in this product
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Brands */}
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Brands</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {linkedBrands.map((b: any) => {
                        const bId = b.brandId || b.brand?.id;
                        const isChecked = selectedBrandIds.includes(bId);
                        return (
                          <label
                            key={bId}
                            className={`flex items-center gap-2 border rounded-md px-3 py-2 cursor-pointer transition-colors ${
                              isChecked
                                ? "border-emerald-500 bg-emerald-50"
                                : "border-gray-200 hover:border-emerald-300"
                            }`}
                          >
                            <input
                              type="checkbox"
                              className="accent-emerald-600 h-4 w-4"
                              checked={isChecked}
                              onChange={() => {
                                const newBrands = isChecked
                                  ? selectedBrandIds.filter((id) => id !== bId)
                                  : [...selectedBrandIds, bId];
                                setSelectedBrandIds(newBrands);
                                initializeMatrix(newBrands, selectedVariantOptionIds);
                              }}
                            />
                            <span className="text-sm font-medium">{b.brand?.name}</span>
                            {b.isDefault && (
                              <Badge variant="secondary" className="text-[10px] ml-auto">Default</Badge>
                            )}
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  <Separator />

                  {/* Variant Options */}
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Variant Options</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {linkedVariants.map((vl: any) => {
                        const vo = vl.variantOption;
                        const isChecked = selectedVariantOptionIds.includes(vo.id);
                        return (
                          <label
                            key={vo.id}
                            className={`flex items-center gap-2 border rounded-md px-3 py-2 cursor-pointer transition-colors ${
                              isChecked
                                ? "border-blue-500 bg-blue-50"
                                : "border-gray-200 hover:border-blue-300"
                            }`}
                          >
                            <input
                              type="checkbox"
                              className="accent-blue-600 h-4 w-4"
                              checked={isChecked}
                              onChange={() => {
                                const newVos = isChecked
                                  ? selectedVariantOptionIds.filter((id) => id !== vo.id)
                                  : [...selectedVariantOptionIds, vo.id];
                                setSelectedVariantOptionIds(newVos);
                                initializeMatrix(selectedBrandIds, newVos);
                              }}
                            />
                            <div>
                              <span className="text-sm font-medium">{vo.name}</span>
                              <span className="text-xs text-gray-400 ml-1">
                                {vo.size ? `${vo.size}${vo.unit}` : vo.unit}
                              </span>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* ── Step 4: Product Info ── */}
            <Card>
              <CardHeader className="pb-4">
                <div className="flex items-center gap-2">
                  <div className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold">4</div>
                  <CardTitle className="text-base">Product Information</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field>
                    <FieldLabel>Name *</FieldLabel>
                    <Input
                      value={name}
                      onChange={(e) => {
                        setName(e.target.value);
                        setSlug(generateSlug(e.target.value));
                      }}
                      placeholder="Product name"
                    />
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

                <Field>
                  <FieldLabel>Short Description</FieldLabel>
                  <Input
                    value={shortDescription}
                    onChange={(e) => setShortDescription(e.target.value)}
                    placeholder="Premium quality rice for daily consumption"
                  />
                </Field>

                <Field>
                  <FieldLabel>Full Description</FieldLabel>
                  <textarea
                    className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm min-h-[100px] focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe your product in detail..."
                  />
                </Field>

                {/* Media */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Field>
                    <FieldLabel>Main Image *</FieldLabel>
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

            {/* ── Step 5: Brand × Variant Pricing Matrix ── */}
            {selectedBrandIds.length > 0 && selectedVariantOptionIds.length > 0 && (
              <Card>
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold">5</div>
                    <CardTitle className="text-base">Pricing Matrix</CardTitle>
                  </div>
                  <CardDescription>
                    Set pack price and carton configurations for each brand × variant combination
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {selectedBrandIds.map((bId) => {
                    const brand = linkedBrands.find(
                      (b: any) => (b.brandId || b.brand?.id) === bId,
                    );
                    const brandName = brand?.brand?.name || "Unknown";

                    return (
                      <div key={bId} className="border border-gray-200 rounded-lg overflow-hidden">
                        {/* Brand header */}
                        <div className="bg-purple-50 border-b border-purple-100 px-4 py-2.5">
                          <span className="text-sm font-semibold text-purple-800">
                            🏷️ {brandName}
                          </span>
                        </div>

                        <div className="p-4 space-y-4">
                          {selectedVariantOptionIds.map((voId) => {
                            const vl = linkedVariants.find(
                              (v: any) => v.variantOption?.id === voId,
                            );
                            const vo = vl?.variantOption;
                            if (!vo) return null;

                            const key = matrixKey(bId, voId);
                            const entry = variantMatrix[key];
                            if (!entry) return null;

                            return (
                              <div
                                key={key}
                                className="border border-gray-100 rounded-lg p-3 space-y-3 hover:border-gray-200 transition-colors"
                              >
                                {/* Variant header + price */}
                                <div className="flex items-center justify-between gap-3">
                                  <div className="flex items-center gap-2">
                                    <Badge variant="outline" className="text-xs font-medium">
                                      {vo.name}
                                    </Badge>
                                    <span className="text-xs text-gray-400">
                                      {vo.size ? `${vo.size}${vo.unit}` : vo.unit}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-gray-500">Pack ৳</span>
                                    <Input
                                      type="number"
                                      step="0.01"
                                      className="w-24 h-8 text-xs"
                                      value={entry.packPrice}
                                      onChange={(e) =>
                                        updateMatrixField(key, "packPrice", e.target.value)
                                      }
                                      placeholder="0"
                                    />
                                  </div>
                                </div>

                                {/* Carton configs */}
                                <div className="space-y-2">
                                  {entry.cartonConfigs.map((cc, idx) => (
                                    <div
                                      key={idx}
                                      className="flex items-center gap-2 bg-orange-50/50 border border-orange-100 rounded-md px-3 py-2"
                                    >
                                      <span className="text-[10px] text-orange-600 font-medium whitespace-nowrap">
                                        📦 Carton
                                      </span>
                                      <Input
                                        type="number"
                                        className="w-16 h-7 text-xs"
                                        value={cc.packCount}
                                        onChange={(e) =>
                                          updateCartonConfig(key, idx, "packCount", Number(e.target.value))
                                        }
                                        placeholder="10"
                                      />
                                      <span className="text-[10px] text-gray-400">packs →</span>
                                      <Input
                                        type="number"
                                        className="w-20 h-7 text-xs"
                                        value={cc.totalWeightKg}
                                        onChange={(e) =>
                                          updateCartonConfig(key, idx, "totalWeightKg", e.target.value)
                                        }
                                        placeholder="KG"
                                      />
                                      <span className="text-[10px] text-gray-400">KG</span>
                                      <span className="text-[10px] text-gray-400">৳</span>
                                      <Input
                                        type="number"
                                        className="w-24 h-7 text-xs"
                                        value={cc.cartonPrice}
                                        onChange={(e) =>
                                          updateCartonConfig(key, idx, "cartonPrice", e.target.value)
                                        }
                                        placeholder="Price"
                                      />
                                      <button
                                        type="button"
                                        onClick={() => removeCartonConfig(key, idx)}
                                        className="text-red-400 hover:text-red-600 p-0.5"
                                      >
                                        <Trash2 size={12} />
                                      </button>
                                    </div>
                                  ))}
                                  <button
                                    type="button"
                                    onClick={() => addCartonConfig(key)}
                                    className="flex items-center gap-1 text-[11px] text-orange-600 hover:text-orange-700 font-medium"
                                  >
                                    <Plus size={12} />
                                    Add Carton Setup
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}

            {/* ── Step 6: Delivery Cost ── */}
            <Card>
              <CardHeader className="pb-4">
                <div className="flex items-center gap-2">
                  <div className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold">6</div>
                  <CardTitle className="text-base">Unit Size & Delivery</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field>
                    <FieldLabel>Total Unit Size (KG)</FieldLabel>
                    <Input
                      value={unitSize}
                      onChange={(e) => setUnitSize(e.target.value)}
                      placeholder="e.g. 50 for 50KG carton"
                      type="number"
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      Conversion: unitSize ÷ variant size = packs per unit
                    </p>
                  </Field>
                  <Field>
                    <FieldLabel>Delivery Cost Per Carton (৳)</FieldLabel>
                    <Input
                      value={deliveryCostPerCarton}
                      onChange={(e) => setDeliveryCostPerCarton(e.target.value)}
                      placeholder="e.g. 50"
                      type="number"
                      step="0.01"
                    />
                  </Field>
                </div>
              </CardContent>
            </Card>

            {/* ── Step 7: Supply Rules ── */}
            <Card>
              <CardHeader className="pb-4">
                <div className="flex items-center gap-2">
                  <div className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold">7</div>
                  <CardTitle className="text-base">Supply Rules</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex items-center justify-between border rounded-lg p-3">
                    <div>
                      <p className="text-sm font-medium">Empty Pack Return</p>
                      <p className="text-xs text-gray-400">Require empty pack return</p>
                    </div>
                    <Switch checked={isReturnablePack} onCheckedChange={setIsReturnablePack} />
                  </div>
                  <div className="flex items-center justify-between border rounded-lg p-3">
                    <div>
                      <p className="text-sm font-medium">Expiry Tracking</p>
                      <p className="text-xs text-gray-400">Track product expiry dates</p>
                    </div>
                    <Switch checked={expiryEnabled} onCheckedChange={setExpiryEnabled} />
                  </div>
                  <div className="flex items-center justify-between border rounded-lg p-3">
                    <div>
                      <p className="text-sm font-medium">Damage Control</p>
                      <p className="text-xs text-gray-400">Enable damage reporting</p>
                    </div>
                    <Switch checked={damageControlEnabled} onCheckedChange={setDamageControlEnabled} />
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
          </div>

          {/* Sidebar (1/3 width) */}
          <div className="space-y-6">
            {/* Step 8: Visibility */}
            <Card>
              <CardHeader className="pb-4">
                <div className="flex items-center gap-2">
                  <div className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold">8</div>
                  <CardTitle className="text-base">Visibility</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                    <input
                      type="radio"
                      name="visibility"
                      value="public"
                      checked={visibility === "public"}
                      onChange={() => setVisibility("public")}
                      className="accent-emerald-600"
                    />
                    <div>
                      <p className="text-sm font-medium">Public</p>
                      <p className="text-xs text-gray-400">Visible to all customers</p>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                    <input
                      type="radio"
                      name="visibility"
                      value="private"
                      checked={visibility === "private"}
                      onChange={() => setVisibility("private")}
                      className="accent-emerald-600"
                    />
                    <div>
                      <p className="text-sm font-medium">Private</p>
                      <p className="text-xs text-gray-400">Only visible to you</p>
                    </div>
                  </label>
                </div>
              </CardContent>
            </Card>

            {/* Status */}
            <Card>
              <CardHeader className="pb-4">
                <div className="flex items-center gap-2">
                  <Settings className="h-4 w-4 text-gray-400" />
                  <CardTitle className="text-base">Status</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">In Stock</p>
                    <p className="text-xs text-gray-400">Available for purchase</p>
                  </div>
                  <Switch checked={inStock} onCheckedChange={setInStock} />
                </div>
              </CardContent>
            </Card>

            {/* Summary preview */}
            {selectedCoreProduct && (
              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="text-base">Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Core Identity</span>
                    <span className="font-medium">{selectedCoreProduct.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Brands</span>
                    <span className="font-medium">{selectedBrandIds.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Variants</span>
                    <span className="font-medium">{selectedVariantOptionIds.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Pricing Entries</span>
                    <span className="font-medium">
                      {Object.values(variantMatrix).filter((e) => e.packPrice && Number(e.packPrice) > 0).length}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Carton Configs</span>
                    <span className="font-medium">
                      {Object.values(variantMatrix).reduce((acc, e) => acc + e.cartonConfigs.length, 0)}
                    </span>
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
