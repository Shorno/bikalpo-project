"use client";

import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  Boxes,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Eye,
  Loader2,
  MapPin,
  Package,
  Plus,
  Tag,
  TrendingDown,
  TrendingUp,
  Warehouse,
} from "lucide-react";
import Image from "next/image";
import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useMyInventory } from "@/hooks/use-shop-owner-api";
import { orpc } from "@/utils/orpc";

// ────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────

interface InventoryItem {
  id: number;
  availableQty: string | null;
  reservedQty: string | null;
  retailPrice: string | null;
  variant?: {
    id: number;
    sku?: string | null;
    unitLabel: string;
    quantitySelectorLabel?: string | null;
    weightKg: string;
    packType?: string | null;
    innerPackSizeKg?: string | null;
    packCountInside?: number | null;
    piecesPerUnit?: number | null;
    variantType?: string | null;
    price: string;
    color?: string | null;
    size?: string | null;
    brandId?: number | null;
    brand?: { id: number; name: string } | null;
    product?: {
      id: number;
      name: string;
      slug?: string;
      image?: string;
      size?: string;
      category?: { name: string } | null;
      images?: { imageUrl?: string; url?: string }[];
    };
  };
}

type StockLevel = "in_stock" | "limited" | "low" | "out_of_stock";

// ────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────

function getStockLevel(qty: number): StockLevel {
  if (qty <= 0) return "out_of_stock";
  if (qty <= 5) return "low";
  if (qty <= 20) return "limited";
  return "in_stock";
}

function StockBadge({ level, qty, unit }: { level: StockLevel; qty: number; unit: string }) {
  switch (level) {
    case "in_stock":
      return (
        <span className="inline-flex items-center gap-1.5 text-sm">
          <span className="font-semibold text-gray-900">{qty} {unit}</span>
          <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 text-[10px] font-medium">
            ✅ In Stock
          </Badge>
        </span>
      );
    case "limited":
      return (
        <span className="inline-flex items-center gap-1.5 text-sm">
          <span className="font-semibold text-gray-900">{qty} {unit}</span>
          <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 text-[10px] font-medium">
            ⚠ Limited
          </Badge>
        </span>
      );
    case "low":
      return (
        <span className="inline-flex items-center gap-1.5 text-sm">
          <span className="font-semibold text-gray-900">{qty} {unit}</span>
          <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100 text-[10px] font-medium">
            ⚠ Low Stock
          </Badge>
        </span>
      );
    case "out_of_stock":
      return (
        <span className="inline-flex items-center gap-1.5 text-sm">
          <span className="font-semibold text-gray-400">{qty} {unit}</span>
          <Badge variant="outline" className="border-red-200 text-red-600 bg-red-50 text-[10px] font-medium">
            ❌ Out of Stock
          </Badge>
        </span>
      );
  }
}

