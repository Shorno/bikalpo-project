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
import { ArrowUpDown, BoxesIcon, Package, Search } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
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

// ─── Types ─────────────────────────────────────────────────────

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
  coreProductImage: string;
  typeName?: string | null;
  categoryName: string | null;
  subCategoryName: string | null;
  totalQty: number;
  stdUnit: string;
  variantCount: number;
  productCount: number;
  productIds: number[];
  hasColorSize: boolean;
  breakdown: BreakdownItem[];
  status: "in_stock" | "out_of_stock";
};

// ─── Helpers ───────────────────────────────────────────────────

function normalizeDisplayUnit(unit?: string | null) {
  const normalized = String(unit || "")
    .trim()
    .toUpperCase();
  if (normalized === "PCS" || normalized === "PC" || normalized === "PIECES") {
    return "Pc";
  }
  if (normalized === "PAIR") {
    return "Pair";
  }
  if (normalized === "KG" || normalized === "KGS") {
    return "KG";
  }
  if (normalized === "UNIT") {
    return "Unit";
  }
  if (normalized === "PACK") {
    return "Pack";
  }
  if (normalized === "CARTON") {
    return "Carton";
  }
  return normalized || "Unit";
}

function isFashionItem(item: Pick<StockListItem, "typeName">) {
  return (
    String(item.typeName || "")
      .trim()
      .toLowerCase() === "fashion"
  );
}

function _formatBreakdownText(
  item: Pick<StockListItem, "breakdown" | "stdUnit" | "typeName">,
): string {
  const { breakdown, stdUnit } = item;
  if (breakdown.length === 0) return "—";

  const parts: string[] = [];
  for (const b of breakdown) {
    if (b.packagingType === "loose") {
      parts.push(`${Math.round(b.qty).toLocaleString()} ${stdUnit} Loose`);
    } else {
      parts.push(`${Math.round(b.qty).toLocaleString()} ${b.label}`);
    }
  }
  return parts.join(" + ");
}

function formatStockBreakdownText(
  item: Pick<StockListItem, "breakdown" | "stdUnit" | "typeName">,
): string {
  if (item.breakdown.length === 0) return "—";

  return item.breakdown
    .map((entry) => {
      if (entry.packagingType === "loose") {
        return `${Math.round(entry.qty).toLocaleString()} ${normalizeDisplayUnit(
          item.stdUnit,
        )} Loose`;
      }

      if (isFashionItem(item) && entry.packagingType !== "carton") {
        return `${Math.round(entry.qty).toLocaleString()} Bundle`;
      }

      if (entry.packagingType === "carton") {
        return `${Math.round(entry.qty).toLocaleString()} Carton`;
      }

      return `${Math.round(entry.qty).toLocaleString()} ${entry.label}`;
    })
    .join(" + ");
}

function StatusCell({ totalQty }: { totalQty: number }) {
  if (totalQty <= 0) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-600">
        <span className="w-2 h-2 bg-red-500 rounded-full shrink-0" />
        Out of Stock
      </span>
    );
  }
  if (totalQty <= 50) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-600">
        <span className="w-2 h-2 bg-amber-500 rounded-full shrink-0" />
        Low Stock
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
      <span className="w-2 h-2 bg-emerald-500 rounded-full shrink-0" />
      In Stock
    </span>
  );
}

// ─── Main Page ─────────────────────────────────────────────────

