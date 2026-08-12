"use client";

import { useQuery } from "@tanstack/react-query";
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { ArrowUpDown, Search, Tag } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { orpc } from "@/utils/orpc";

type QuantityGroup = {
  productTypeId: number;
  productTypeName: string;
  inventoryUnit: string;
  productCount: number;
  variantCount: number;
  available: number;
  reserved: number;
  onHand: number;
  referenceMeasurement?: {
    unit: "kg" | "liter";
    available: number;
    reserved: number;
    onHand: number;
  };
};

type StockStatusSummary = {
  inStock: number;
  lowStock: number;
  outOfStock: number;
  reserved: number;
  missingThreshold: number;
};

type BrandStockItem = {
  brandId: number;
  brandName: string;
  brandLogo: string | null;
  brandSlug: string;
  productCount: number;
  variantCount: number;
  quantityGroups: QuantityGroup[];
  stockStatus: StockStatusSummary;
  configurationIssueCount: number;
};

type DistributionGroup = {
  key: string;
  productTypeName: string;
  inventoryUnit: string;
  totalOnHand: number;
  brands: Array<{
    brandId: number;
    brandName: string;
    onHand: number;
  }>;
};

const DISTRIBUTION_COLORS = [
  "bg-blue-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-violet-500",
  "bg-rose-500",
  "bg-cyan-500",
  "bg-orange-500",
  "bg-indigo-500",
];

