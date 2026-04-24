"use client";

import { useQuery } from "@tanstack/react-query";
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  getExpandedRowModel,
  type SortingState,
  type ExpandedState,
  useReactTable,
} from "@tanstack/react-table";
import {
  AlertTriangle,
  ArrowUpDown,
  BarChart3,
  Box,
  BoxesIcon,
  ChevronDown,
  ChevronRight,
  Download,
  Layers,
  Package,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  TrendingUp,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useMemo, useState, Fragment } from "react";
import { orpc } from "@/utils/orpc";
import { toast } from "sonner";
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

type CartonBreakdownItem = {
  configLabel: string;
  unitsPerCarton: number;
  cartonCount: number;
  totalUnits: number;
};

type UnitCartonItem = {
  inventoryId: number;
  variantId: number;
  productId: number;
  productName: string;
  productImage: string;
  coreProductId: number | null;
  coreProductName: string;
  categoryId: number | null;
  categoryName: string;
  brandName: string;
  variantLabel: string;
  unitLabel: string;
  sku: string;
  color: string;
  size: string;
  packType: string;
  weightKg: number;
  totalUnits: number;
  looseUnits: number;
  inCartonUnits: number;
  reservedUnits: number;
  availableUnits: number;
  activeCartonCount: number;
  cartonBreakdown: CartonBreakdownItem[];
};

// ─── Summary Card ──────────────────────────────────────────────

function SummaryCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  color: "amber" | "blue" | "emerald" | "purple";
}) {
  const styles = {
    amber: {
      bg: "bg-amber-50/60 border-amber-200",
      icon: "bg-amber-100 text-amber-600",
      val: "text-amber-700",
    },
    blue: {
      bg: "bg-blue-50/60 border-blue-200",
      icon: "bg-blue-100 text-blue-600",
      val: "text-blue-700",
    },
    emerald: {
      bg: "bg-emerald-50/60 border-emerald-200",
      icon: "bg-emerald-100 text-emerald-600",
      val: "text-emerald-700",
    },
    purple: {
      bg: "bg-purple-50/60 border-purple-200",
      icon: "bg-purple-100 text-purple-600",
      val: "text-purple-700",
    },
  };
  const s = styles[color];

  return (
    <div className={`border rounded-xl p-4 transition-shadow hover:shadow-sm ${s.bg}`}>
      <div className="flex items-center gap-3">
        <div className={`p-2.5 rounded-lg ${s.icon}`}>
          <Icon size={20} />
        </div>
        <div className="min-w-0">
          <div className={`text-2xl font-bold tabular-nums ${s.val}`}>{value}</div>
          <div className="text-xs font-medium text-gray-500">{label}</div>
        </div>
      </div>
    </div>
  );
}

// ─── Expanded Detail Panel ─────────────────────────────────────