export default function StockListPage() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [categoryId, setCategoryId] = useState<number | undefined>(undefined);
  const [statusFilter, setStatusFilter] = useState<
    "all" | "in_stock" | "out_of_stock"
  >("all");
  const [page, setPage] = useState(1);
  const [sorting, setSorting] = useState<SortingState>([]);
  const pageSize = 20;

  const { data: catData } = useQuery({
    queryKey: ["stockOverview", "categories", "warehouse"],
    queryFn: () =>
      orpc.stockOverview.getStockCategories.call({ ownerType: "warehouse" }),
  });

  const { data, isLoading } = useQuery({
    queryKey: [
      "stockOverview",
      "stockList",
      "warehouse",
      categoryId,
      statusFilter,
      debouncedSearch,
      page,
    ],
    queryFn: () =>
      (orpc.stockOverview as any).getStockList.call({
        ownerType: "warehouse",
        categoryId,
        status: statusFilter,
        search: debouncedSearch || undefined,
        page,
        pageSize,
      }),
  });

  const categories = catData?.categories ?? [];
  const items: StockListItem[] = data?.items ?? [];
  const totalCount = data?.totalCount ?? 0;
  const totalPages = data?.totalPages ?? 1;

  // ─── Columns (doc format) ────────────────────────────────────

  const columns = useMemo<ColumnDef<StockListItem>[]>(
    () => [
      {
        id: "sku",
        accessorKey: "coreProductSku",
        header: "SKU",
        cell: ({ row }) => {
          const sku = row.original.coreProductSku;
          return sku ? (
            <span className="text-xs font-mono text-gray-500 whitespace-nowrap">
              {sku}
            </span>
          ) : (
            <span className="text-xs text-gray-300">—</span>
          );
        },
        size: 110,
      },
      {
        id: "productName",
        accessorKey: "coreProductName",
        header: ({ column }) => (
          <button
            className="flex items-center gap-1 hover:text-gray-900 transition-colors"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Product Name
            <ArrowUpDown size={12} />
          </button>
        ),
        cell: ({ row }) => {
          const item = row.original;
          return (
            <div className="flex items-center gap-2.5">
              <div className="shrink-0 w-8 h-8 rounded-md bg-gray-100 flex items-center justify-center overflow-hidden">
                {item.coreProductImage ? (
                  <Image
                    src={item.coreProductImage}
                    alt={item.coreProductName}
                    width={32}
                    height={32}
                    className="w-8 h-8 object-cover"
                    unoptimized={item.coreProductImage.startsWith("http")}
                  />
                ) : (
                  <Package size={14} className="text-gray-400" />
                )}
              </div>
              <span className="text-sm font-semibold text-gray-900 truncate">
                {item.coreProductName}
              </span>
            </div>
          );
        },
        size: 220,
      },
      {
        id: "totalStock",
        accessorKey: "totalQty",
        header: ({ column }) => (
          <button
            className="flex items-center gap-1 hover:text-gray-900 transition-colors"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Total Stock (Std Unit)
            <ArrowUpDown size={12} />
          </button>
        ),
        cell: ({ row }) => {
          const item = row.original;
          return (
            <span className="text-sm font-bold text-gray-900 tabular-nums whitespace-nowrap">
              {Math.round(item.totalQty).toLocaleString()}{" "}
              <span className="font-medium text-gray-500">
                {normalizeDisplayUnit(item.stdUnit)}
              </span>
            </span>
          );
        },
        size: 160,
      },
      {
        id: "breakdown",
        header: "Stock Breakdown",
        cell: ({ row }) => (
          <span className="text-sm text-gray-700">
            {formatStockBreakdownText(row.original)}
          </span>
        ),
        size: 230,
      },
      {
        id: "status",
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <StatusCell totalQty={row.original.totalQty} />,
        size: 120,
      },
      {
        id: "action",
        header: () => <span className="text-center block">Action</span>,
        cell: ({ row }) => {
          const item = row.original;
          // Build detail URL: use coreProductId if present, else first productId
          const detailId = item.coreProductId
            ? `core-${item.coreProductId}`
            : `product-${item.productIds[0]}`;
          return (
            <div className="text-center">
              <Link href={`/warehouse/dashboard/stock/${detailId}`}>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                >
                  View
                </Button>
              </Link>
            </div>
          );
        },
        size: 70,
      },
    ],
    [],
  );

  const table = useReactTable({
    data: items,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getRowId: (row) => row.groupKey,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">
          📦 Stock (Real-Time)
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Core Identity Level — all brands & variants aggregated
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
            placeholder="SKU / Product Name..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              clearTimeout((window as any).__stockSearchTimer);
              (window as any).__stockSearchTimer = setTimeout(() => {
                setDebouncedSearch(e.target.value);
                setPage(1);
              }, 300);
            }}
            className="pl-9 h-9 text-sm"
          />
        </div>

        <Select
          value={categoryId ? String(categoryId) : "all"}
          onValueChange={(v) => {
            setCategoryId(v === "all" ? undefined : Number(v));
            setPage(1);
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

        <Select
          value={statusFilter}
          onValueChange={(v) => {
            setStatusFilter(v as "all" | "in_stock" | "out_of_stock");
            setPage(1);
          }}
        >
          <SelectTrigger className="w-40 h-9 text-sm">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="in_stock">🟢 In Stock</SelectItem>
            <SelectItem value="out_of_stock">🔴 Out of Stock</SelectItem>
          </SelectContent>
        </Select>

        <p className="text-xs text-muted-foreground ml-auto">
          <span className="font-semibold text-foreground">{totalCount}</span>{" "}
          products
        </p>
      </div>

      {/* 📋 Table */}
      <div className="text-xs font-bold text-gray-600 uppercase tracking-wider">
        📋 Stock List (Core Identity Level 🔥)
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 border rounded-lg bg-gray-50/50">
          <div className="w-8 h-8 border-3 border-amber-200 border-t-amber-600 rounded-full animate-spin mb-4" />
          <p className="text-sm text-muted-foreground">Loading stock data…</p>
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 border border-dashed rounded-lg bg-gray-50/50">
          <BoxesIcon className="text-gray-300 mb-3" size={48} />
          <p className="text-gray-500 text-lg font-medium">No stock found</p>
          <p className="text-sm text-gray-400 mt-1">
            {debouncedSearch || categoryId || statusFilter !== "all"
              ? "Try adjusting your filters"
              : "Add products to your inventory to see stock"}
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((hg) => (
                <TableRow
                  key={hg.id}
                  className="bg-gray-50 border-b border-gray-200"
                >
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
                  className={`transition-colors ${
                    row.original.status === "out_of_stock"
                      ? "opacity-60"
                      : "hover:bg-gray-50/50"
                  }`}
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

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50/50">
              <p className="text-xs text-gray-500">
                Showing{" "}
                <span className="font-medium text-gray-900">
                  {(page - 1) * pageSize + 1}–
                  {Math.min(page * pageSize, totalCount)}
                </span>{" "}
                of{" "}
                <span className="font-medium text-gray-900">{totalCount}</span>
              </p>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(1)}
                  disabled={page === 1}
                  className="h-7 w-7 p-0 text-xs"
                >
                  «
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page - 1)}
                  disabled={page === 1}
                  className="h-7 w-7 p-0 text-xs"
                >
                  ‹
                </Button>
                <span className="text-xs font-medium text-gray-600 px-2">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page + 1)}
                  disabled={page === totalPages}
                  className="h-7 w-7 p-0 text-xs"
                >
                  ›
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(totalPages)}
                  disabled={page === totalPages}
                  className="h-7 w-7 p-0 text-xs"
                >
                  »
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