function formatNumber(value: number) {
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function formatUnit(unit: string, quantity: number) {
  const normalized = unit.trim();
  const lower = normalized.toLowerCase();
  if (["kg", "g", "ml", "l", "liter", "litre"].includes(lower)) {
    return normalized;
  }
  if (quantity === 1 || normalized.endsWith("s")) return normalized;
  if (normalized.endsWith("x")) return `${normalized}es`;
  return `${normalized}s`;
}

function formatQuantity(value: number, unit: string) {
  return `${formatNumber(value)} ${formatUnit(unit, value)}`;
}

function QuantityGroupsCell({ groups }: { groups: QuantityGroup[] }) {
  if (groups.length === 0) {
    return (
      <span className="text-xs font-medium text-amber-700">
        Admin variant setup required
      </span>
    );
  }

  return (
    <div className="space-y-1">
      {groups.map((group) => {
        const key = `${group.productTypeId}:${group.inventoryUnit}:${group.referenceMeasurement?.unit ?? "none"}`;
        return (
          <div key={key}>
            <div className="text-sm font-bold text-gray-900 tabular-nums">
              {groups.length > 1 && (
                <span className="mr-1 font-medium text-gray-500">
                  {group.productTypeName}:
                </span>
              )}
              {formatQuantity(group.onHand, group.inventoryUnit)}
            </div>
            {group.referenceMeasurement && (
              <div className="text-[11px] text-gray-400 tabular-nums">
                {formatNumber(group.referenceMeasurement.onHand)}{" "}
                {group.referenceMeasurement.unit.toUpperCase()} reference
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function BrandTableSkeleton() {
  return (
    <div
      className="overflow-hidden rounded-lg border border-gray-200 bg-white"
      aria-busy="true"
    >
      <div className="h-10 animate-pulse border-b bg-gray-50" />
      {[0, 1, 2].map((row) => (
        <div
          key={row}
          className="grid grid-cols-[40px_2fr_1fr_1.4fr_1fr_70px] gap-4 border-b px-3 py-3 last:border-b-0"
        >
          {[0, 1, 2, 3, 4, 5].map((cell) => (
            <div
              key={cell}
              className="h-5 animate-pulse rounded bg-slate-100"
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export default function BrandStockPage() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [categoryId, setCategoryId] = useState<number | undefined>(undefined);
  const [sorting, setSorting] = useState<SortingState>([]);

  useEffect(() => {
    const timer = window.setTimeout(
      () => setDebouncedSearch(search.trim()),
      300,
    );
    return () => window.clearTimeout(timer);
  }, [search]);

  const { data: catData } = useQuery({
    queryKey: ["stockOverview", "categories", "warehouse"],
    queryFn: () =>
      orpc.stockOverview.getStockCategories.call({ ownerType: "warehouse" }),
  });

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: [
      "stockOverview",
      "brandStockOverview",
      "warehouse",
      categoryId,
      debouncedSearch,
    ],
    queryFn: () =>
      orpc.stockOverview.getBrandStockOverview.call({
        ownerType: "warehouse",
        categoryId,
        search: debouncedSearch || undefined,
      }),
  });

  const categories = catData?.categories ?? [];
  const brands = (data?.brands ?? []) as BrandStockItem[];

  const distributionGroups = useMemo<DistributionGroup[]>(() => {
    const groups = new Map<string, DistributionGroup>();
    for (const brand of brands) {
      for (const quantityGroup of brand.quantityGroups) {
        if (quantityGroup.onHand <= 0) continue;
        const key = `${quantityGroup.productTypeId}:${quantityGroup.inventoryUnit}:${quantityGroup.referenceMeasurement?.unit ?? "none"}`;
        let group = groups.get(key);
        if (!group) {
          group = {
            key,
            productTypeName: quantityGroup.productTypeName,
            inventoryUnit: quantityGroup.inventoryUnit,
            totalOnHand: 0,
            brands: [],
          };
          groups.set(key, group);
        }
        group.totalOnHand += quantityGroup.onHand;
        group.brands.push({
          brandId: brand.brandId,
          brandName: brand.brandName,
          onHand: quantityGroup.onHand,
        });
      }
    }
    return Array.from(groups.values())
      .map((group) => ({
        ...group,
        brands: group.brands.sort((a, b) => b.onHand - a.onHand),
      }))
      .sort(
        (a, b) =>
          a.productTypeName.localeCompare(b.productTypeName) ||
          a.inventoryUnit.localeCompare(b.inventoryUnit),
      );
  }, [brands]);

  const columns = useMemo<ColumnDef<BrandStockItem>[]>(
    () => [
      {
        id: "index",
        header: "#",
        cell: ({ row }) => (
          <span className="text-xs text-gray-400 tabular-nums">
            {row.index + 1}
          </span>
        ),
        size: 40,
      },
      {
        id: "brandName",
        accessorKey: "brandName",
        header: ({ column }) => (
          <button
            type="button"
            className="flex items-center gap-1 transition-colors hover:text-gray-900"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Brand Name
            <ArrowUpDown size={12} />
          </button>
        ),
        cell: ({ row }) => {
          const item = row.original;
          return (
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-md bg-gray-100">
                {item.brandLogo ? (
                  <Image
                    src={item.brandLogo}
                    alt={item.brandName}
                    width={32}
                    height={32}
                    className="h-8 w-8 object-cover"
                    unoptimized={item.brandLogo.startsWith("http")}
                  />
                ) : (
                  <Tag size={14} className="text-gray-400" />
                )}
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-gray-900">
                  {item.brandName}
                </div>
                {item.configurationIssueCount > 0 && (
                  <div className="text-[11px] font-medium text-amber-700">
                    {item.configurationIssueCount} configuration issue
                    {item.configurationIssueCount === 1 ? "" : "s"}
                  </div>
                )}
              </div>
            </div>
          );
        },
        size: 220,
      },
      {
        id: "variantCount",
        accessorKey: "variantCount",
        header: ({ column }) => (
          <button
            type="button"
            className="flex items-center gap-1 transition-colors hover:text-gray-900"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Total SKU
            <ArrowUpDown size={12} />
          </button>
        ),
        cell: ({ row }) => (
          <span className="text-sm font-bold text-gray-900 tabular-nums">
            {row.original.variantCount.toLocaleString()}
          </span>
        ),
        size: 100,
      },
      {
        id: "totalStock",
        header: "Total Stock",
        cell: ({ row }) => (
          <QuantityGroupsCell groups={row.original.quantityGroups} />
        ),
        size: 170,
      },
      {
        id: "lowStock",
        accessorFn: (row) => row.stockStatus.lowStock,
        header: ({ column }) => (
          <button
            type="button"
            className="flex items-center gap-1 transition-colors hover:text-gray-900"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Low Stock
            <ArrowUpDown size={12} />
          </button>
        ),
        cell: ({ row }) => {
          const count = row.original.stockStatus.lowStock;
          return (
            <span
              className={`text-sm font-bold tabular-nums ${count > 0 ? "text-amber-600" : "text-gray-400"}`}
            >
              {count}
            </span>
          );
        },
        size: 100,
      },
      {
        id: "action",
        header: () => <span className="block text-center">Action</span>,
        cell: ({ row }) => (
          <div className="text-center">
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="text-xs font-medium text-blue-600 hover:text-blue-800"
            >
              <Link
                href={`/warehouse/dashboard/stock/brands/${row.original.brandId}`}
              >
                View
              </Link>
            </Button>
          </div>
        ),
        size: 70,
      },
    ],
    [],
  );

  const table = useReactTable({
    data: brands,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getRowId: (row) => String(row.brandId),
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">
          🏷️ Brand Stock Overview
        </h1>
        <p className="mt-0.5 text-sm text-gray-500">
          View inventory grouped by Brand
        </p>
      </div>

      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
        <div className="relative max-w-xs flex-1">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <Input
            placeholder="Search Brand / Product..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="h-9 pl-9 text-sm"
          />
        </div>

        <Select
          value={categoryId ? String(categoryId) : "all"}
          onValueChange={(value) =>
            setCategoryId(value === "all" ? undefined : Number(value))
          }
        >
          <SelectTrigger className="h-9 w-44 text-sm">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((category) => (
              <SelectItem key={category.id} value={String(category.id)}>
                {category.name} ({category.productCount})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <p className="ml-auto text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">{brands.length}</span>{" "}
          brands
        </p>
      </div>

      <div className="text-xs font-bold uppercase tracking-wider text-gray-600">
        📋 Brand List (Main View)
      </div>

      {isLoading ? (
        <BrandTableSkeleton />
      ) : isError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-5 py-10 text-center">
          <p className="text-sm font-semibold text-red-800">
            Brand stock could not be loaded.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => refetch()}
          >
            Try again
          </Button>
        </div>
      ) : brands.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-gray-50/50 py-20">
          <Tag className="mb-3 text-gray-300" size={48} />
          <p className="text-lg font-medium text-gray-500">
            No brand stock data available
          </p>
          <p className="mt-1 text-sm text-gray-400">
            {debouncedSearch || categoryId
              ? "Try adjusting your filters"
              : "Configure brand products to see their stock here"}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow
                  key={headerGroup.id}
                  className="border-b border-gray-200 bg-gray-50"
                >
                  {headerGroup.headers.map((header) => (
                    <TableHead
                      key={header.id}
                      className="h-auto py-2.5 text-[11px] font-semibold uppercase tracking-wider text-gray-500"
                      style={{ width: header.getSize() }}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="transition-colors hover:bg-gray-50/50"
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="py-2.5">
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {distributionGroups.length > 0 && (
        <div className="mt-6">
          <div className="mb-3 text-xs font-bold uppercase tracking-wider text-gray-600">
            📉 Stock Distribution
          </div>
          <div className="rounded-lg border border-gray-200 bg-white px-5">
            {distributionGroups.map((group, groupIndex) => (
              <div
                key={group.key}
                className={`py-5 ${groupIndex > 0 ? "border-t border-gray-100" : ""}`}
              >
                {distributionGroups.length > 1 && (
                  <div className="mb-3 text-xs font-semibold text-gray-500">
                    {group.productTypeName} ·{" "}
                    {formatUnit(group.inventoryUnit, group.totalOnHand)}
                  </div>
                )}
                <div className="space-y-3">
                  {group.brands.map((brandItem, index) => {
                    const percentage =
                      group.totalOnHand > 0
                        ? (brandItem.onHand / group.totalOnHand) * 100
                        : 0;
                    return (
                      <div
                        key={brandItem.brandId}
                        className="flex items-center gap-3"
                      >
                        <span className="w-28 shrink-0 truncate text-sm font-medium text-gray-700">
                          {brandItem.brandName}
                        </span>
                        <div className="h-5 flex-1 overflow-hidden rounded-full bg-gray-100">
                          <div
                            className={`h-full rounded-full transition-[width] duration-200 ${DISTRIBUTION_COLORS[index % DISTRIBUTION_COLORS.length]}`}
                            style={{ width: `${Math.max(percentage, 2)}%` }}
                          />
                        </div>
                        <span className="w-12 text-right text-sm font-bold tabular-nums text-gray-900">
                          {Math.round(percentage)}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
