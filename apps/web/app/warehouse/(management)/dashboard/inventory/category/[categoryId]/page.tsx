"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Boxes, Package, Search, Tag } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useDeferredValue, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { orpc } from "@/utils/orpc";

const WH = "/warehouse/dashboard";
const PAGE_SIZE = 25;

type StockCategory = {
  id: number;
  name: string;
  productCount: number;
};

type BreakdownItem = {
  packagingType: string;
  label: string;
  qty: number;
  unit: string;
};

type StockListItem = {
  groupKey: string;
  coreProductId: number | null;
  coreProductName: string;
  coreProductSku: string | null;
  categoryName: string | null;
  totalQty: number;
  stdUnit: string;
  variantCount: number;
  breakdown: BreakdownItem[];
  status: "in_stock" | "out_of_stock";
};

function formatNumber(value: number | string | null | undefined) {
  const num = Number(value ?? 0);
  return Number.isFinite(num) ? num.toLocaleString("en-BD") : "0";
}

function getStockText(item: StockListItem) {
  if (item.breakdown.length === 0) {
    return `${formatNumber(Math.round(item.totalQty))} ${item.stdUnit}`;
  }

  return item.breakdown
    .slice(0, 4)
    .map((part) => {
      const unit =
        part.packagingType === "loose" ? item.stdUnit : part.unit || part.label;
      return `${formatNumber(Math.round(part.qty))} ${unit}`;
    })
    .join(" + ");
}

function StockBadge({ item }: { item: StockListItem }) {
  const lowStock = item.totalQty > 0 && item.totalQty <= 50;
  if (item.status === "out_of_stock" || item.totalQty <= 0) {
    return (
      <Badge
        variant="outline"
        className="w-fit border-rose-200 bg-rose-50 text-rose-700"
      >
        Out
      </Badge>
    );
  }
  if (lowStock) {
    return (
      <Badge
        variant="outline"
        className="w-fit border-amber-200 bg-amber-50 text-amber-700"
      >
        Low
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className="w-fit border-emerald-200 bg-emerald-50 text-emerald-700"
    >
      Active
    </Badge>
  );
}

export default function InventoryCategoryDetailPage() {
  const params = useParams();
  const categoryId = Number(params.categoryId as string);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const deferredSearch = useDeferredValue(search.trim());

  const { data: categoryData } = useQuery({
    queryKey: [
      "stockOverview",
      "categories",
      "warehouse",
      "inventoryCategoryDetail",
    ],
    queryFn: () =>
      (orpc.stockOverview as any).getStockCategories.call({
        ownerType: "warehouse",
      }),
    staleTime: 1000 * 60,
  });

  const { data, isLoading } = useQuery({
    queryKey: [
      "stockOverview",
      "stockList",
      "warehouse",
      "inventoryCategoryDetail",
      categoryId,
      deferredSearch,
      page,
    ],
    queryFn: () =>
      (orpc.stockOverview as any).getStockList.call({
        ownerType: "warehouse",
        categoryId,
        search: deferredSearch || undefined,
        page,
        pageSize: PAGE_SIZE,
      }),
    enabled: Number.isFinite(categoryId),
    staleTime: 1000 * 30,
  });

  const categories = (categoryData?.categories ?? []) as StockCategory[];
  const category = useMemo(
    () => categories.find((item) => item.id === categoryId),
    [categories, categoryId],
  );

  const items = (data?.items ?? []) as StockListItem[];
  const totalCount = Number(data?.totalCount ?? 0);
  const totalPages = Math.max(1, Number(data?.totalPages ?? 1));
  const categoryName = category?.name || `Category #${categoryId}`;

  return (
    <div className="space-y-5">
      <Link
        href={`${WH}/inventory`}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors hover:text-slate-950"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Inventory Management
      </Link>

      <header className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-md border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700">
              <Tag className="h-3.5 w-3.5" />
              Product Category
            </div>
            <h1 className="text-2xl font-bold tracking-normal text-slate-950">
              {categoryName}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Core products in this category, grouped at total stock level
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:flex">
            <SummaryPill
              icon={Package}
              label="Core Products"
              value={formatNumber(totalCount)}
            />
            <SummaryPill
              icon={Boxes}
              label="Page"
              value={`${formatNumber(page)} / ${formatNumber(totalPages)}`}
            />
          </div>
        </div>
      </header>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="relative max-w-xl">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Search core product / SKU"
            className="h-10 pl-9"
          />
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center gap-2">
          <span className="rounded-md bg-slate-100 p-1.5 text-slate-600">
            <Package className="h-4 w-4" />
          </span>
          <h2 className="text-sm font-bold uppercase tracking-normal text-slate-900">
            Core Product Total Stock
          </h2>
        </div>

        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="grid grid-cols-[1.5fr_0.8fr_1.2fr_0.6fr] border-b bg-slate-50 px-4 py-3 text-xs font-bold uppercase tracking-normal text-slate-500">
            <span>Core Product</span>
            <span>SKU</span>
            <span>Stock</span>
            <span>Status</span>
          </div>

          {isLoading ? (
            <div className="space-y-2 p-4">
              {[1, 2, 3, 4, 5].map((item) => (
                <Skeleton key={item} className="h-10 w-full" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">
              {search
                ? "No core products match this search"
                : "No core products found"}
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {items.map((item) => (
                <div
                  key={item.groupKey}
                  className="grid grid-cols-[1.5fr_0.8fr_1.2fr_0.6fr] items-center px-4 py-3 text-sm"
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-900">
                      {item.coreProductName}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {item.variantCount} SKU variant
                      {item.variantCount === 1 ? "" : "s"}
                    </p>
                  </div>
                  <span className="truncate text-xs font-mono text-slate-500">
                    {item.coreProductSku || "-"}
                  </span>
                  <span className="truncate font-medium text-slate-700">
                    {getStockText(item)}
                  </span>
                  <StockBadge item={item} />
                </div>
              ))}
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-4 py-3">
              <p className="text-xs text-slate-500">
                Showing{" "}
                <span className="font-semibold text-slate-900">
                  {(page - 1) * PAGE_SIZE + 1}-
                  {Math.min(page * PAGE_SIZE, totalCount)}
                </span>{" "}
                of{" "}
                <span className="font-semibold text-slate-900">
                  {totalCount}
                </span>
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 1}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() =>
                    setPage((current) => Math.min(totalPages, current + 1))
                  }
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function SummaryPill({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-slate-500" />
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-normal text-slate-500">
            {label}
          </p>
          <p className="text-sm font-bold tabular-nums text-slate-950">
            {value}
          </p>
        </div>
      </div>
    </div>
  );
}
