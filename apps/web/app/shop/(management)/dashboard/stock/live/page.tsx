"use client";

import {
  BoxesIcon,
  ChevronDown,
  ChevronRight,
  Package,
  Plus,
  Search,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
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
import { useRealtimeStock } from "@/hooks/use-shop-owner-api";

const STATUS_CONFIG = {
  in_stock: {
    label: "In Stock",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  low: {
    label: "Low Stock",
    className: "border-amber-200 bg-amber-50 text-amber-700",
  },
  out_of_stock: {
    label: "Out of Stock",
    className: "border-red-200 bg-red-50 text-red-700",
  },
} as const;

export default function StockLivePage() {
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState<number>();
  const [status, setStatus] = useState<
    "all" | "in_stock" | "low" | "out_of_stock"
  >("all");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const { data, isLoading } = useRealtimeStock({
    search: search || undefined,
    categoryId,
    status,
  });
  const products: any[] = (data as any)?.products ?? [];
  const categories: any[] = (data as any)?.categories ?? [];

  return (
    <div className="max-w-5xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-bold">
            <BoxesIcon className="h-5 w-5 text-emerald-600" /> Real-time stock
          </h1>
          <p className="text-xs text-muted-foreground">
            Inventory is shown in each configured variant&apos;s canonical unit.
          </p>
        </div>
        <Button asChild size="sm">
          <Link href="/dashboard/stock/add">
            <Plus className="mr-1 h-4 w-4" />
            Add stock
          </Link>
        </Button>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search product, SKU, or brand"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <Select
          value={categoryId?.toString() ?? "all"}
          onValueChange={(value) =>
            setCategoryId(value === "all" ? undefined : Number(value))
          }
        >
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories.map((category: any) => (
              <SelectItem key={category.id} value={String(category.id)}>
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={status}
          onValueChange={(value: typeof status) => setStatus(value)}
        >
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="in_stock">In stock</SelectItem>
            <SelectItem value="low">Low stock</SelectItem>
            <SelectItem value="out_of_stock">Out of stock</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="rounded-xl border py-16 text-center text-sm text-muted-foreground">
          Loading stock…
        </div>
      ) : products.length === 0 ? (
        <div className="rounded-xl border border-dashed py-16 text-center">
          <Package className="mx-auto mb-2 h-10 w-10 text-muted-foreground/40" />
          <p className="font-medium">No stock found</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-background">
          {products.map((product: any) => {
            const expanded = expandedId === product.productId;
            const statusConfig =
              STATUS_CONFIG[product.status as keyof typeof STATUS_CONFIG];
            return (
              <div key={product.productId} className="border-b last:border-b-0">
                <button
                  type="button"
                  className="grid w-full grid-cols-[24px_1fr_auto] items-center gap-3 p-4 text-left hover:bg-muted/40"
                  onClick={() =>
                    setExpandedId(expanded ? null : product.productId)
                  }
                >
                  {expanded ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                  <div className="flex min-w-0 items-center gap-3">
                    {product.productImage ? (
                      <Image
                        src={product.productImage}
                        alt=""
                        width={36}
                        height={36}
                        className="h-9 w-9 rounded-md border object-cover"
                      />
                    ) : (
                      <div className="flex h-9 w-9 items-center justify-center rounded-md bg-muted">
                        <Package className="h-4 w-4" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">
                        {product.productName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {product.categoryName ?? "Uncategorized"} ·{" "}
                        {product.variants.length} configured variant
                        {product.variants.length === 1 ? "" : "s"}
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className={statusConfig.className}>
                    {statusConfig.label}
                  </Badge>
                </button>
                {expanded && (
                  <div className="border-t bg-muted/20 px-4 py-3">
                    <div className="overflow-hidden rounded-lg border bg-background">
                      {product.variants.map((variant: any) => (
                        <div
                          key={variant.variantId}
                          className="grid gap-2 border-b px-3 py-2.5 last:border-b-0 sm:grid-cols-[1fr_auto] sm:items-center"
                        >
                          <div>
                            <p className="text-sm font-medium">
                              {variant.brandName
                                ? `${variant.brandName} · `
                                : ""}
                              {variant.unitLabel}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {variant.sku ?? "No SKU"} · {variant.packType}
                            </p>
                          </div>
                          <div className="text-sm font-semibold tabular-nums">
                            {variant.stockDisplay}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
