"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  AlertCircle, Check, DollarSign, Package, Pencil, X,
  Search, Plus, Download, Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  useMyRetailProducts,
  useUpdateRetailPrice,
} from "@/hooks/use-shop-owner-api";

export default function PricingPage() {
  const { data, isLoading, isError } = useMyRetailProducts({ limit: 200 });
  const updatePrice = useUpdateRetailPrice();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [brandFilter, setBrandFilter] = useState<string>("all");

  const items = data?.items ?? [];

  // ─── Derive categories and brands from data ─────────────────

  // Resolve brand: variant.brand → product.brand → product.productBrands[0].brand
  const resolveBrand = (item: any) => {
    const v = item.variant;
    if (v?.brand?.name) return v.brand;
    const p = v?.product;
    if (p?.brand?.name) return p.brand;
    const pb = p?.productBrands?.[0]?.brand;
    if (pb?.name) return pb;
    return null;
  };

  const { categories, brands, grouped } = useMemo(() => {
    const catSet = new Map<string, string>();
    const brandSet = new Map<string, string>();

    for (const item of items) {
      const cat = (item as any).variant?.product?.category;
      if (cat?.name) catSet.set(cat.slug || cat.name, cat.name);
      const brand = resolveBrand(item);
      if (brand?.name) brandSet.set(String(brand.id), brand.name);
    }

    // Filter items
    let filtered = items;
    if (search.trim()) {
      const s = search.toLowerCase();
      filtered = filtered.filter((item: any) => {
        const prod = item.variant?.product;
        const brand = item.variant?.brand;
        return (
          prod?.name?.toLowerCase().includes(s) ||
          brand?.name?.toLowerCase().includes(s) ||
          item.variant?.sku?.toLowerCase().includes(s)
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
        const brand = item.variant?.brand;
        return String(brand?.id) === brandFilter;
      });
    }

    // Group by category → product
    const grouped = new Map<string, {
      categoryName: string;
      products: Map<number, {
        productName: string;
        productImage: string | null;
        rows: any[];
      }>;
    }>();

    for (const item of filtered) {
      const prod = (item as any).variant?.product;
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
        const img = prod.images?.[0]?.url || prod.image || null;
        catGroup.products.set(prodId, {
          productName: prod.name,
          productImage: img,
          rows: [],
        });
      }

      catGroup.products.get(prodId)!.rows.push(item);
    }

    return {
      categories: Array.from(catSet.entries()).map(([slug, name]) => ({ slug, name })),
      brands: Array.from(brandSet.entries()).map(([id, name]) => ({ id, name })),
      grouped,
    };
  }, [items, search, categoryFilter, brandFilter]);

  // ─── Inline edit handlers ───────────────────────────────────

  const startEdit = (inventoryId: number, currentPrice: string) => {
    setEditingId(inventoryId);
    setEditValue(currentPrice);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValue("");
  };

  const savePrice = (inventoryId: number) => {
    if (!editValue || Number.isNaN(Number(editValue)) || Number(editValue) <= 0) {
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
        onError: (err: any) => toast.error(err?.message || "Failed to update price"),
      },
    );
  };

  // ─── Quick Insights ─────────────────────────────────────────

  const totalProducts = new Set(items.map((i: any) => i.variant?.product?.id)).size;
  const totalVariants = items.length;

  // ─── Render ─────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">My Selling Price</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Set your retail selling prices. Click the edit icon to update.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled>
            <Download className="h-3.5 w-3.5 mr-1.5" /> Export
          </Button>
        </div>
      </div>

      {/* Quick Insights */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Card>
          <CardContent className="py-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center">
              <Package className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <p className="text-lg font-bold">{totalProducts}</p>
              <p className="text-xs text-muted-foreground">Products</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center">
              <DollarSign className="h-4 w-4 text-emerald-600" />
            </div>
            <div>
              <p className="text-lg font-bold">{totalVariants}</p>
              <p className="text-xs text-muted-foreground">Variants</p>
            </div>
          </CardContent>
        </Card>
        <Card className="hidden sm:block">
          <CardContent className="py-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center">
              <AlertCircle className="h-4 w-4 text-amber-600" />
            </div>
            <div>
              <p className="text-lg font-bold">
                {items.filter((i: any) => !i.retailPrice || Number(i.retailPrice) <= 0).length}
              </p>
              <p className="text-xs text-muted-foreground">Unpriced</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search + Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search product or brand..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm min-w-[140px]"
        >
          <option value="all">All Categories</option>
          {categories.map((c) => (
            <option key={c.slug} value={c.slug}>{c.name}</option>
          ))}
        </select>
        <select
          value={brandFilter}
          onChange={(e) => setBrandFilter(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm min-w-[120px]"
        >
          <option value="all">All Brands</option>
          {brands.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Error */}
      {isError && (
        <Card>
          <CardContent className="py-12 text-center">
            <AlertCircle className="w-12 h-12 text-red-300 mx-auto mb-3" />
            <p className="text-muted-foreground font-medium">Failed to load pricing data</p>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {!isLoading && !isError && items.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <DollarSign className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-muted-foreground font-medium">No products to price yet</p>
            <p className="text-sm text-muted-foreground mt-1 mb-4">
              Add products from the Product Catalog first.
            </p>
            <Button asChild>
              <Link href="/dashboard/product-catalog">
                <Plus className="h-4 w-4 mr-1.5" /> Add Product to Store
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Grouped Price Table */}
      {!isLoading && !isError && grouped.size > 0 && (
        <div className="space-y-6">
          {Array.from(grouped.entries()).map(([catSlug, catGroup]) => (
            <div key={catSlug}>
              {/* Category Header */}
              <div className="flex items-center gap-2 mb-3">
                <Badge variant="outline" className="text-xs font-semibold uppercase tracking-wide">
                  📂 {catGroup.categoryName}
                </Badge>
              </div>

              <div className="space-y-4">
                {Array.from(catGroup.products.entries()).map(([prodId, prodGroup]) => (
                  <Card key={prodId} className="overflow-hidden">
                    {/* Product Header */}
                    <div className="flex items-center gap-3 px-4 py-2.5 bg-gray-50/50 border-b">
                      {prodGroup.productImage ? (
                        <img
                          src={prodGroup.productImage}
                          alt={prodGroup.productName}
                          className="w-8 h-8 rounded object-cover border"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded bg-gray-100 flex items-center justify-center">
                          <Package className="h-4 w-4 text-gray-300" />
                        </div>
                      )}
                      <span className="text-sm font-semibold">{prodGroup.productName}</span>
                      <Badge variant="secondary" className="text-[10px] ml-auto">
                        {prodGroup.rows.length} variant{prodGroup.rows.length > 1 ? "s" : ""}
                      </Badge>
                    </div>

                    {/* Variant Table */}
                    <Table>
                      <TableHeader>
                        <TableRow className="text-xs">
                          <TableHead className="py-2">Brand</TableHead>
                          <TableHead className="py-2">Variant</TableHead>
                          <TableHead className="py-2">Unit</TableHead>
                          <TableHead className="text-right py-2">Price</TableHead>
                          <TableHead className="text-right py-2">Stock</TableHead>
                          <TableHead className="text-right py-2 w-[60px]">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {prodGroup.rows.map((item: any) => {
                          const variant = item.variant;
                          const brand = resolveBrand(item);
                          const retailPrice = item.retailPrice ? Number(item.retailPrice) : null;
                          const isEditing = editingId === item.id;
                          const qty = Number(item.availableQty ?? 0);

                          return (
                            <TableRow key={item.id}>
                              <TableCell className="text-sm py-2">
                                {brand?.name || "—"}
                              </TableCell>
                              <TableCell className="text-sm py-2">
                                {variant?.quantitySelectorLabel || variant?.unitLabel || variant?.sku || "—"}
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground py-2">
                                {variant?.weightKg ? `${variant.weightKg} KG` : variant?.unitLabel || "—"}
                              </TableCell>
                              <TableCell className="text-right py-2">
                                {isEditing ? (
                                  <div className="flex items-center justify-end gap-1">
                                    <Input
                                      type="text"
                                      inputMode="decimal"
                                      value={editValue}
                                      onChange={(e) => setEditValue(e.target.value)}
                                      className="w-24 h-7 text-right text-sm"
                                      autoFocus
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter") savePrice(item.id);
                                        if (e.key === "Escape") cancelEdit();
                                      }}
                                    />
                                    <Button
                                      variant="ghost" size="icon" className="h-6 w-6"
                                      onClick={() => savePrice(item.id)}
                                      disabled={updatePrice.isPending}
                                    >
                                      <Check className="h-3 w-3 text-emerald-600" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={cancelEdit}>
                                      <X className="h-3 w-3 text-gray-400" />
                                    </Button>
                                  </div>
                                ) : (
                                  <span className="text-sm font-medium">
                                    {retailPrice ? `৳ ${retailPrice.toLocaleString()}` : (
                                      <span className="text-amber-500 text-xs">Not set</span>
                                    )}
                                  </span>
                                )}
                              </TableCell>
                              <TableCell className="text-right py-2">
                                <span className={`inline-block w-2 h-2 rounded-full mr-1.5 ${
                                  qty > 10 ? "bg-emerald-500" : qty > 0 ? "bg-amber-500" : "bg-red-500"
                                }`} />
                                <span className="text-xs text-muted-foreground">{qty}</span>
                              </TableCell>
                              <TableCell className="text-right py-2">
                                {!isEditing && (
                                  <Button
                                    variant="ghost" size="icon" className="h-6 w-6"
                                    onClick={() => startEdit(
                                      item.id,
                                      retailPrice?.toString() || "",
                                    )}
                                  >
                                    <Pencil className="h-3 w-3 text-gray-400" />
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* System Rules */}
      <Card>
        <CardContent className="py-3">
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
            <span>✔ Retailer sets final selling price</span>
            <span>✔ Only one price (Customer Price)</span>
            <span>✔ Cannot modify Brand / Variant / Core Product</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