function ExpandedDetail({ item }: { item: UnitCartonItem }) {
  const hasBreakdown = item.cartonBreakdown.length > 0;

  // Efficiency calculations
  const packingEff = item.totalUnits > 0
    ? Math.round((item.inCartonUnits / item.totalUnits) * 100)
    : 0;
  const looseRatio = item.totalUnits > 0
    ? Math.round((item.looseUnits / item.totalUnits) * 100)
    : 0;
  const reservedRatio = item.totalUnits > 0
    ? Math.round((item.reservedUnits / item.totalUnits) * 100)
    : 0;

  return (
    <div className="px-6 py-5 bg-gradient-to-b from-gray-50/80 to-white space-y-5">
      {/* Unit Summary Mini Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white border rounded-lg p-3 text-center">
          <p className="text-lg font-bold text-gray-900">{Math.round(item.totalUnits).toLocaleString()}</p>
          <p className="text-[11px] text-gray-500">📦 Total Units</p>
        </div>
        <div className="bg-white border rounded-lg p-3 text-center">
          <p className="text-lg font-bold text-blue-600">{Math.round(item.looseUnits).toLocaleString()}</p>
          <p className="text-[11px] text-gray-500">📦 Loose Stock</p>
        </div>
        <div className="bg-white border rounded-lg p-3 text-center">
          <p className="text-lg font-bold text-emerald-600">{Math.round(item.inCartonUnits).toLocaleString()}</p>
          <p className="text-[11px] text-gray-500">📦 In Carton</p>
        </div>
        <div className="bg-white border rounded-lg p-3 text-center">
          <p className="text-lg font-bold text-purple-600">{Math.round(item.reservedUnits).toLocaleString()}</p>
          <p className="text-[11px] text-gray-500">🔒 Reserved</p>
        </div>
      </div>

      {/* Carton Breakdown Table */}
      {hasBreakdown ? (
        <div>
          <p className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">
            📦 Carton Breakdown
          </p>
          <div className="bg-white border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                  <th className="text-left px-4 py-2">Config</th>
                  <th className="text-center px-4 py-2">Units/Carton</th>
                  <th className="text-center px-4 py-2">Total Cartons</th>
                  <th className="text-center px-4 py-2">Total Units</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {item.cartonBreakdown.map((cb, idx) => (
                  <tr key={idx} className="hover:bg-gray-50/50">
                    <td className="px-4 py-2 font-medium text-gray-800">{cb.configLabel}</td>
                    <td className="px-4 py-2 text-center text-gray-600">{cb.unitsPerCarton} {item.unitLabel}</td>
                    <td className="px-4 py-2 text-center font-semibold text-gray-900">{cb.cartonCount}</td>
                    <td className="px-4 py-2 text-center font-semibold text-emerald-600">{Math.round(cb.totalUnits).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t bg-gray-50">
                  <td colSpan={2} className="px-4 py-2 text-xs font-bold text-gray-600">
                    ✔ Total Units in Carton
                  </td>
                  <td className="px-4 py-2 text-center font-bold text-gray-900">
                    {item.cartonBreakdown.reduce((s, c) => s + c.cartonCount, 0)}
                  </td>
                  <td className="px-4 py-2 text-center font-bold text-emerald-600">
                    {Math.round(item.inCartonUnits).toLocaleString()} {item.unitLabel}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-700 flex items-center gap-2">
          <AlertTriangle size={16} />
          No cartons created for this product yet.
        </div>
      )}

      {/* Loose Stock Info */}
      {item.looseUnits > 0 && (
        <div>
          <p className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">
            📦 Loose Stock
          </p>
          <div className="bg-white border rounded-lg p-3">
            <p className="text-sm text-gray-700">
              Loose Units → <span className="font-bold text-gray-900">{Math.round(item.looseUnits).toLocaleString()} {item.unitLabel}</span>
            </p>
          </div>
        </div>
      )}

      {/* Stock Flow Analytics */}
      {item.totalUnits > 0 && (
        <div>
          <p className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">
            📊 Stock Flow Analytics
          </p>
          <div className="bg-white border rounded-lg p-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-[11px] text-gray-400 uppercase">Total Units</p>
                <p className="font-bold text-gray-900">{Math.round(item.totalUnits).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-[11px] text-gray-400 uppercase">In Carton</p>
                <p className="font-bold text-emerald-600">{Math.round(item.inCartonUnits).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-[11px] text-gray-400 uppercase">Remaining Loose</p>
                <p className="font-bold text-blue-600">{Math.round(item.looseUnits).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-[11px] text-gray-400 uppercase">Reserved</p>
                <p className="font-bold text-purple-600">{Math.round(item.reservedUnits).toLocaleString()}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Efficiency Insight */}
      {item.totalUnits > 0 && (
        <div>
          <p className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">
            📉 Efficiency Insight
          </p>
          <div className="bg-white border rounded-lg p-3 space-y-3">
            {/* Packing Efficiency */}
            <div>
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="text-gray-600">Packing Efficiency</span>
                <span className="font-bold text-emerald-600">{packingEff}%</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all"
                  style={{ width: `${packingEff}%` }}
                />
              </div>
            </div>
            {/* Loose Ratio */}
            <div>
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="text-gray-600">Loose Ratio</span>
                <span className={`font-bold ${looseRatio > 60 ? "text-amber-600" : "text-blue-600"}`}>{looseRatio}%</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${looseRatio > 60 ? "bg-amber-500" : "bg-blue-500"}`}
                  style={{ width: `${looseRatio}%` }}
                />
              </div>
            </div>
            {/* Reserved */}
            <div>
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="text-gray-600">Reserved</span>
                <span className="font-bold text-purple-600">{reservedRatio}%</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-purple-500 rounded-full transition-all"
                  style={{ width: `${reservedRatio}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Action Panel */}
      <div>
        <p className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">
          ⚙ Action Panel
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="text-xs gap-1.5"
            onClick={() => toast.info("Create Carton — coming soon")}
          >
            📦 Create Carton
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-xs gap-1.5"
            onClick={() => toast.info("Break Carton — coming soon")}
          >
            📤 Break Carton
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-xs gap-1.5"
            onClick={() => toast.info("Move to Carton — coming soon")}
          >
            🔁 Move to Carton
          </Button>
          <Link href="/warehouse/dashboard/stock-adjustment">
            <Button variant="outline" size="sm" className="text-xs gap-1.5">
              <SlidersHorizontal size={14} /> Adjust Stock
            </Button>
          </Link>
          <Link href={`/warehouse/dashboard/stock/${item.productId}`}>
            <Button variant="outline" size="sm" className="text-xs gap-1.5">
              <BarChart3 size={14} /> View Details
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────

export default function UnitCartonPage() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [categoryId, setCategoryId] = useState<number | undefined>(undefined);
  const [viewMode, setViewMode] = useState<"all" | "loose" | "in_carton">("all");
  const [page, setPage] = useState(1);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [expanded, setExpanded] = useState<ExpandedState>({});
  const pageSize = 20;

  const { data: catData } = useQuery({
    queryKey: ["stockOverview", "categories", "warehouse"],
    queryFn: () =>
      orpc.stockOverview.getStockCategories.call({ ownerType: "warehouse" }),
  });

  const { data, isLoading } = useQuery({
    queryKey: [
      "warehouse",
      "getUnitCartonInventory",
      categoryId,
      viewMode,
      debouncedSearch,
      page,
    ],
    queryFn: () =>
      orpc.warehouse.getUnitCartonInventory.call({
        categoryId,
        viewMode,
        search: debouncedSearch || undefined,
        page,
        pageSize,
      }),
  });

  const categories = catData?.categories ?? [];
  const items: UnitCartonItem[] = (data as any)?.items ?? [];
  const summary = (data as any)?.summary ?? { totalUnits: 0, looseUnits: 0, inCartonUnits: 0 };
  const totalCount = (data as any)?.totalCount ?? 0;
  const totalPages = (data as any)?.totalPages ?? 1;

  const packingEfficiency = summary.totalUnits > 0
    ? Math.round((summary.inCartonUnits / summary.totalUnits) * 100)
    : 0;

  // ─── Alert flags ────────────────────────────────────────────
  const looseRatio = summary.totalUnits > 0
    ? Math.round((summary.looseUnits / summary.totalUnits) * 100)
    : 0;
  const showLooseAlert = looseRatio > 60 && summary.totalUnits > 0;

  // ─── Columns ────────────────────────────────────────────────

  const columns = useMemo<ColumnDef<UnitCartonItem>[]>(
    () => [
      {
        id: "expander",
        header: () => <span className="w-6" />,
        cell: ({ row }) => (
          <button
            onClick={() => row.toggleExpanded()}
            className="p-0.5 hover:bg-gray-100 rounded transition-colors"
          >
            {row.getIsExpanded() ? (
              <ChevronDown size={14} className="text-gray-500" />
            ) : (
              <ChevronRight size={14} className="text-gray-400" />
            )}
          </button>
        ),
        size: 36,
      },
      {
        id: "productName",
        accessorKey: "productName",
        header: ({ column }) => (
          <button
            className="flex items-center gap-1 hover:text-gray-900 transition-colors"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Product
            <ArrowUpDown size={12} />
          </button>
        ),
        cell: ({ row }) => {
          const item = row.original;
          return (
            <div className="flex items-center gap-2.5">
              <div className="shrink-0 w-8 h-8 rounded-md bg-gray-100 flex items-center justify-center overflow-hidden">
                {item.productImage ? (
                  <Image
                    src={item.productImage}
                    alt={item.productName}
                    width={32}
                    height={32}
                    className="w-8 h-8 object-cover"
                    unoptimized={item.productImage.startsWith("http")}
                  />
                ) : (
                  <Package size={14} className="text-gray-400" />
                )}
              </div>
              <span className="text-sm font-semibold text-gray-900 truncate">
                {item.productName}
              </span>
            </div>
          );
        },
        size: 200,
      },
      {
        id: "variant",
        accessorKey: "variantLabel",
        header: "Variant",
        cell: ({ row }) => (
          <span className="text-sm text-gray-600">{row.original.variantLabel}</span>
        ),
        size: 180,
      },
      {
        id: "totalUnits",
        accessorKey: "totalUnits",
        header: ({ column }) => (
          <button
            className="flex items-center gap-1 hover:text-gray-900 transition-colors"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Total
            <ArrowUpDown size={12} />
          </button>
        ),
        cell: ({ row }) => (
          <span className="text-sm font-bold text-gray-900 tabular-nums">
            {Math.round(row.original.totalUnits).toLocaleString()}
          </span>
        ),
        size: 90,
      },
      {
        id: "looseUnits",
        accessorKey: "looseUnits",
        header: "Loose",
        cell: ({ row }) => (
          <span className="text-sm font-semibold text-blue-600 tabular-nums">
            {Math.round(row.original.looseUnits).toLocaleString()}
          </span>
        ),
        size: 90,
      },
      {
        id: "inCartonUnits",
        accessorKey: "inCartonUnits",
        header: "In Carton",
        cell: ({ row }) => (
          <span className="text-sm font-semibold text-emerald-600 tabular-nums">
            {Math.round(row.original.inCartonUnits).toLocaleString()}
          </span>
        ),
        size: 90,
      },
      {
        id: "availableUnits",
        accessorKey: "availableUnits",
        header: "Available",
        cell: ({ row }) => (
          <span className="text-sm font-medium text-gray-700 tabular-nums">
            {Math.round(row.original.availableUnits).toLocaleString()}
          </span>
        ),
        size: 90,
      },
    ],
    [],
  );

  const table = useReactTable({
    data: items,
    columns,
    state: { sorting, expanded },
    onSortingChange: setSorting,
    onExpandedChange: setExpanded,
    getRowId: (row) => `${row.variantId}`,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
  });

  return (
    <div className="space-y-5">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <BoxesIcon className="text-amber-600" size={22} />
            Unit / Carton Inventory
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            👉 View unit-level stock including carton allocation
          </p>
        </div>
        <Button variant="outline" size="sm" className="text-xs gap-1.5">
          <Download size={14} /> Export
        </Button>
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Search Product / SKU..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              clearTimeout((window as any).__unitSearchTimer);
              (window as any).__unitSearchTimer = setTimeout(() => {
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
                {cat.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={viewMode}
          onValueChange={(v) => {
            setViewMode(v as "all" | "loose" | "in_carton");
            setPage(1);
          }}
        >
          <SelectTrigger className="w-44 h-9 text-sm">
            <SelectValue placeholder="All" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="loose">Loose Only</SelectItem>
            <SelectItem value="in_carton">In Carton Only</SelectItem>
          </SelectContent>
        </Select>

        <p className="text-xs text-muted-foreground ml-auto">
          <span className="font-semibold text-foreground">{totalCount}</span> items
        </p>
      </div>

      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard
          label="Total Units"
          value={Math.round(summary.totalUnits).toLocaleString()}
          icon={BoxesIcon}
          color="amber"
        />
        <SummaryCard
          label="Loose Stock"
          value={Math.round(summary.looseUnits).toLocaleString()}
          icon={Layers}
          color="blue"
        />
        <SummaryCard
          label="In Carton"
          value={Math.round(summary.inCartonUnits).toLocaleString()}
          icon={Box}
          color="emerald"
        />
        <SummaryCard
          label="Packing Efficiency"
          value={`${packingEfficiency}%`}
          icon={TrendingUp}
          color="purple"
        />
      </div>

      {/* ── Alert Panel ── */}
      {(showLooseAlert || (packingEfficiency < 30 && summary.totalUnits > 0)) && (
        <div className="space-y-2">
          {showLooseAlert && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-2.5 text-sm text-amber-700">
              <AlertTriangle size={16} className="shrink-0" />
              <span>
                ⚠ <span className="font-semibold">{looseRatio}%</span> of your stock is loose — consider converting to cartons for better packing efficiency.
              </span>
            </div>
          )}
          {packingEfficiency < 30 && summary.totalUnits > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-2.5 text-sm text-red-700">
              <AlertTriangle size={16} className="shrink-0" />
              <span>
                🔴 Carton shortage — only <span className="font-semibold">{packingEfficiency}%</span> of stock is packed. Packing action needed.
              </span>
            </div>
          )}
        </div>
      )}

      {/* ── Table ── */}
      <div className="text-xs font-bold text-gray-600 uppercase tracking-wider">
        📋 Product Level View
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 border rounded-lg bg-gray-50/50">
          <div className="w-8 h-8 border-3 border-amber-200 border-t-amber-600 rounded-full animate-spin mb-4" />
          <p className="text-sm text-muted-foreground">Loading unit/carton data…</p>
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 border border-dashed rounded-lg bg-gray-50/50">
          <BoxesIcon className="text-gray-300 mb-3" size={48} />
          <p className="text-gray-500 text-lg font-medium">No product unit data available</p>
          <p className="text-sm text-gray-400 mt-1">
            {debouncedSearch || categoryId || viewMode !== "all"
              ? "Try adjusting your filters"
              : "Add products to your inventory to see unit data"}
          </p>
          {!debouncedSearch && !categoryId && viewMode === "all" && (
            <Link href="/warehouse/dashboard/catalog">
              <Button className="mt-4 bg-amber-600 hover:bg-amber-700 text-sm">
                Add Products
              </Button>
            </Link>
          )}
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
                <Fragment key={row.id}>
                  <TableRow
                    className={`transition-colors cursor-pointer ${
                      row.getIsExpanded()
                        ? "bg-amber-50/40"
                        : "hover:bg-gray-50/50"
                    }`}
                    onClick={() => row.toggleExpanded()}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className="py-2.5">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                  {row.getIsExpanded() && (
                    <TableRow>
                      <TableCell colSpan={columns.length} className="p-0 border-b-2 border-amber-200">
                        <ExpandedDetail item={row.original} />
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              ))}
            </TableBody>
          </Table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50/50">
              <p className="text-xs text-gray-500">
                Showing{" "}
                <span className="font-medium text-gray-900">
                  {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, totalCount)}
                </span>{" "}
                of <span className="font-medium text-gray-900">{totalCount}</span>
              </p>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" onClick={() => setPage(1)} disabled={page === 1} className="h-7 w-7 p-0 text-xs">«</Button>
                <Button variant="outline" size="sm" onClick={() => setPage(page - 1)} disabled={page === 1} className="h-7 w-7 p-0 text-xs">‹</Button>
                <span className="text-xs font-medium text-gray-600 px-2">Page {page} of {totalPages}</span>
                <Button variant="outline" size="sm" onClick={() => setPage(page + 1)} disabled={page === totalPages} className="h-7 w-7 p-0 text-xs">›</Button>
                <Button variant="outline" size="sm" onClick={() => setPage(totalPages)} disabled={page === totalPages} className="h-7 w-7 p-0 text-xs">»</Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