// Group items by category → product → variant
function groupInventory(items: InventoryItem[]) {
  const categoryMap = new Map<
    string,
    {
      categoryName: string;
      products: Map<
        number,
        {
          productId: number;
          productName: string;
          productImage: string;
          totalQty: number;
          totalWeightKg: number;
          unit: string;
          displayUnit: string;
          variants: {
            inventoryId: number;
            variantId: number;
            label: string;
            qty: number;
            unit: string;
            displayUnit: string;
            price: string;
            retailPrice: string;
            sku: string;
            color: string;
            size: string;
            brand: string;
            weightKg: number;
            innerPackSizeKg: number;
          }[];
        }
      >;
    }
  >();

  for (const item of items) {
    const variant = item.variant;
    if (!variant) continue;
    const product = variant.product;
    if (!product) continue;

    const categoryName = product.category?.name || "Uncategorized";
    const productId = product.id;
    const qty = Number(item.availableQty ?? 0);
    const innerPackSizeKg = Number(variant.innerPackSizeKg || 0);
    const packCountInside = Number(variant.packCountInside || 0);
    const weightKg = Number(variant.weightKg || 0);

    // Determine display unit based on variant data
    // If inner pack data exists → qty is in packs, show "Pack" / total weight in KG
    // Loose products are never pack-based — they're sold by weight (KG)
    const isLoose = (variant.packType || "").toLowerCase() === "loose";
    const isPackBased = !isLoose && innerPackSizeKg > 0 && packCountInside > 1;
    const displayUnit = isPackBased
      ? `${innerPackSizeKg}kg Pack`
      : isLoose
        ? "KG"
        : variant.unitLabel || "Unit";
    const unit = variant.unitLabel || "Unit";

    // Calculate weight contribution
    // Pack-based: qty × innerPackSizeKg (each item in qty = 1 inner pack)
    // Loose: qty × innerPackSizeKg (inventory units are inner-pack sized, e.g. 10 × 5kg = 50 KG)
    // Other: qty × weightKg (each item = full variant weight)
    const weightForQty = isPackBased
      ? qty * innerPackSizeKg
      : isLoose && innerPackSizeKg > 0
        ? qty * innerPackSizeKg
        : qty * weightKg;

    // For loose variants, the displayed qty is total KG (not unit count)
    const displayQty = isLoose && innerPackSizeKg > 0
      ? qty * innerPackSizeKg
      : qty;

    const img =
      product.images?.[0]?.imageUrl ||
      product.images?.[0]?.url ||
      product.image ||
      "";

    if (!categoryMap.has(categoryName)) {
      categoryMap.set(categoryName, {
        categoryName,
        products: new Map(),
      });
    }

    const cat = categoryMap.get(categoryName)!;
    if (!cat.products.has(productId)) {
      cat.products.set(productId, {
        productId,
        productName: product.name,
        productImage: img,
        totalQty: 0,
        totalWeightKg: 0,
        unit,
        displayUnit,
        variants: [],
      });
    }

    const prod = cat.products.get(productId)!;
    prod.totalQty += qty;
    prod.totalWeightKg += weightForQty;

    // Build variant label: Brand + InnerPackSize (e.g., "ATA + 4KG")
    const parts: string[] = [];
    if (variant.brand?.name) parts.push(variant.brand.name);
    if (isPackBased) {
      parts.push(`${innerPackSizeKg}KG`);
    } else {
      if (variant.size) parts.push(variant.size);
      if (variant.color) parts.push(variant.color);
      if (weightKg > 0 && parts.length === 0) parts.push(`${weightKg}kg`);
      if (variant.packType) parts.push(variant.packType);
    }

    const label =
      parts.length > 0
        ? parts.join(" + ")
        : variant.quantitySelectorLabel || variant.sku || `Variant #${variant.id}`;

    prod.variants.push({
      inventoryId: item.id,
      variantId: variant.id,
      label,
      qty: displayQty,
      unit,
      displayUnit,
      price: variant.price,
      retailPrice: item.retailPrice || variant.price,
      sku: variant.sku || "",
      color: variant.color || "",
      size: variant.size || "",
      brand: variant.brand?.name || "",
      weightKg,
      innerPackSizeKg,
    });
  }

  // Convert to sorted arrays
  return Array.from(categoryMap.values())
    .map((cat) => ({
      ...cat,
      products: Array.from(cat.products.values()).sort((a, b) =>
        a.productName.localeCompare(b.productName)
      ),
    }))
    .sort((a, b) => a.categoryName.localeCompare(b.categoryName));
}

// ────────────────────────────────────────────────────────────────
// Category Section
// ────────────────────────────────────────────────────────────────

