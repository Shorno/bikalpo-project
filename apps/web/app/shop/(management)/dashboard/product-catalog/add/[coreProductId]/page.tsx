"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Loader, Package, Tag, Settings, Eye, Save,
  ShoppingCart, CheckCircle2, X, ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useCoreProductDetail, useCreateProductOptions, useCreateShopProduct } from "@/hooks/use-catalog-api";
import { toast } from "sonner";

// ─── Types ───────────────────────────────────────────────────────

type SelectedVariant = { variantOptionId: number; brandId: number; variantName: string; brandName: string };
type PriceEntry = { variantOptionId: number; brandId: number; retailPrice: string };
type StockEntry = { variantOptionId: number; brandId: number; quantity: number };

// ─── Main Page ───────────────────────────────────────────────────

export default function RetailerAddProductPage({
  params,
}: {
  params: Promise<{ coreProductId: string }>;
}) {
  const { coreProductId: coreProductIdStr } = use(params);
  const coreProductId = Number(coreProductIdStr);
  const router = useRouter();

  // Step 3: selected brand IDs
  const [selectedBrandIds, setSelectedBrandIds] = useState<number[]>([]);
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

  // Fetch core product detail (gives us type, category, subCategory)
  const { data: coreProductData, isLoading: loadingCore } = useCoreProductDetail(coreProductId);
  const coreProduct = coreProductData?.coreProduct;

  // Fetch brands & variant options scoped to this core product's type+category
  const typeId = (coreProduct as any)?.type?.id;
  const categoryId = (coreProduct as any)?.category?.id;

  const { data: optionsData, isLoading: loadingOptions } = useCreateProductOptions({
    typeId,
    categoryId,
  });

  const createMutation = useCreateShopProduct();

  const brands = optionsData?.brands ?? [];
  const variantOptions = optionsData?.variantOptions ?? [];

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
    const exists = selections.some((s) => s.variantOptionId === variantOptionId && s.brandId === brandId);
    if (exists) {
      setSelections((p) => p.filter((s) => !(s.variantOptionId === variantOptionId && s.brandId === brandId)));
      setPricing((p) => p.filter((pr) => !(pr.variantOptionId === variantOptionId && pr.brandId === brandId)));
      setOpeningStock((p) => p.filter((s) => !(s.variantOptionId === variantOptionId && s.brandId === brandId)));
    } else {
      setSelections((p) => [...p, { variantOptionId, brandId, variantName, brandName }]);
      setPricing((p) => [...p, { variantOptionId, brandId, retailPrice: "" }]);
      setOpeningStock((p) => [...p, { variantOptionId, brandId, quantity: 0 }]);
    }
  };

  const updatePrice = (variantOptionId: number, brandId: number, value: string) => {
    setPricing((p) => p.map((pr) =>
      pr.variantOptionId === variantOptionId && pr.brandId === brandId ? { ...pr, retailPrice: value } : pr,
    ));
  };

  const updateStock = (variantOptionId: number, brandId: number, value: string) => {
    setOpeningStock((p) => p.map((s) =>
      s.variantOptionId === variantOptionId && s.brandId === brandId ? { ...s, quantity: Number(value) || 0 } : s,
    ));
  };

  const handleSubmit = (submitStatus: "active" | "draft") => {
    if (!coreProduct) { toast.error("Core product not loaded"); return; }
    if (selectedBrandIds.length === 0) { toast.error("Select at least one brand"); return; }
    if (selections.length === 0) { toast.error("Select at least one variant"); return; }
    for (const pr of pricing) {
      if (!pr.retailPrice || Number(pr.retailPrice) <= 0) {
        toast.error("Set a selling price for all selected variants");
        return;
      }
    }

    createMutation.mutate(
      {
        coreProductId: coreProduct.id,
        categoryId: categoryId!,
        subCategoryId: (coreProduct as any).subCategory?.id,
        brandIds: selectedBrandIds,
        variantSelections: selections.map((s) => ({ variantOptionId: s.variantOptionId, brandId: s.brandId })),
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
      { onSuccess: () => router.push("/dashboard/product-catalog") },
    );
  };

  // ─── Loading ─────────────────────────────────────────────────

  if (loadingCore || loadingOptions) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading product details...</p>
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
            <Link href="/dashboard/product-catalog">← Back to Catalog</Link>
          </Button>
        </div>
      </div>
    );
  }

  const isPending = createMutation.isPending;
  const cp = coreProduct as any;

  // ─── Render ───────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 bg-background border-b">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button asChild variant="ghost" size="icon">
                <Link href="/dashboard/product-catalog"><ArrowLeft className="h-4 w-4" /></Link>
              </Button>
              <div>
                <h1 className="text-lg font-semibold">Add Product to Store</h1>
                <p className="text-sm text-muted-foreground">From: {coreProduct.name}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => router.push("/dashboard/product-catalog")} disabled={isPending}>
                Cancel
              </Button>
              <Button variant="secondary" onClick={() => handleSubmit("draft")} disabled={isPending}>
                <Save className="mr-2 h-4 w-4" /> Save Draft
              </Button>
              <Button onClick={() => handleSubmit("active")} disabled={isPending}>
                {isPending && <Loader className="mr-2 h-4 w-4 animate-spin" />}
                <CheckCircle2 className="mr-2 h-4 w-4" /> Create Product
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 max-w-4xl space-y-6">

        {/* ── Step 1: Classification (READ-ONLY from core product) ── */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <Tag className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Step 1 — Product Classification</CardTitle>
            </div>
            <CardDescription>Auto-filled from the catalog product you selected</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 flex-wrap text-sm">
              {cp.type && (
                <>
                  <Badge variant="outline" className="text-xs">{cp.type.name}</Badge>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                </>
              )}
              {cp.category && (
                <>
                  <Badge variant="secondary" className="text-xs">{cp.category.name}</Badge>
                  {cp.subCategory && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                </>
              )}
              {cp.subCategory && (
                <Badge variant="secondary" className="text-xs">{cp.subCategory.name}</Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              ✔ Auto-linked from catalog · Cannot be modified
            </p>
          </CardContent>
        </Card>

        {/* ── Step 2: Core Identity (READ-ONLY) ── */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Step 2 — Core Identity</CardTitle>
            </div>
            <CardDescription>The core product this listing is based on</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg border">
              {cp.image ? (
                <img src={cp.image} alt={cp.name} className="w-14 h-14 rounded-lg object-cover border" />
              ) : (
                <div className="w-14 h-14 rounded-lg bg-muted flex items-center justify-center border">
                  <Package className="h-6 w-6 text-muted-foreground" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-semibold">{cp.name}</p>
                {cp.sku && <code className="text-xs text-muted-foreground">{cp.sku}</code>}
                <div className="flex gap-1.5 mt-1 flex-wrap">
                  {cp.supportsPack && <Badge variant="outline" className="text-[10px]">Pack</Badge>}
                  {cp.supportsLoose && <Badge variant="outline" className="text-[10px]">Loose</Badge>}
                </div>
              </div>
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              ✔ Auto-linked with category · Cannot modify structure
            </p>
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
              {brands.length === 0 ? (
                <p className="text-sm text-muted-foreground">No brands available for this category</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {brands.map((b: any) => (
                    <label key={b.id} className={`flex items-center gap-2 px-3 py-1.5 rounded-full border cursor-pointer text-sm transition-colors ${
                      selectedBrandIds.includes(b.id) ? "bg-emerald-50 border-emerald-500 text-emerald-700" : "border-border hover:bg-muted/50"
                    }`}>
                      <Checkbox checked={selectedBrandIds.includes(b.id)} onCheckedChange={() => toggleBrand(b.id, b.name)} className="h-3.5 w-3.5" />
                      {b.name}
                    </label>
                  ))}
                </div>
              )}
            </div>

            {selectedBrandIds.length > 0 && variantOptions.length > 0 && (
              <>
                <Separator />
                <div className="space-y-4">
                  <p className="text-sm font-medium">Select Variants per Brand</p>
                  {selectedBrandIds.map((brandId) => {
                    const brd = brands.find((b: any) => b.id === brandId);
                    return (
                      <div key={brandId} className="border rounded-lg p-3 space-y-2">
                        <p className="text-sm font-semibold text-muted-foreground">{brd?.name}</p>
                        <div className="flex flex-wrap gap-2">
                          {variantOptions.map((vo: any) => {
                            const checked = selections.some((s) => s.variantOptionId === vo.id && s.brandId === brandId);
                            return (
                              <label key={vo.id} className={`flex items-center gap-2 px-3 py-1.5 rounded-full border cursor-pointer text-sm transition-colors ${
                                checked ? "bg-blue-50 border-blue-500 text-blue-700" : "border-border hover:bg-muted/50"
                              }`}>
                                <Checkbox checked={checked} onCheckedChange={() => toggleVariant(vo.id, brandId, vo.name, brd?.name ?? "")} className="h-3.5 w-3.5" />
                                {vo.name}
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {selections.length > 0 && (
              <p className="text-xs text-muted-foreground">{selections.length} variant{selections.length > 1 ? "s" : ""} selected</p>
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
                const pr = pricing.find((p) => p.variantOptionId === sel.variantOptionId && p.brandId === sel.brandId);
                return (
                  <div key={`${sel.variantOptionId}-${sel.brandId}`} className="flex items-center gap-3">
                    <div className="flex-1 text-sm">
                      <span className="font-medium">{sel.brandName}</span>
                      <span className="text-muted-foreground"> → </span>
                      <span>{sel.variantName}</span>
                    </div>
                    <div className="flex items-center gap-1.5 w-36">
                      <span className="text-sm text-muted-foreground">৳</span>
                      <Input type="number" min="0" step="0.01" placeholder="0.00" value={pr?.retailPrice ?? ""} onChange={(e) => updatePrice(sel.variantOptionId, sel.brandId, e.target.value)} className="h-8 text-sm" />
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
            {([
              { label: "Empty Pack Return", desc: "Require empty pack return", value: emptyPackReturn, onChange: setEmptyPackReturn },
              { label: "Stock Tracking", desc: "Track inventory levels", value: stockTracking, onChange: setStockTracking },
              { label: "Expiry Tracking", desc: "Track product expiry dates", value: expiryTracking, onChange: setExpiryTracking },
              { label: "Batch Tracking", desc: "Enable batch-level tracking", value: batchTracking, onChange: setBatchTracking },
              { label: "Damage Entry", desc: "Allow damage reporting", value: damageEntry, onChange: setDamageEntry },
            ] as const).map(({ label, desc, value, onChange }) => (
              <div key={label} className="flex items-center justify-between border rounded-lg p-3">
                <div>
                  <p className="text-sm font-medium">{label}</p>
                  <p className="text-xs text-muted-foreground">{desc}</p>
                </div>
                <Switch checked={value} onCheckedChange={onChange as any} />
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
                const st = openingStock.find((s) => s.variantOptionId === sel.variantOptionId && s.brandId === sel.brandId);
                return (
                  <div key={`stock-${sel.variantOptionId}-${sel.brandId}`} className="flex items-center gap-3">
                    <div className="flex-1 text-sm">
                      <span className="font-medium">{sel.brandName}</span>
                      <span className="text-muted-foreground"> → </span>
                      <span>{sel.variantName}</span>
                    </div>
                    <Input type="number" min="0" placeholder="0 pcs" value={st?.quantity || ""} onChange={(e) => updateStock(sel.variantOptionId, sel.brandId, e.target.value)} className="h-8 text-sm w-36" />
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
              <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder={coreProduct.name} />
              <p className="text-xs text-muted-foreground">Leave blank to use core product name</p>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Short Note</label>
              <Input value={shortNote} onChange={(e) => setShortNote(e.target.value)} placeholder="Best quality available" />
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
            {(["active", "draft"] as const).map((val) => (
              <label key={val} className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors ${status === val ? "border-emerald-500 bg-emerald-50/50" : ""}`}>
                <input type="radio" name="status" value={val} checked={status === val} onChange={() => setStatus(val)} className="accent-emerald-600" />
                <div>
                  <p className="text-sm font-medium capitalize">{val}</p>
                  <p className="text-xs text-muted-foreground">{val === "active" ? "Product is live and available" : "Save as draft, not visible yet"}</p>
                </div>
              </label>
            ))}
          </CardContent>
        </Card>

        {/* ── Final Actions ── */}
        <div className="flex items-center justify-between gap-3 pb-10">
          <Button variant="outline" onClick={() => router.push("/dashboard/product-catalog")} disabled={isPending}>
            <X className="mr-2 h-4 w-4" /> Cancel
          </Button>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => handleSubmit("draft")} disabled={isPending}>
              <Save className="mr-2 h-4 w-4" /> Save Draft
            </Button>
            <Button onClick={() => handleSubmit("active")} disabled={isPending}>
              {isPending && <Loader className="mr-2 h-4 w-4 animate-spin" />}
              <CheckCircle2 className="mr-2 h-4 w-4" /> Create Product
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
