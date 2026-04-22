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
import {
  ArrowUpDown,
  Package,
  Search,
  Tag,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { orpc } from "@/utils/orpc";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ─── Types ─────────────────────────────────────────────────────

type BrandStockItem = {
  brandId: number;
  brandName: string;
  brandLogo: string | null;
  brandSlug: string;
  totalSku: number;
  totalStock: number;
  lowStockCount: number;
};

// ─── Helpers ───────────────────────────────────────────────────



// ─── Main Page ─────────────────────────────────────────────────

export default function BrandStockPage() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [categoryId, setCategoryId] = useState<number | undefined>(undefined);
  const [sorting, setSorting] = useState<SortingState>([]);

  const { data: catData } = useQuery({
    queryKey: ["stockOverview", "categories", "warehouse"],
    queryFn: () =>
      orpc.stockOverview.getStockCategories.call({ ownerType: "warehouse" }),
  });

  const { data, isLoading } = useQuery({
    queryKey: [
      "stockOverview",
      "brandStockOverview",
      "warehouse",
      categoryId,
      debouncedSearch,
    ],
    queryFn: () =>
      (orpc.stockOverview as any).getBrandStockOverview.call({
        ownerType: "warehouse",
        categoryId,
        search: debouncedSearch || undefined,
      }),
  });

  const categories = catData?.categories ?? [];
  const brands: BrandStockItem[] = data?.brands ?? [];

  // ─── Columns ────────────────────────────────────────────────

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
            className="flex items-center gap-1 hover:text-gray-900 transition-colors"
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
              <div className="shrink-0 w-8 h-8 rounded-md bg-gray-100 flex items-center justify-center overflow-hidden">
                {item.brandLogo ? (
                  <Image
                    src={item.brandLogo}
                    alt={item.brandName}
                    width={32}
                    height={32}
                    className="w-8 h-8 object-cover"
                    unoptimized={item.brandLogo.startsWith("http")}
                  />
                ) : (
                  <Tag size={14} className="text-gray-400" />
                )}
              </div>
              <span className="text-sm font-semibold text-gray-900">
                {item.brandName}
              </span>
            </div>
          );
        },
        size: 220,
      },
      {
        id: "totalSku",
        accessorKey: "totalSku",
        header: ({ column }) => (
          <button
            className="flex items-center gap-1 hover:text-gray-900 transition-colors"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Total SKU
            <ArrowUpDown size={12} />
          </button>
        ),
        cell: ({ row }) => (
          <span className="text-sm font-bold text-gray-900 tabular-nums">
            {row.original.totalSku.toLocaleString()}
          </span>
        ),
        size: 100,
      },
      {
        id: "totalStock",
        accessorKey: "totalStock",
        header: ({ column }) => (
          <button
            className="flex items-center gap-1 hover:text-gray-900 transition-colors"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Total Stock
            <ArrowUpDown size={12} />
          </button>
        ),
        cell: ({ row }) => (
          <span className="text-sm font-bold text-gray-900 tabular-nums">
            {row.original.totalStock.toLocaleString()}{" "}
            <span className="text-xs font-normal text-gray-400">KG</span>
          </span>
        ),
        size: 120,
      },
      {
        id: "lowStock",
        accessorKey: "lowStockCount",
        header: ({ column }) => (
          <button
            className="flex items-center gap-1 hover:text-gray-900 transition-colors"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Low Stock
            <ArrowUpDown size={12} />
          </button>
        ),
        cell: ({ row }) => {
          const count = row.original.lowStockCount;
          return (
            <span
              className={`text-sm font-bold tabular-nums ${
                count > 0 ? "text-amber-600" : "text-gray-400"
              }`}
            >
              {count}
            </span>
          );
        },
        size: 100,
      },
      {
        id: "action",
        header: () => <span className="text-center block">Action</span>,
        cell: ({ row }) => (
          <div className="text-center">
            <Link href={`/warehouse/dashboard/stock/brands/${row.original.brandId}`}>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-blue-600 hover:text-blue-800 font-medium"
              >
                View
              </Button>
            </Link>
          </div>
        ),
        size: 70,
      },
    ],
    []
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
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">🏷️ Brand Stock Overview</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          View inventory grouped by Brand
        </p>
      </div>

      {/* 🔍 Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="relative flex-1 max-w-xs">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <Input
            placeholder="Search Brand / Product..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              clearTimeout((window as any).__brandSearchTimer);
              (window as any).__brandSearchTimer = setTimeout(() => {
                setDebouncedSearch(e.target.value);
              }, 300);
            }}
            className="pl-9 h-9 text-sm"
          />
        </div>

        <Select
          value={categoryId ? String(categoryId) : "all"}
          onValueChange={(v) => {
            setCategoryId(v === "all" ? undefined : Number(v));
          }}
        >
          <SelectTrigger className="w-44 h-9 text-sm">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat.id} value={String(cat.id)}>
                {cat.name} ({cat.productCount})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>



        <p className="text-xs text-muted-foreground ml-auto">
          <span className="font-semibold text-foreground">{brands.length}</span>{" "}
          brands
        </p>
      </div>

      {/* 📋 Brand List */}
      <div className="text-xs font-bold text-gray-600 uppercase tracking-wider">
        📋 Brand List (Main View)
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 border rounded-lg bg-gray-50/50">
          <div className="w-8 h-8 border-3 border-amber-200 border-t-amber-600 rounded-full animate-spin mb-4" />
          <p className="text-sm text-muted-foreground">Loading brand data…</p>
        </div>
      ) : brands.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 border border-dashed rounded-lg bg-gray-50/50">
          <Tag className="text-gray-300 mb-3" size={48} />
          <p className="text-gray-500 text-lg font-medium">
            No brand stock data available
          </p>
          <p className="text-sm text-gray-400 mt-1">
            {debouncedSearch || categoryId
              ? "Try adjusting your filters"
              : "Add products to your inventory to see brand stock"}
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((hg) => (
                <TableRow key={hg.id} className="bg-gray-50 border-b border-gray-200">
                  {hg.headers.map((h) => (
                    <TableHead
                      key={h.id}
                      className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider py-2.5 h-auto"
                      style={{ width: h.getSize() }}
                    >
                      {h.isPlaceholder
                        ? null
                        : flexRender(h.column.columnDef.header, h.getContext())}
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
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* 📉 Stock Distribution */}
      {brands.length > 0 && (() => {
        const totalAllStock = brands.reduce((sum, b) => sum + b.totalStock, 0);
        if (totalAllStock <= 0) return null;

        const COLORS = [
          "bg-blue-500",
          "bg-emerald-500",
          "bg-amber-500",
          "bg-violet-500",
          "bg-rose-500",
          "bg-cyan-500",
          "bg-orange-500",
          "bg-indigo-500",
        ];

        return (
          <div className="mt-6">
            <div className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-3">
              📉 Stock Distribution
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-3">
              {brands.map((b, i) => {
                const pct = Math.round((b.totalStock / totalAllStock) * 100);
                const color = COLORS[i % COLORS.length];
                return (
                  <div key={b.brandId} className="flex items-center gap-3">
                    <span className="text-sm font-medium text-gray-700 w-28 shrink-0 truncate">
                      {b.brandName}
                    </span>
                    <div className="flex-1 h-5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${color} rounded-full transition-all duration-500`}
                        style={{ width: `${Math.max(pct, 2)}%` }}
                      />
                    </div>
                    <span className="text-sm font-bold text-gray-900 tabular-nums w-12 text-right">
                      {pct}%
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
