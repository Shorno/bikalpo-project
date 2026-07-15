"use client";

import {
  AlertCircle,
  Check,
  DollarSign,
  Download,
  Loader2,
  Package,
  Pencil,
  Plus,
  Search,
  Upload,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useMyRetailProducts,
  useUpdateRetailPrice,
} from "@/hooks/use-shop-owner-api";

// ─── Helpers ───────────────────────────────────────────────────

function formatRelativeDate(dateStr: string | Date): string {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "—";
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return `${d.getDate()} ${months[d.getMonth()]}`;
}

function resolveBrand(item: any) {
  const v = item.variant;
  if (v?.brand?.name) return v.brand;
  const p = v?.product;
  if (p?.brand?.name) return p.brand;
  const pb = p?.productBrands?.[0]?.brand;
  if (pb?.name) return pb;
  return null;
}

function comparePricingRows(left: any, right: any) {
  const compareLabels = (
    leftLabel: string | null | undefined,
    rightLabel: string | null | undefined,
  ) =>
    (leftLabel ?? "").localeCompare(rightLabel ?? "", "en", {
      numeric: true,
      sensitivity: "base",
    });
  const leftVariant = left.variant;
  const rightVariant = right.variant;

  return (
    compareLabels(
      leftVariant?.product?.category?.name,
      rightVariant?.product?.category?.name,
    ) ||
    compareLabels(leftVariant?.product?.name, rightVariant?.product?.name) ||
    compareLabels(resolveBrand(left)?.name, resolveBrand(right)?.name) ||
    (leftVariant?.sortOrder ?? 0) - (rightVariant?.sortOrder ?? 0) ||
    compareLabels(
      leftVariant?.quantitySelectorLabel ?? leftVariant?.unitLabel,
      rightVariant?.quantitySelectorLabel ?? rightVariant?.unitLabel,
    ) ||
    compareLabels(leftVariant?.sku, rightVariant?.sku) ||
    (left.id ?? 0) - (right.id ?? 0)
  );
}

// ─── Status Config ─────────────────────────────────────────────

const STOCK_STATUS = {
  in_stock: { dot: "bg-emerald-500" },
  low: { dot: "bg-amber-500" },
  out: { dot: "bg-red-500" },
} as const;

function getStockStatus(qty: number) {
  if (qty <= 0) return STOCK_STATUS.out;
  if (qty <= 5) return STOCK_STATUS.low;
  return STOCK_STATUS.in_stock;
}

// ─── Main Page ─────────────────────────────────────────────────