function CategorySection({
  categoryName,
  products,
}: {
  categoryName: string;
  products: ReturnType<typeof groupInventory>[0]["products"];
}) {
  const [expanded, setExpanded] = useState(true);
  const totalQty = products.reduce((s, p) => s + p.totalQty, 0);

  return (
    <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
      {/* Category Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-50/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-100 to-amber-200 flex items-center justify-center">
            <Tag className="w-4.5 h-4.5 text-amber-700" />
          </div>
          <div className="text-left">
            <h2 className="font-bold text-gray-900">{categoryName}</h2>
            <p className="text-xs text-muted-foreground">
              {products.length} {products.length === 1 ? "product" : "products"} · {totalQty} total units
            </p>
          </div>
        </div>
        {expanded ? (
          <ChevronDown className="w-5 h-5 text-gray-400" />
        ) : (
          <ChevronRight className="w-5 h-5 text-gray-400" />
        )}
      </button>

      {/* Stock Overview */}
      {expanded && (
        <div className="border-t">
          {/* Product Rows */}
          {products.map((product) => (
            <ProductRow key={product.productId} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// Product Row
// ────────────────────────────────────────────────────────────────

function ProductRow({
  product,
}: {
  product: ReturnType<typeof groupInventory>[0]["products"][0];
}) {
  const [showVariants, setShowVariants] = useState(false);
  const stockLevel = getStockLevel(product.totalQty);
  const hasMultipleVariants = product.variants.length > 1;

  return (
    <div className="border-b last:border-b-0">
      {/* Product Summary */}
      <button
        onClick={() => hasMultipleVariants && setShowVariants(!showVariants)}
        className={`w-full flex items-center justify-between px-4 py-3 ${
          hasMultipleVariants ? "hover:bg-gray-50/50 cursor-pointer" : ""
        } transition-colors`}
      >
        <div className="flex items-center gap-3 min-w-0">
          {/* Product Image */}
          <div className="w-9 h-9 rounded-lg bg-gray-100 overflow-hidden shrink-0">
            {product.productImage ? (
              <Image
                src={product.productImage}
                alt={product.productName}
                width={36}
                height={36}
                className="object-cover w-full h-full"
                unoptimized={product.productImage.startsWith("http")}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Package className="w-4 h-4 text-gray-300" />
              </div>
            )}
          </div>

          <div className="text-left min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">
              {product.productName}
            </p>
            {hasMultipleVariants && (
              <p className="text-[11px] text-muted-foreground">
                {product.variants.length} variants · Tap to expand
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {product.totalWeightKg > 0 ? (
            <StockBadge level={stockLevel} qty={product.totalWeightKg} unit="KG" />
          ) : (
            <StockBadge level={stockLevel} qty={product.totalQty} unit={product.displayUnit} />
          )}
          {hasMultipleVariants && (
            showVariants ? (
              <ChevronDown className="w-4 h-4 text-gray-400" />
            ) : (
              <ChevronRight className="w-4 h-4 text-gray-400" />
            )
          )}
        </div>
      </button>

      {/* Expanded Variant Detail */}
      {showVariants && hasMultipleVariants && (
        <div className="bg-gray-50/60 border-t">
          <div className="px-4 py-2 border-b border-gray-100">
            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
              📊 Stock — {product.productName}
            </p>
          </div>
          <div className="divide-y divide-gray-100">
            {product.variants.map((v) => (
              <VariantRow key={v.inventoryId} variant={v} />
            ))}
          </div>
        </div>
      )}

      {/* Single variant — always show inline detail */}
      {!hasMultipleVariants && product.variants[0] && (
        <div className="bg-gray-50/40 border-t px-4 py-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {product.variants[0].brand && `${product.variants[0].brand} · `}
              {product.variants[0].innerPackSizeKg > 0
                ? `${product.variants[0].innerPackSizeKg}kg/pack · `
                : product.variants[0].weightKg > 0
                  ? `${product.variants[0].weightKg}kg · `
                  : ""}
              {product.variants[0].sku && `SKU: ${product.variants[0].sku}`}
            </span>
            <span className="text-xs font-medium text-gray-700">
              ৳ {product.variants[0].retailPrice} / {product.variants[0].displayUnit}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// Variant Row
// ────────────────────────────────────────────────────────────────

function VariantRow({
  variant,
}: {
  variant: ReturnType<typeof groupInventory>[0]["products"][0]["variants"][0];
}) {
  const stockLevel = getStockLevel(variant.qty);

  return (
    <div className="flex items-center justify-between px-5 py-2.5 hover:bg-white/60 transition-colors">
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-sm font-medium text-gray-800 truncate">
          {variant.label}
        </span>
        {variant.sku && (
          <span className="text-[10px] text-gray-400 font-mono hidden sm:inline">
            {variant.sku}
          </span>
        )}
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span className="text-xs text-gray-500">৳ {variant.retailPrice}/{variant.innerPackSizeKg > 0 ? "pack" : "unit"}</span>
        <StockBadge level={stockLevel} qty={variant.qty} unit={variant.displayUnit} />
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// Main Page
// ────────────────────────────────────────────────────────────────

export default function InventoryPage() {
  const { data, isLoading, isError } = useMyInventory();
  const [modalOpen, setModalOpen] = useState(false);

  const items = (data?.items ?? []) as InventoryItem[];
  const totalItems = items.length;
  const inStockItems = items.filter((i) => Number(i.availableQty ?? 0) > 0).length;
  const lowStockItems = items.filter(
    (i) => Number(i.availableQty ?? 0) > 0 && Number(i.availableQty ?? 0) <= 5
  ).length;
  const outOfStockItems = items.filter((i) => Number(i.availableQty ?? 0) === 0).length;

  const grouped = useMemo(() => groupInventory(items), [items]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Stock Overview</h1>
        <Dialog open={modalOpen} onOpenChange={setModalOpen}>
          <DialogTrigger asChild>
            <Button className="bg-amber-600 hover:bg-amber-700">
              <Plus className="w-4 h-4 mr-2" />
              Add Product
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Add Product from Warehouse</DialogTitle>
              <DialogDescription>
                Paste a warehouse storefront URL to browse and order products.
              </DialogDescription>
            </DialogHeader>
            <WarehouseUrlModal onClose={() => setModalOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          title="Total Products"
          value={totalItems}
          icon={<Package className="w-5 h-5 text-blue-500" />}
          loading={isLoading}
        />
        <SummaryCard
          title="In Stock"
          value={inStockItems}
          icon={<TrendingUp className="w-5 h-5 text-emerald-500" />}
          loading={isLoading}
        />
        <SummaryCard
          title="Low Stock"
          value={lowStockItems}
          icon={<TrendingDown className="w-5 h-5 text-amber-500" />}
          loading={isLoading}
        />
        <SummaryCard
          title="Out of Stock"
          value={outOfStockItems}
          icon={<AlertCircle className="w-5 h-5 text-red-500" />}
          loading={isLoading}
        />
      </div>

      {/* Inventory Content */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="bg-white rounded-xl border shadow-sm p-4 space-y-3">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ))}
        </div>
      ) : isError ? (
        <div className="bg-white rounded-lg border shadow-sm p-12 text-center">
          <AlertCircle className="w-12 h-12 text-red-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">Failed to load inventory</p>
        </div>
      ) : items.length === 0 ? (
        <div className="bg-white rounded-lg border shadow-sm p-12 text-center">
          <Boxes className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No inventory data yet</p>
          <p className="text-sm text-gray-400 mt-1">
            Stock is auto-converted from wholesale (TRADE) to retail (RETAIL) when B2B orders are delivered.
          </p>
          <Button
            className="mt-4 bg-amber-600 hover:bg-amber-700"
            onClick={() => setModalOpen(true)}
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Product from Warehouse
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map((cat) => (
            <CategorySection
              key={cat.categoryName}
              categoryName={cat.categoryName}
              products={cat.products}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// Warehouse URL Modal (preserved from original)
// ────────────────────────────────────────────────────────────────

function WarehouseUrlModal({ onClose }: { onClose: () => void }) {
  const [url, setUrl] = useState("");
  const [parsedSlug, setParsedSlug] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function parseSlug(input: string): string | null {
    const trimmed = input.trim();
    if (!trimmed) return null;
    if (!trimmed.includes("/")) return trimmed;
    const match = trimmed.match(/\/(?:warehouse|w)\/([^/?#]+)/);
    return match ? match[1] : null;
  }

  function handlePreview() {
    setError(null);
    const slug = parseSlug(url);
    if (!slug) {
      setError("Please enter a valid warehouse URL or slug.");
      return;
    }
    setParsedSlug(slug);
  }

  const {
    data: warehouse,
    isLoading,
    error: fetchError,
  } = useQuery(
    orpc.warehouse.getStorefrontBySlug.queryOptions({
      input: { slug: parsedSlug! },
      enabled: !!parsedSlug,
    }),
  );

  const warehouseNotFound = fetchError && parsedSlug;

  return (
    <div className="space-y-4 pt-2">
      <div className="space-y-2">
        <label className="text-sm font-medium">Warehouse URL or Slug</label>
        <div className="flex gap-2">
          <Input
            placeholder="e.g. /warehouse/zenstore or zenstore"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setParsedSlug(null);
              setError(null);
            }}
            onKeyDown={(e) => e.key === "Enter" && handlePreview()}
          />
          <Button onClick={handlePreview} disabled={!url.trim()}>
            Preview
          </Button>
        </div>
        {error && <p className="text-sm text-red-500">{error}</p>}
      </div>

      {isLoading && parsedSlug && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-amber-600" />
        </div>
      )}

      {warehouseNotFound && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-center">
          <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
          <p className="text-sm text-red-600 font-medium">Warehouse not found</p>
          <p className="text-xs text-red-500 mt-1">Check the URL and try again.</p>
        </div>
      )}

      {warehouse && (
        <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-4 space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center shrink-0">
              <Warehouse className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">
                {warehouse.warehouseName || warehouse.name}
              </h3>
              {warehouse.warehouseAddress && (
                <p className="text-sm text-gray-500 flex items-center gap-1 mt-0.5">
                  <MapPin className="w-3 h-3" />
                  {warehouse.warehouseAddress}
                </p>
              )}
              <p className="text-sm text-amber-700 font-medium mt-1">
                {warehouse.productCount} products available
              </p>
            </div>
          </div>

          <Button
            className="w-full bg-amber-600 hover:bg-amber-700"
            onClick={() => {
              onClose();
              const baseUrl = window.location.origin.replace("shop.", "");
              window.location.href = `${baseUrl}/w/${parsedSlug}`;
            }}
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            Visit Warehouse Store
          </Button>
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// Helper Components
// ────────────────────────────────────────────────────────────────

function SummaryCard({
  title,
  value,
  icon,
  loading,
}: {
  title: string;
  value: number;
  icon: React.ReactNode;
  loading: boolean;
}) {
  return (
    <div className="bg-white rounded-lg border shadow-sm p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm text-gray-500">{title}</p>
        {icon}
      </div>
      {loading ? (
        <Skeleton className="h-8 w-16" />
      ) : (
        <p className="text-2xl font-bold">{value}</p>
      )}
    </div>
  );
}
