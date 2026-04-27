"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Loader, Package, Tag, Settings, Eye, Save,
  ShoppingCart, CheckCircle2, Plus, X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { useCreateProductOptions, useCreateShopProduct } from "@/hooks/use-catalog-api";
import { toast } from "sonner";

// ─── Types ───────────────────────────────────────────────────────

type SelectedVariant = {
  variantOptionId: number;
  brandId: number;
  variantName: string;
  brandName: string;
};

type PriceEntry = {
  variantOptionId: number;
  brandId: number;
  retailPrice: string;
};

type StockEntry = {
  variantOptionId: number;
  brandId: number;
  quantity: number;
};

// ─── Main Page ───────────────────────────────────────────────────

export default function RetailerAddProductPage({
  params,
}: {
  params: Promise<{ coreProductId: string }>;
}) {
  const { coreProductId: coreProductIdStr } = use(params);
  const coreProductId = Number(coreProductIdStr);
  const router = useRouter();

  // Step 1–2: classification driven by coreProduct selection
  const [typeId, setTypeId] = useState<number | undefined>();
  const [categoryId, setCategoryId] = useState<number | undefined>();
  const [subCategoryId, setSubCategoryId] = useState<number | undefined>();
  const [selectedCoreProductId, setSelectedCoreProductId] = useState<number>(coreProductId);

  // Step 3: selected brand IDs
  const [selectedBrandIds, setSelectedBrandIds] = useState<number[]>([]);

  // Step 3+4: brand×variant selections
  const [selections, setSelections] = useState<SelectedVariant[]>([]);

  // Step 4: pricing
  const [pricing, setPricing] = useState<PriceEntry[]>([]);

  // Step 5: rules
  const [emptyPackReturn, setEmptyPackReturn] = useState(false);
  const [stockTracking, setStockTracking] = useState(true);
  const [expiryTracking, setExpiryTracking] = useState(false);
  const [batchTracking, setBatchTracking] = useState(false);
  const [damageEntry, setDamageEntry] = useState(false);

  // Step 6: opening stock
  const [openingStock, setOpeningStock] = useState<StockEntry[]>([]);

  // Step 7: store customization
  const [displayName, setDisplayName] = useState("");
  const [shortNote, setShortNote] = useState("");

  // Step 8: visibility
  const [status, setStatus] = useState<"active" | "draft">("active");

  // ─── Data Fetching ───────────────────────────────────────────

  const { data: optionsData, isLoading: loadingOptions } = useCreateProductOptions({
    typeId,
    categoryId,
    subCategoryId,
  });

  const createMutation = useCreateShopProduct();

  // Derived data
  const types = optionsData?.types ?? [];
  const categories = (optionsData?.categories ?? []).filter(
    (c: any) => !typeId || c.typeId === typeId,
  );
  const subCategories = (optionsData?.subCategories ?? []).filter(
    (sc: any) => !categoryId || sc.categoryId === categoryId,
  );
  const coreProducts = (optionsData?.coreProducts ?? []).filter(
    (cp: any) => !categoryId || cp.categoryId === categoryId,
  );
  const brands = optionsData?.brands ?? [];
  const variantOptions = optionsData?.variantOptions ?? [];

  const selectedCoreProduct = coreProducts.find((cp: any) => cp.id === selectedCoreProductId)
    ?? (coreProducts.length > 0 ? coreProducts[0] : null);

  // ─── Handlers ────────────────────────────────────────────────

  const toggleBrand = (brandId: number, brandName: string) => {
    if (selectedBrandIds.includes(brandId)) {
      setSelectedBrandIds((p) => p.filter((id) => id !== brandId));
      setSelections((p) => p.filter((s) => s.brandId !== brandId));
      setPricing((p) => p.filter((pr) => pr.brandId !== brandId));
      setOpeningStock((p) => p.filter((s) => s.brandId !== brandId));
    } else {
      setSelectedBrandIds((p) => [...p, brandId]);
    }
  };

  const toggleVariant = (variantOptionId: number, brandId: number, variantName: string, brandName: string) => {
    const key = `${variantOptionId}-${brandId}`;
    const exists = selections.some(
      (s) => s.variantOptionId === variantOptionId && s.brandId === brandId,
    );
    if (exists) {
      setSelections((p) => p.filter(
        (s) => !(s.variantOptionId === variantOptionId && s.brandId === brandId),
      ));
      setPricing((p) => p.filter(
        (pr) => !(pr.variantOptionId === variantOptionId && pr.brandId === brandId),
      ));
      setOpeningStock((p) => p.filter(
        (s) => !(s.variantOptionId === variantOptionId && s.brandId === brandId),
      ));
    } else {
      setSelections((p) => [...p, { variantOptionId, brandId, variantName, brandName }]);
      setPricing((p) => [...p, { variantOptionId, brandId, retailPrice: "" }]);
      setOpeningStock((p) => [...p, { variantOptionId, brandId, quantity: 0 }]);
    }
  };

  const updatePrice = (variantOptionId: number, brandId: number, value: string) => {
    setPricing((p) =>
      p.map((pr) =>
        pr.variantOptionId === variantOptionId && pr.brandId === brandId
          ? { ...pr, retailPrice: value }
          : pr,
      ),
    );
  };

  const updateStock = (variantOptionId: number, brandId: number, value: string) => {
    setOpeningStock((p) =>
      p.map((s) =>
        s.variantOptionId === variantOptionId && s.brandId === brandId
          ? { ...s, quantity: Number(value) || 0 }
          : s,
      ),
    );
  };

  const handleSubmit = (submitStatus: "active" | "draft") => {
    if (!selectedCoreProduct) {
      toast.error("Please select a core product");
      return;
    }
    if (selectedBrandIds.length === 0) {
      toast.error("Select at least one brand");
      return;
    }
    if (selections.length === 0) {
      toast.error("Select at least one variant");
      return;
    }
    for (const pr of pricing) {
      if (!pr.retailPrice || Number(pr.retailPrice) <= 0) {
        toast.error("Set a selling price for all selected variants");
        return;
      }
    }

    createMutation.mutate(
      {
        coreProductId: selectedCoreProduct.id,
        categoryId: selectedCoreProduct.categoryId ?? categoryId ?? 0,
        subCategoryId: selectedCoreProduct.subCategoryId ?? subCategoryId,
        brandIds: selectedBrandIds,
        variantSelections: selections.map((s) => ({
          variantOptionId: s.variantOptionId,
          brandId: s.brandId,
        })),
        pricing,
        isReturnablePack: emptyPackReturn,
        expiryEnabled: expiryTracking,
        damageControlEnabled: damageEntry,
        trackingType: batchTracking ? "batch" : "none",
        openingStock,
        displayName: displayName.trim() || undefined,
        shortNote: shortNote.trim() || undefined,
        status: submitStatus,
      },
      {
        onSuccess: () => {
          router.push("/dashboard/product-catalog");
        },
      },
    );
  };

  // ─── Loading ─────────────────────────────────────────────────

  if (loadingOptions) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading product options...</p>
        </div>
      </div>
    );
  }

  const isPending = createMutation.isPending;

  // ─── Render ───────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 bg-background border-b">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button asChild variant="ghost" size="icon">
                <Link href="/dashboard/product-catalog">
                  <ArrowLeft className="h-4 w-4" />
                </Link>
              </Button>
              <div>
                <h1 className="text-lg font-semibold">Add Product to Store</h1>
                <p className="text-sm text-muted-foreground">
                  {selectedCoreProduct ? `From: ${selectedCoreProduct.name}` : "Select a core product"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => router.push("/dashboard/product-catalog")}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button
                variant="secondary"
                onClick={() => handleSubmit("draft")}
                disabled={isPending}
              >
                <Save className="mr-2 h-4 w-4" />
                Save Draft
              </Button>
              <Button onClick={() => handleSubmit("active")} disabled={isPending}>
                {isPending && <Loader className="mr-2 h-4 w-4 animate-spin" />}
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Create Product
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 max-w-4xl space-y-6">

        {/* ── Step 1: Classification ── */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <Tag className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Step 1 — Product Classification</CardTitle>
            </div>
            <CardDescription>Select the product type, category and sub-category</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Type */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Type</label>
              <select
                value={typeId ?? ""}
                onChange={(e) => {
                  const v = e.target.value ? Number(e.target.value) : undefined;
                  setTypeId(v);
                  setCategoryId(undefined);
                  setSubCategoryId(undefined);
                }}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">All Types</option>
                {types.map((t: any) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>

            {/* Category */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Category</label>
              <select
                value={categoryId ?? ""}
                onChange={(e) => {
                  const v = e.target.value ? Number(e.target.value) : undefined;
                  setCategoryId(v);
                  setSubCategoryId(undefined);
                }}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">All Categories</option>
                {categories.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* Sub Category */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Sub Category</label>
              <select
                value={subCategoryId ?? ""}
                onChange={(e) => setSubCategoryId(e.target.value ? Number(e.target.value) : undefined)}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">All Sub Categories</option>
                {subCategories.map((sc: any) => (
                  <option key={sc.id} value={sc.id}>{sc.name}</option>
                ))}
              </select>
            </div>
          </CardContent>
        </Card>

        {/* ── Step 2: Core Identity ── */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Step 2 — Core Identity</CardTitle>
            </div>
            <CardDescription>Select the core product you want to sell</CardDescription>
          </CardHeader>
          <CardContent>
            {coreProducts.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No core products found. Adjust filters above.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-60 overflow-y-auto">
                {coreProducts.map((cp: any) => (
                  <button
                    key={cp.id}
                    type="button"
                    onClick={() => setSelectedCoreProductId(cp.id)}
                    className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-colors ${
                      selectedCoreProductId === cp.id
                        ? "border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500/30"
                        : "border-border hover:bg-muted/50"
                    }`}
                  >
                    {cp.image ? (
                      <img src={cp.image} alt={cp.name} className="w-10 h-10 rounded object-cover border" />
                    ) : (
                      <div className="w-10 h-10 rounded bg-muted flex items-center justify-center">
                        <Package className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{cp.name}</p>
                      {cp.sku && (
                        <code className="text-xs text-muted-foreground">{cp.sku}</code>
                      )}
                    </div>
                    {selectedCoreProductId === cp.id && (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            )}
            {selectedCoreProduct && (
              <div className="mt-3 flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 rounded-md px-3 py-2 border border-emerald-200">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Auto-linked with category · Cannot modify structure
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Step 3: Brand & Variant Selection ── */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <Tag className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Step 3 — Brand & Variant Selection</CardTitle>
            </div>
            <CardDescription>Choose which brands and variants you will sell</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Brands */}
            <div>
              <p className="text-sm font-medium mb-2">Available Brands</p>
              <div className="flex flex-wrap gap-2">
                {brands.map((b: any) => (
                  <label
                    key={b.id}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full border cursor-pointer text-sm transition-colors ${
                      selectedBrandIds.includes(b.id)
                        ? "bg-emerald-50 border-emerald-500 text-emerald-700"
                        : "border-border hover:bg-muted/50"
                    }`}
                  >
                    <Checkbox
                      checked={selectedBrandIds.includes(b.id)}
                      onCheckedChange={() => toggleBrand(b.id, b.name)}
                      className="h-3.5 w-3.5"
                    />
                    {b.name}
                  </label>
                ))}
              </div>
            </div>

            <Separator />

            {/* Variants per selected brand */}
            {selectedBrandIds.length > 0 && variantOptions.length > 0 && (
              <div className="space-y-4">
                <p className="text-sm font-medium">Select Variants per Brand</p>
                {selectedBrandIds.map((brandId) => {
                  const brd = brands.find((b: any) => b.id === brandId);
                  return (
                    <div key={brandId} className="border rounded-lg p-3 space-y-2">
                      <p className="text-sm font-semibold text-muted-foreground">{brd?.name}</p>
                      <div className="flex flex-wrap gap-2">
                        {variantOptions.map((vo: any) => {
                          const checked = selections.some(
                            (s) => s.variantOptionId === vo.id && s.brandId === brandId,
                          );
                          return (
                            <label
                              key={vo.id}
                              className={`flex items-center gap-2 px-3 py-1.5 rounded-full border cursor-pointer text-sm transition-colors ${
                                checked
                                  ? "bg-blue-50 border-blue-500 text-blue-700"
                                  : "border-border hover:bg-muted/50"
                              }`}
                            >
                              <Checkbox
                                checked={checked}
                                onCheckedChange={() =>
                                  toggleVariant(vo.id, brandId, vo.name, brd?.name ?? "")
                                }
                                className="h-3.5 w-3.5"
                              />
                              {vo.name}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {selections.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {selections.length} variant{selections.length > 1 ? "s" : ""} selected
              </p>
            )}
          </CardContent>
        </Card>

        {/* ── Step 4: Selling Price ── */}
        {selections.length > 0 && (
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2">
                <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-base">Step 4 — Selling Price</CardTitle>
              </div>
              <CardDescription>Set your own selling price per brand × variant</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {selections.map((sel) => {
                const pr = pricing.find(
                  (p) => p.variantOptionId === sel.variantOptionId && p.brandId === sel.brandId,
                );
                return (
                  <div key={`${sel.variantOptionId}-${sel.brandId}`} className="flex items-center gap-3">
                    <div className="flex-1 text-sm">
                      <span className="font-medium">{sel.brandName}</span>
                      <span className="text-muted-foreground"> → </span>
                      <span>{sel.variantName}</span>
                    </div>
                    <div className="flex items-center gap-1.5 w-36">
                      <span className="text-sm text-muted-foreground">৳</span>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        value={pr?.retailPrice ?? ""}
                        onChange={(e) =>
                          updatePrice(sel.variantOptionId, sel.brandId, e.target.value)
                        }
                        className="h-8 text-sm"
                      />
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {/* ── Step 5: Product Rules ── */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <Settings className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Step 5 — Product Rules</CardTitle>
            </div>
            <CardDescription>Store-specific behavior controls</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { label: "Empty Pack Return", desc: "Require empty pack return", value: emptyPackReturn, onChange: setEmptyPackReturn },
              { label: "Stock Tracking", desc: "Track inventory levels", value: stockTracking, onChange: setStockTracking },
              { label: "Expiry Tracking", desc: "Track product expiry dates", value: expiryTracking, onChange: setExpiryTracking },
              { label: "Batch Tracking", desc: "Enable batch-level tracking", value: batchTracking, onChange: setBatchTracking },
              { label: "Damage Entry", desc: "Allow damage reporting", value: damageEntry, onChange: setDamageEntry },
            ].map(({ label, desc, value, onChange }) => (
              <div key={label} className="flex items-center justify-between border rounded-lg p-3">
                <div>
                  <p className="text-sm font-medium">{label}</p>
                  <p className="text-xs text-muted-foreground">{desc}</p>
                </div>
                <Switch checked={value} onCheckedChange={onChange} />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* ── Step 6: Opening Stock ── */}
        {selections.length > 0 && (
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-base">Step 6 — Opening Stock</CardTitle>
              </div>
              <CardDescription>Optional — can update later</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {selections.map((sel) => {
                const st = openingStock.find(
                  (s) => s.variantOptionId === sel.variantOptionId && s.brandId === sel.brandId,
                );
                return (
                  <div key={`stock-${sel.variantOptionId}-${sel.brandId}`} className="flex items-center gap-3">
                    <div className="flex-1 text-sm">
                      <span className="font-medium">{sel.brandName}</span>
                      <span className="text-muted-foreground"> → </span>
                      <span>{sel.variantName}</span>
                    </div>
                    <div className="flex items-center gap-1.5 w-36">
                      <Input
                        type="number"
                        min="0"
                        placeholder="0 pcs"
                        value={st?.quantity === 0 ? "" : (st?.quantity ?? "")}
                        onChange={(e) =>
                          updateStock(sel.variantOptionId, sel.brandId, e.target.value)
                        }
                        className="h-8 text-sm"
                      />
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {/* ── Step 7: Store Customization ── */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Step 7 — Store Customization</CardTitle>
            </div>
            <CardDescription>Optional branding for your store</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Display Name</label>
              <Input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder={selectedCoreProduct?.name ?? "Custom product name"}
              />
              <p className="text-xs text-muted-foreground">Leave blank to use core product name</p>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Short Note</label>
              <Input
                value={shortNote}
                onChange={(e) => setShortNote(e.target.value)}
                placeholder="Best quality available"
              />
            </div>
          </CardContent>
        </Card>

        {/* ── Step 8: Visibility ── */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Step 8 — Visibility</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { label: "Active", desc: "Product is live and available", value: "active" as const },
              { label: "Draft", desc: "Save as draft, not visible yet", value: "draft" as const },
            ].map(({ label, desc, value }) => (
              <label
                key={value}
                className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors ${
                  status === value ? "border-emerald-500 bg-emerald-50/50" : ""
                }`}
              >
                <input
                  type="radio"
                  name="status"
                  value={value}
                  checked={status === value}
                  onChange={() => setStatus(value)}
                  className="accent-emerald-600"
                />
                <div>
                  <p className="text-sm font-medium">{label}</p>
                  <p className="text-xs text-muted-foreground">{desc}</p>
                </div>
              </label>
            ))}
          </CardContent>
        </Card>

        {/* ── Final Action ── */}
        <div className="flex items-center justify-between gap-3 pb-10">
          <Button
            variant="outline"
            onClick={() => router.push("/dashboard/product-catalog")}
            disabled={isPending}
          >
            <X className="mr-2 h-4 w-4" />
            Cancel
          </Button>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() => handleSubmit("draft")}
              disabled={isPending}
            >
              <Save className="mr-2 h-4 w-4" />
              Save Draft
            </Button>
            <Button onClick={() => handleSubmit("active")} disabled={isPending}>
              {isPending && <Loader className="mr-2 h-4 w-4 animate-spin" />}
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Create Product
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