export default function PricingPage() {
  const { data, isLoading, isError } = useMyRetailProducts({ limit: 200 });
  const updatePrice = useUpdateRetailPrice();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [brandFilter, setBrandFilter] = useState("all");

  const items: any[] = data?.items ?? [];

  // ─── Derive categories, brands, grouped data ──────────────────

  const { categories, brands, grouped, lastUpdated } = useMemo(() => {
    const catSet = new Map<string, string>();
    const brandSet = new Map<string, string>();
    let latestDate: Date | null = null;

    for (const item of items) {
      const cat = item.variant?.product?.category;
      if (cat?.name) catSet.set(cat.slug || cat.name, cat.name);
      const brand = resolveBrand(item);
      if (brand?.name) brandSet.set(String(brand.id), brand.name);
      // Track latest update
      if (item.updatedAt) {
        const d = new Date(item.updatedAt);
        if (!latestDate || d > latestDate) latestDate = d;
      }
    }

    // Apply filters
    let filtered = [...items];
    if (search.trim()) {
      const s = search.toLowerCase();
      filtered = filtered.filter((item: any) => {
        const prod = item.variant?.product;
        const brand = resolveBrand(item);
        return (
          prod?.name?.toLowerCase().includes(s) ||
          brand?.name?.toLowerCase().includes(s) ||
          item.variant?.sku?.toLowerCase().includes(s) ||
          item.variant?.preferredLocalSku?.toLowerCase().includes(s) ||
          item.variant?.catalogVariant?.globalSku?.toLowerCase().includes(s)
        );
      });
    }
    if (categoryFilter !== "all") {
      filtered = filtered.filter((item: any) => {
        const cat = item.variant?.product?.category;
        return (cat?.slug || cat?.name) === categoryFilter;
      });
    }
    if (brandFilter !== "all") {
      filtered = filtered.filter((item: any) => {
        const brand = resolveBrand(item);
        return String(brand?.id) === brandFilter;
      });
    }

    // Keep the same taxonomy order before and after a price mutation refetch.
    // Price and updatedAt are intentionally not sorting fields.
    filtered.sort(comparePricingRows);

    // Group: category → product → variants
    const grouped = new Map<
      string,
      {
        categoryName: string;
        products: Map<
          number,
          {
            productName: string;
            productImage: string | null;
            rows: any[];
          }
        >;
      }
    >();

    for (const item of filtered) {
      const prod = item.variant?.product;
      if (!prod) continue;
      const cat = prod.category;
      const catKey = cat?.name || "Uncategorized";
      const catSlug = cat?.slug || catKey;

      if (!grouped.has(catSlug)) {
        grouped.set(catSlug, { categoryName: catKey, products: new Map() });
      }
      const catGroup = grouped.get(catSlug)!;
      const prodId = prod.id;
      if (!catGroup.products.has(prodId)) {
        const img =
          prod.images?.[0]?.imageUrl ||
          prod.images?.[0]?.url ||
          prod.image ||
          null;
        catGroup.products.set(prodId, {
          productName: prod.name,
          productImage: img,
          rows: [],
        });
      }
      catGroup.products.get(prodId)!.rows.push(item);
    }

    return {
      categories: Array.from(catSet.entries())
        .map(([slug, name]) => ({ slug, name }))
        .sort((a, b) => a.name.localeCompare(b.name)),
      brands: Array.from(brandSet.entries())
        .map(([id, name]) => ({ id, name }))
        .sort((a, b) => a.name.localeCompare(b.name)),
      grouped,
      lastUpdated: latestDate ? formatRelativeDate(latestDate) : "—",
    };
  }, [items, search, categoryFilter, brandFilter]);

  // ─── Inline edit handlers ───────────────────────────────────────

  const startEdit = (inventoryId: number, currentPrice: string) => {
    setEditingId(inventoryId);
    setEditValue(currentPrice);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValue("");
  };

  const savePrice = (inventoryId: number) => {
    if (
      !editValue ||
      Number.isNaN(Number(editValue)) ||
      Number(editValue) <= 0
    ) {
      toast.error("Please enter a valid price");
      return;
    }
    updatePrice.mutate(
      { inventoryId, retailPrice: editValue },
      {
        onSuccess: () => {
          toast.success("Retail price updated");
          setEditingId(null);
          setEditValue("");
        },
        onError: (err: any) =>
          toast.error(err?.message || "Failed to update price"),
      },
    );
  };

  // ─── Quick Insights ─────────────────────────────────────────────

  const totalProducts = new Set(items.map((i: any) => i.variant?.product?.id))
    .size;
  const totalVariants = items.length;

  // ─── Render ─────────────────────────────────────────────────────

  return (
    <div className="space-y-5 max-w-5xl">
      {/* ════════════════════════════════════════════════════════
          HEADER
          ════════════════════════════════════════════════════════ */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2.5">
            <div className="p-2 bg-emerald-100 rounded-xl">
              <DollarSign className="text-emerald-600" size={20} />
            </div>
            💰 My Selling Price
          </h1>
          <p className="text-xs text-gray-500 mt-1 ml-11">
            My Store Selling Price (Final Customer Price)
          </p>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════
          SEARCH & FILTER
          ════════════════════════════════════════════════════════ */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2.5">
          🔍 Search & Filter
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Product / Brand..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[160px] h-9 text-xs">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.slug} value={c.slug}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={brandFilter} onValueChange={setBrandFilter}>
            <SelectTrigger className="w-[140px] h-9 text-xs">
              <SelectValue placeholder="Brand" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Brands</SelectItem>
              {brands.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════
          LOADING / ERROR / EMPTY
          ════════════════════════════════════════════════════════ */}
      {isLoading && (
        <div className="flex flex-col items-center justify-center py-20 bg-white border rounded-xl">
          <Loader2 className="h-6 w-6 animate-spin text-emerald-500 mb-3" />
          <p className="text-sm text-gray-500">Loading price list...</p>
        </div>
      )}

      {isError && (
        <div className="flex flex-col items-center justify-center py-20 bg-white border rounded-xl">
          <AlertCircle className="w-12 h-12 text-red-300 mb-3" />
          <p className="text-gray-500 font-medium">
            Failed to load pricing data
          </p>
        </div>
      )}

      {!isLoading && !isError && items.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 bg-white border border-dashed rounded-xl">
          <DollarSign className="w-12 h-12 text-gray-300 mb-3" />
          <p className="text-gray-500 text-lg font-medium">No product added</p>
          <p className="text-sm text-gray-400 mt-1 mb-4">
            Add products from the Product Catalog first.
          </p>
          <Button asChild size="sm">
            <Link href="/dashboard/product-catalog">
              <Plus className="h-3.5 w-3.5 mr-1.5" /> Add Product to Store
            </Link>
          </Button>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════
          PRODUCT PRICE LIST
          ════════════════════════════════════════════════════════ */}
      {!isLoading && !isError && grouped.size > 0 && (
        <div className="space-y-6">
          {Array.from(grouped.entries()).map(([catSlug, catGroup]) => (
            <div key={catSlug}>
              {/* Category Header */}
              <div className="flex items-center gap-2 mb-3">
                <Badge
                  variant="outline"
                  className="text-[10px] font-bold uppercase tracking-widest bg-gray-50 border-gray-200 text-gray-600"
                >
                  📂 {catGroup.categoryName}
                </Badge>
              </div>

              {/* Products */}
              <div className="space-y-4">
                {Array.from(catGroup.products.entries()).map(
                  ([prodId, prodGroup]) => (
                    <div
                      key={prodId}
                      className="bg-white border border-gray-200 rounded-xl overflow-hidden"
                    >
                      {/* Product Header */}
                      <div className="flex items-center gap-3 px-4 py-2.5 bg-gray-50/70 border-b border-gray-100">
                        {prodGroup.productImage ? (
                          <Image
                            src={prodGroup.productImage}
                            alt={prodGroup.productName}
                            width={28}
                            height={28}
                            className="w-7 h-7 rounded-lg object-cover border"
                          />
                        ) : (
                          <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center">
                            <Package className="h-3.5 w-3.5 text-gray-300" />
                          </div>
                        )}
                        <span className="text-sm font-bold text-gray-800">
                          🧾 {prodGroup.productName}
                        </span>
                        <Badge
                          variant="secondary"
                          className="text-[10px] ml-auto"
                        >
                          {prodGroup.rows.length} variant
                          {prodGroup.rows.length > 1 ? "s" : ""}
                        </Badge>
                      </div>

                      {/* Variant Table */}
                      <div className="overflow-x-auto">
                        {/* Table Header */}
                        <div className="grid min-w-[900px] grid-cols-[minmax(90px,1fr)_minmax(190px,1.7fr)_70px_240px_100px_60px_50px] border-gray-100 border-b bg-gray-50/40 px-4 py-2 font-bold text-[10px] text-gray-400 uppercase tracking-widest">
                          <div>Brand</div>
                          <div>Variant</div>
                          <div>Unit</div>
                          <div className="text-right">Price</div>
                          <div className="text-center">Last Update</div>
                          <div className="text-center">Stock</div>
                          <div className="text-center">Action</div>
                        </div>

                        {/* Variant Rows */}
                        <div className="divide-y divide-gray-50">
                          {prodGroup.rows.map((item: any) => {
                            const variant = item.variant;
                            const brand = resolveBrand(item);
                            const retailPrice = item.retailPrice
                              ? Number(item.retailPrice)
                              : null;
                            const isEditing = editingId === item.id;
                            const qty = Number(item.availableQty ?? 0);
                            const ss = getStockStatus(qty);

                            return (
                              <div
                                key={item.id}
                                className="grid min-w-[900px] grid-cols-[minmax(90px,1fr)_minmax(190px,1.7fr)_70px_240px_100px_60px_50px] items-center px-4 py-2.5 transition-colors hover:bg-gray-50/50"
                              >
                                {/* Brand */}
                                <div className="text-sm text-gray-700 font-medium truncate">
                                  {brand?.name || "—"}
                                </div>

                                {/* Variant */}
                                <div className="min-w-0">
                                  <p className="truncate text-sm text-gray-700">
                                    {variant?.quantitySelectorLabel ||
                                      variant?.unitLabel ||
                                      "Variant setup required"}
                                  </p>
                                  <p className="truncate font-mono text-[10px] tabular-nums text-gray-600">
                                    {variant?.catalogVariant?.globalSku ||
                                      "Global SKU pending"}
                                  </p>
                                  <p className="truncate font-mono text-[10px] tabular-nums text-gray-400">
                                    Local:{" "}
                                    {variant?.preferredLocalSku ||
                                      variant?.sku ||
                                      "Not assigned"}
                                  </p>
                                </div>

                                {/* Unit */}
                                <div className="text-xs text-gray-400">
                                  {variant?.weightKg
                                    ? `${variant.weightKg} KG`
                                    : variant?.unitLabel || "—"}
                                </div>

                                {/* Price */}
                                <div className="text-right">
                                  {isEditing ? (
                                    <div className="flex items-center justify-end gap-1">
                                      <Input
                                        type="text"
                                        inputMode="decimal"
                                        value={editValue}
                                        onChange={(e) =>
                                          setEditValue(e.target.value)
                                        }
                                        className="h-8 w-40 min-w-40 text-right font-medium text-sm tabular-nums"
                                        autoFocus
                                        onKeyDown={(e) => {
                                          if (e.key === "Enter")
                                            savePrice(item.id);
                                          if (e.key === "Escape") cancelEdit();
                                        }}
                                      />
                                      <button
                                        className="p-1 rounded hover:bg-emerald-50 transition-colors"
                                        onClick={() => savePrice(item.id)}
                                        disabled={updatePrice.isPending}
                                      >
                                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                                      </button>
                                      <button
                                        className="p-1 rounded hover:bg-red-50 transition-colors"
                                        onClick={cancelEdit}
                                      >
                                        <X className="h-3.5 w-3.5 text-gray-400" />
                                      </button>
                                    </div>
                                  ) : (
                                    <span className="text-sm font-bold text-gray-900">
                                      {retailPrice ? (
                                        `৳ ${retailPrice.toLocaleString()}`
                                      ) : (
                                        <span className="text-amber-500 text-xs font-medium">
                                          Not set
                                        </span>
                                      )}
                                    </span>
                                  )}
                                </div>

                                {/* Last Update */}
                                <div className="text-center">
                                  <span className="text-[11px] text-gray-400">
                                    {item.updatedAt
                                      ? formatRelativeDate(item.updatedAt)
                                      : "—"}
                                  </span>
                                </div>

                                {/* Stock */}
                                <div className="flex items-center justify-center gap-1.5">
                                  <span
                                    className={`w-2 h-2 rounded-full ${ss.dot}`}
                                  />
                                </div>

                                {/* Action */}
                                <div className="flex justify-center">
                                  {!isEditing && (
                                    <button
                                      className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                                      onClick={() =>
                                        startEdit(
                                          item.id,
                                          retailPrice?.toString() || "",
                                        )
                                      }
                                    >
                                      <Pencil className="h-3.5 w-3.5 text-gray-400" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  ),
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════
          BULK ACTIONS
          ════════════════════════════════════════════════════════ */}
      {!isLoading && !isError && items.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2.5">
            ⚙ Bulk Action
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs h-8"
              disabled
            >
              <Upload size={12} /> Upload Price (Excel)
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs h-8"
              disabled
            >
              <Download size={12} /> Export Price List
            </Button>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════
          QUICK INSIGHT
          ════════════════════════════════════════════════════════ */}
      {!isLoading && !isError && items.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">
            📊 Quick Insight
          </p>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-gray-400">Total Products</p>
              <p className="text-lg font-bold text-gray-900">
                → {totalProducts}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Total Variants</p>
              <p className="text-lg font-bold text-gray-900">
                → {totalVariants}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Last Updated</p>
              <p className="text-lg font-bold text-gray-900">→ {lastUpdated}</p>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════
          SYSTEM RULES
          ════════════════════════════════════════════════════════ */}
      <div className="bg-amber-50/50 border border-amber-200 rounded-xl px-4 py-3">
        <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest mb-1.5">
          ⚠ System Rules
        </p>
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-amber-700">
          <span>✔ Retailer sets final selling price</span>
          <span>✔ Only one price is used (Customer Price)</span>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-gray-500 mt-1">
          <span>✔ Cannot modify: Brand / Variant / Core Product</span>
        </div>
      </div>
    </div>
  );
}
