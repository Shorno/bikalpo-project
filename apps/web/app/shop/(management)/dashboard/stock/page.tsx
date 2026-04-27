"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  BoxesIcon, Loader2, Package, Plus, Search,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card, CardContent, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useMyRetailProducts } from "@/hooks/use-shop-owner-api";

export default function StockPage() {
  const [search, setSearch] = useState("");
  const { data, isLoading } = useMyRetailProducts(search);
  const items: any[] = data ?? [];

  // Derive stats
  const stats = useMemo(() => {
    let totalVariants = 0;
    let outOfStock = 0;
    let lowStock = 0;

    for (const item of items) {
      totalVariants++;
      const qty = Number(item.availableQty ?? 0);
      if (qty <= 0) outOfStock++;
      else if (qty <= 5) lowStock++;
    }

    return { totalVariants, outOfStock, lowStock };
  }, [items]);

  // Resolve brand
  const resolveBrand = (item: any) => {
    const v = item.variant;
    if (v?.brand?.name) return v.brand.name;
    const p = v?.product;
    if (p?.brand?.name) return p.brand.name;
    const pb = p?.productBrands?.[0]?.brand;
    if (pb?.name) return pb.name;
    return null;
  };

  return (
    <div className="space-y-6 p-1">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Stock Management</h1>
          <p className="text-sm text-muted-foreground">
            View and manage your inventory levels.
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/stock/add">
            <Plus className="mr-2 h-4 w-4" />
            Add Stock
          </Link>
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="flex items-center gap-3 pt-5">
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
              <BoxesIcon className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.totalVariants}</p>
              <p className="text-xs text-muted-foreground">Total Variants</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-5">
            <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center">
              <Package className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-red-600">{stats.outOfStock}</p>
              <p className="text-xs text-muted-foreground">Out of Stock</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-5">
            <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center">
              <Package className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-amber-600">{stats.lowStock}</p>
              <p className="text-xs text-muted-foreground">Low Stock (≤5)</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search product or brand..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Inventory Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Inventory</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Package className="h-10 w-10 mx-auto mb-3 text-gray-300" />
              <p className="text-sm">No inventory items found</p>
              <Button asChild className="mt-4" variant="outline" size="sm">
                <Link href="/dashboard/stock/add">
                  <Plus className="mr-1 h-3 w-3" /> Add Stock
                </Link>
              </Button>
            </div>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="text-xs bg-muted/30">
                    <TableHead className="py-2">Product</TableHead>
                    <TableHead className="py-2">Brand</TableHead>
                    <TableHead className="py-2">Variant</TableHead>
                    <TableHead className="py-2">Unit</TableHead>
                    <TableHead className="text-center py-2">Stock</TableHead>
                    <TableHead className="text-right py-2">Price</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item: any) => {
                    const variant = item.variant;
                    const product = variant?.product;
                    const qty = Number(item.availableQty ?? 0);
                    const price = item.retailPrice ? Number(item.retailPrice) : null;

                    return (
                      <TableRow key={item.id}>
                        <TableCell className="py-2.5">
                          <div className="flex items-center gap-2">
                            {product?.images?.[0]?.url ? (
                              <img
                                src={product.images[0].url}
                                alt={product?.name}
                                className="w-7 h-7 rounded object-cover border"
                              />
                            ) : (
                              <div className="w-7 h-7 rounded bg-gray-100 flex items-center justify-center">
                                <Package className="h-3 w-3 text-gray-300" />
                              </div>
                            )}
                            <span className="text-sm font-medium truncate max-w-[140px]">
                              {product?.name || "—"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm py-2.5">
                          {resolveBrand(item) || "—"}
                        </TableCell>
                        <TableCell className="text-sm py-2.5">
                          {variant?.quantitySelectorLabel || variant?.unitLabel || "—"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground py-2.5">
                          {variant?.weightKg ? `${variant.weightKg} KG` : "—"}
                        </TableCell>
                        <TableCell className="text-center py-2.5">
                          <Badge
                            variant="outline"
                            className={`text-xs ${
                              qty > 10
                                ? "border-emerald-200 text-emerald-700 bg-emerald-50"
                                : qty > 0
                                  ? "border-amber-200 text-amber-700 bg-amber-50"
                                  : "border-red-200 text-red-700 bg-red-50"
                            }`}
                          >
                            {qty}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right text-sm py-2.5">
                          {price != null ? (
                            <span className="font-semibold">
                              ৳ {price.toLocaleString("en-IN")}
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-xs">Not set</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
