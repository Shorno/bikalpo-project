"use client";

import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Clock,
  Download,
  Filter,
  Package,
  Percent,
  Search,
  ShieldAlert,
  SlidersHorizontal,
  Trash2,
  TrendingDown,
  Undo2,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Fragment, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

type ExpiryItem = {
  stockEntryId: number;
  batchNo: string;
  expiryDate: string;
  manufactureDate: string | null;
  quantity: string;
  quantityUnit: string;
  convertedQtyPacks: string;
  purchasePrice: string;
  totalCost: string;
  entryType: string;
  reference: string | null;
  note: string | null;
  shelfRack: string | null;
  createdAt: string;
  productId: number;
  productName: string;
  productImage: string;
  coreProductName: string;
  coreProductImage: string;
  categoryId: number;
  categoryName: string;
  variantId: number;
  variantLabel: string;
  brandName: string;
  supplierId: number;
  supplierName: string;
  storageAreaName: string | null;
  expiryStatus: "expired" | "nearExpiry" | "safe";
  daysUntilExpiry: number;
  lossValue: string;
};

type FilterOption = { id: number; name: string };

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  color,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  color: "red" | "amber" | "emerald" | "blue";
}) {
  const palette = {
    red: {
      bg: "bg-red-50/60 border-red-200",
      icon: "bg-red-100 text-red-600",
      value: "text-red-700",
      label: "text-red-500",
    },
    amber: {
      bg: "bg-amber-50/60 border-amber-200",
      icon: "bg-amber-100 text-amber-600",
      value: "text-amber-700",
      label: "text-amber-500",
    },
    emerald: {
      bg: "bg-emerald-50/60 border-emerald-200",
      icon: "bg-emerald-100 text-emerald-600",
      value: "text-emerald-700",
      label: "text-emerald-500",
    },
    blue: {
      bg: "bg-blue-50/60 border-blue-200",
      icon: "bg-blue-100 text-blue-600",
      value: "text-blue-700",
      label: "text-blue-500",
    },
  }[color];

  return (
    <div className={`border rounded-xl p-4 ${palette.bg}`}>
      <div className="flex items-center gap-3">
        <div className={`rounded-lg p-2 ${palette.icon}`}>
          <Icon size={18} />
        </div>
        <div>
          <div className={`text-2xl font-bold ${palette.value}`}>{value}</div>
          <div className={`text-xs font-medium ${palette.label}`}>{label}</div>
          {sub && (
            <div className={`mt-0.5 text-[10px] ${palette.label}`}>{sub}</div>
          )}
        </div>
      </div>
    </div>
  );
}

function ExpiryStatusBadge({ status, days }: { status: string; days: number }) {
  if (status === "expired") {
    return (
      <Badge className="gap-1 border-red-200 bg-red-100 text-xs text-red-700">
        🔴 Expired {Math.abs(days)}d ago
      </Badge>
    );
  }

  if (status === "nearExpiry") {
    return (
      <Badge className="gap-1 border-amber-200 bg-amber-100 text-xs text-amber-700">
        ⚠ {days}d left
      </Badge>
    );
  }

  return (
    <Badge variant="secondary" className="text-xs">
      Safe
    </Badge>
  );
}

function BatchDetail({ item }: { item: ExpiryItem }) {
  return (
    <div className="border-t border-dashed bg-gray-50/80">
      <div className="grid grid-cols-2 gap-4 px-6 py-4 text-sm md:grid-cols-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Batch ID
          </p>
          <p className="font-medium">{item.batchNo}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Expiry Date
          </p>
          <p className="font-medium">
            {new Date(item.expiryDate).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </p>
        </div>
        {item.manufactureDate && (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Manufacture Date
            </p>
            <p className="font-medium">
              {new Date(item.manufactureDate).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </p>
          </div>
        )}
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Total Qty
          </p>
          <p className="font-medium">
            {Number(item.quantity).toLocaleString()} {item.quantityUnit}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Supplier
          </p>
          <p className="font-medium">{item.supplierName}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Purchase Price
          </p>
          <p className="font-medium">
            ৳{Number(item.purchasePrice).toLocaleString()}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Total Cost / Loss
          </p>
          <p
            className={`font-bold ${item.expiryStatus === "expired" ? "text-red-600" : ""}`}
          >
            ৳{Number(item.totalCost).toLocaleString()}
          </p>
        </div>
        {item.storageAreaName && (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Storage
            </p>
            <p className="font-medium">
              {item.storageAreaName}
              {item.shelfRack ? ` · ${item.shelfRack}` : ""}
            </p>
          </div>
        )}
        {item.reference && (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Reference
            </p>
            <p className="font-medium">{item.reference}</p>
          </div>
        )}
        {item.note && (
          <div className="col-span-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Note
            </p>
            <p className="text-muted-foreground">{item.note}</p>
          </div>
        )}
      </div>

      <div className="border-t border-dashed border-gray-200 bg-white/60 px-6 py-3">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Actions
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            asChild
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 border-red-200 text-xs text-red-600 hover:bg-red-50 hover:text-red-700"
          >
            <Link
              href={`/warehouse/dashboard/damage/create?type=expired&stockEntryId=${item.stockEntryId}`}
              onClick={(event) => event.stopPropagation()}
            >
              <X size={13} /> Mark as Damaged
            </Link>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 border-blue-200 text-xs text-blue-600 hover:bg-blue-50 hover:text-blue-700"
            onClick={(event) => {
              event.stopPropagation();
              toast.info(`Return to Supplier - ${item.supplierName}`, {
                description: "This action will be available soon",
              });
            }}
          >
            <Undo2 size={13} /> Return to Supplier
          </Button>
          {item.expiryStatus === "nearExpiry" && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 border-amber-200 text-xs text-amber-600 hover:bg-amber-50 hover:text-amber-700"
              onClick={(event) => {
                event.stopPropagation();
                toast.info(`Apply Discount - ${item.coreProductName}`, {
                  description: "Discount workflow coming soon",
                });
              }}
            >
              <Percent size={13} /> Apply Discount
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={(event) => {
              event.stopPropagation();
              toast.info(`Adjust Stock - Batch ${item.batchNo}`, {
                description: "Stock adjustment coming soon",
              });
            }}
          >
            <SlidersHorizontal size={13} /> Adjust Stock
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function ExpiredProductsPage() {
  const [statusFilter, setStatusFilter] = useState<
    "all" | "expired" | "nearExpiry" | "tracked"
  >("all");
  const [categoryId, setCategoryId] = useState<number | undefined>();
  const [supplierId, setSupplierId] = useState<number | undefined>();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const handleSearch = (value: string) => {
    setSearch(value);
    clearTimeout(
      (window as { __expirySearchTimer?: ReturnType<typeof setTimeout> })
        .__expirySearchTimer,
    );
    (
      window as { __expirySearchTimer?: ReturnType<typeof setTimeout> }
    ).__expirySearchTimer = setTimeout(() => {
      setDebouncedSearch(value);
    }, 400);
  };

  const { data, isLoading, isError } = useQuery({
    queryKey: [
      "warehouse",
      "getExpiredProducts",
      { status: statusFilter, categoryId, supplierId, search: debouncedSearch },
    ],
    queryFn: () =>
      (orpc.warehouse as any).getExpiredProducts.call({
        status: statusFilter,
        categoryId,
        supplierId,
        search: debouncedSearch || undefined,
      }),
  });

  const items: ExpiryItem[] = data?.items ?? [];
  const stats = data?.stats ?? {
    totalTrackedBatches: 0,
    totalExpiredBatches: 0,
    totalNearExpiryBatches: 0,
    totalExpiredQty: 0,
    totalNearExpiryQty: 0,
    totalLossValue: 0,
  };
  const categoryAnalytics: Array<{
    name: string;
    expiredQty: number;
    nearExpiryQty: number;
    lossValue: number;
  }> = data?.categoryAnalytics ?? [];
  const alerts = data?.alerts ?? { expired: [], nearExpiry: [] };
  const filterOptions = data?.filterOptions ?? {
    categories: [],
    suppliers: [],
  };

  const hasActiveFilters = Boolean(
    categoryId || supplierId || debouncedSearch || statusFilter !== "all",
  );
  const clearFilters = () => {
    setCategoryId(undefined);
    setSupplierId(undefined);
    setSearch("");
    setDebouncedSearch("");
    setStatusFilter("all");
  };

  const toggleSelect = (id: number) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === items.length) {
      setSelectedIds(new Set());
      return;
    }

    setSelectedIds(new Set(items.map((item) => item.stockEntryId)));
  };

  const clearSelection = () => setSelectedIds(new Set());
  const selectedCount = selectedIds.size;
  const isAllSelected = items.length > 0 && selectedIds.size === items.length;
  const hasAlerts = alerts.expired.length > 0 || alerts.nearExpiry.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="flex items-center gap-3 text-2xl font-bold text-foreground">
            <div className="rounded-xl bg-red-100 p-2">
              <ShieldAlert className="text-red-600" size={22} />
            </div>
            Expired Products
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Track expired and near-expiry stock batches for products with expiry
            tracking enabled
          </p>
        </div>
        <div className="relative">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            placeholder="Search product, batch..."
            value={search}
            onChange={(event) => handleSearch(event.target.value)}
            className="w-64 pl-10"
          />
        </div>
      </div>

      {hasAlerts && (
        <div className="overflow-hidden rounded-xl border border-red-200 bg-red-50/40">
          <div className="flex items-center gap-2 border-b border-red-200 bg-red-100/50 px-5 py-3">
            <AlertTriangle className="text-red-600" size={16} />
            <span className="text-sm font-bold text-red-700">
              Expiry Alerts
            </span>
          </div>
          <div className="space-y-2 px-5 py-3">
            {alerts.expired.map((alert: any, index: number) => (
              <div
                key={`expired-${index}`}
                className="flex items-center gap-2 text-sm"
              >
                <span className="text-red-500">🔴</span>
                <span className="font-medium text-red-800">
                  {alert.productName}
                </span>
                <span className="text-red-600">
                  {`-> ${Number(alert.quantity).toLocaleString()} ${alert.quantityUnit} expired ${alert.daysExpired}d ago`}
                </span>
                <span className="ml-auto text-xs font-semibold text-red-500">
                  Loss ৳{Number(alert.lossValue).toLocaleString()}
                </span>
              </div>
            ))}
            {alerts.nearExpiry.map((alert: any, index: number) => (
              <div
                key={`near-${index}`}
                className="flex items-center gap-2 text-sm"
              >
                <span className="text-amber-500">⚠</span>
                <span className="font-medium text-amber-800">
                  {alert.productName}
                </span>
                <span className="text-amber-600">
                  {`-> Expiring in ${alert.daysUntilExpiry}d - ${Number(alert.quantity).toLocaleString()} ${alert.quantityUnit}`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Expired Batches"
          value={stats.totalExpiredBatches}
          sub={`${Number(stats.totalExpiredQty).toLocaleString()} units`}
          icon={ShieldAlert}
          color="red"
        />
        <StatCard
          label="Near Expiry"
          value={stats.totalNearExpiryBatches}
          sub={`${Number(stats.totalNearExpiryQty).toLocaleString()} units`}
          icon={Clock}
          color="amber"
        />
        <StatCard
          label="Total Loss Value"
          value={`৳${Number(stats.totalLossValue).toLocaleString()}`}
          icon={TrendingDown}
          color="red"
        />
        <StatCard
          label="Total Tracked"
          value={stats.totalTrackedBatches}
          sub="batches with expiry"
          icon={Package}
          color="blue"
        />
      </div>

      <div className="rounded-lg border bg-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter size={14} className="text-muted-foreground" />
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Filter By
            </span>
          </div>
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="h-7 gap-1 text-xs"
            >
              <X size={12} /> Clear
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="space-y-1">
            <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Expiry Status
            </Label>
            <Select
              value={statusFilter}
              onValueChange={(value) =>
                setStatusFilter(
                  value as "all" | "expired" | "nearExpiry" | "tracked",
                )
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All (Expired + Near)</SelectItem>
                <SelectItem value="tracked">All Tracked Batches</SelectItem>
                <SelectItem value="expired">Expired Only</SelectItem>
                <SelectItem value="nearExpiry">Near Expiry Only</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Category
            </Label>
            <Select
              value={categoryId?.toString() ?? "all"}
              onValueChange={(value) =>
                setCategoryId(value === "all" ? undefined : Number(value))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {filterOptions.categories.map((category: FilterOption) => (
                  <SelectItem key={category.id} value={category.id.toString()}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Supplier
            </Label>
            <Select
              value={supplierId?.toString() ?? "all"}
              onValueChange={(value) =>
                setSupplierId(value === "all" ? undefined : Number(value))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Suppliers</SelectItem>
                {filterOptions.suppliers.map((supplier: FilterOption) => (
                  <SelectItem key={supplier.id} value={supplier.id.toString()}>
                    {supplier.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center rounded-lg border py-20">
          <div className="mb-4 h-8 w-8 animate-spin rounded-full border-3 border-red-200 border-t-red-600" />
          <p className="text-sm text-muted-foreground">
            Loading expiry data...
          </p>
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-red-200 bg-red-50/50 py-20">
          <AlertTriangle className="mb-4 text-red-400" size={40} />
          <p className="font-semibold text-red-600">
            Failed to load expiry data
          </p>
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-emerald-50/30 py-20">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
            <span className="text-3xl">✅</span>
          </div>
          <p className="text-lg font-semibold text-emerald-700">
            No expired products found
          </p>
          <p className="mt-1 text-sm text-emerald-500">
            All stocks are within safe expiry range
          </p>
          {hasActiveFilters && (
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={clearFilters}
            >
              Clear Filters
            </Button>
          )}
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Button asChild size="sm">
              <Link href="/warehouse/dashboard/stock/add">Add dated stock</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/warehouse/dashboard/catalog">
                Configure expiry tracking
              </Link>
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Showing{" "}
            <span className="font-medium text-foreground">{items.length}</span>{" "}
            {items.length === 1 ? "batch" : "batches"}
          </p>

          <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead className="w-[36px] px-2">
                    <Checkbox
                      checked={isAllSelected}
                      onCheckedChange={toggleSelectAll}
                      aria-label="Select all batches"
                    />
                  </TableHead>
                  <TableHead className="w-[30px]" />
                  <TableHead className="text-xs">Product</TableHead>
                  <TableHead className="text-xs">Variant</TableHead>
                  <TableHead className="text-xs">Batch</TableHead>
                  <TableHead className="text-xs">Expiry Date</TableHead>
                  <TableHead className="text-xs">Qty</TableHead>
                  <TableHead className="text-xs">Loss Value</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => {
                  const isExpanded = expandedId === item.stockEntryId;

                  return (
                    <Fragment key={item.stockEntryId}>
                      <TableRow
                        className={`cursor-pointer transition-colors ${isExpanded ? "bg-gray-50" : "hover:bg-gray-50/50"} ${item.expiryStatus === "expired" ? "border-l-2 border-l-red-400" : item.expiryStatus === "nearExpiry" ? "border-l-2 border-l-amber-400" : ""}`}
                        onClick={() =>
                          setExpandedId(isExpanded ? null : item.stockEntryId)
                        }
                      >
                        <TableCell
                          className="w-[36px] px-2"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <Checkbox
                            checked={selectedIds.has(item.stockEntryId)}
                            onCheckedChange={() =>
                              toggleSelect(item.stockEntryId)
                            }
                            aria-label={`Select batch ${item.batchNo}`}
                          />
                        </TableCell>
                        <TableCell className="w-[30px] px-2">
                          {isExpanded ? (
                            <ChevronDown
                              size={14}
                              className="text-muted-foreground"
                            />
                          ) : (
                            <ChevronRight
                              size={14}
                              className="text-muted-foreground"
                            />
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="h-7 w-7 shrink-0 overflow-hidden rounded bg-gray-100">
                              {item.coreProductImage ? (
                                <Image
                                  src={item.coreProductImage}
                                  alt=""
                                  width={28}
                                  height={28}
                                  className="h-full w-full object-cover"
                                  unoptimized={item.coreProductImage.startsWith(
                                    "http",
                                  )}
                                />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center">
                                  <Package className="h-3.5 w-3.5 text-gray-300" />
                                </div>
                              )}
                            </div>
                            <div>
                              <p className="line-clamp-1 text-sm font-medium text-gray-900">
                                {item.coreProductName}
                              </p>
                              <p className="text-[10px] text-muted-foreground">
                                {item.categoryName}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-gray-600">
                          {item.variantLabel}
                        </TableCell>
                        <TableCell>
                          <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs font-mono">
                            {item.batchNo}
                          </code>
                        </TableCell>
                        <TableCell className="text-sm">
                          {new Date(item.expiryDate).toLocaleDateString(
                            "en-GB",
                            { day: "numeric", month: "short", year: "numeric" },
                          )}
                        </TableCell>
                        <TableCell className="text-sm font-medium">
                          {Number(item.quantity).toLocaleString()}{" "}
                          {item.quantityUnit}
                        </TableCell>
                        <TableCell
                          className={`text-sm font-semibold ${item.expiryStatus === "expired" ? "text-red-600" : "text-muted-foreground"}`}
                        >
                          {item.expiryStatus === "expired"
                            ? `৳${Number(item.lossValue).toLocaleString()}`
                            : "—"}
                        </TableCell>
                        <TableCell>
                          <ExpiryStatusBadge
                            status={item.expiryStatus}
                            days={item.daysUntilExpiry}
                          />
                        </TableCell>
                      </TableRow>

                      {isExpanded && (
                        <TableRow>
                          <TableCell colSpan={9} className="p-0">
                            <BatchDetail item={item} />
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {categoryAnalytics.length > 0 && (
            <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
              <div className="border-b bg-gradient-to-r from-gray-50 to-white px-5 py-3">
                <h3 className="text-sm font-bold text-gray-900">
                  Category-wise Expiry Breakdown
                </h3>
              </div>
              <div className="p-5">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {categoryAnalytics.map((category) => (
                    <div
                      key={category.name}
                      className="rounded-lg border bg-gray-50/50 p-3"
                    >
                      <p className="text-sm font-semibold text-gray-800">
                        {category.name}
                      </p>
                      <div className="mt-1.5 flex items-center gap-3">
                        {category.expiredQty > 0 && (
                          <span className="text-xs font-medium text-red-600">
                            🔴 {category.expiredQty.toLocaleString()} expired
                          </span>
                        )}
                        {category.nearExpiryQty > 0 && (
                          <span className="text-xs font-medium text-amber-600">
                            ⚠ {category.nearExpiryQty.toLocaleString()} near
                          </span>
                        )}
                      </div>
                      {category.lossValue > 0 && (
                        <p className="mt-1 text-xs text-red-500">
                          Loss: ৳{category.lossValue.toLocaleString()}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {selectedCount > 0 && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 animate-in slide-in-from-bottom-4 fade-in duration-200">
          <div className="flex items-center gap-4 rounded-xl bg-gray-900 px-5 py-3 text-white shadow-2xl">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20 text-xs font-bold">
                {selectedCount}
              </div>
              <span className="text-sm font-medium">
                {selectedCount === 1 ? "batch" : "batches"} selected
              </span>
            </div>

            <div className="h-6 w-px bg-white/20" />

            <div className="flex items-center gap-2">
              <Button
                asChild
                variant="ghost"
                size="sm"
                className="h-8 gap-1.5 text-xs text-red-300 hover:bg-red-500/20 hover:text-red-200"
              >
                <Link
                  href={`/warehouse/dashboard/damage/create?type=expired&stockEntryIds=${Array.from(selectedIds).join(",")}`}
                >
                  <X size={13} /> Mark Damaged
                </Link>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-1.5 text-xs text-blue-300 hover:bg-blue-500/20 hover:text-blue-200"
                onClick={() => {
                  toast.info(`Return ${selectedCount} batch(es) to supplier`, {
                    description: "Bulk return workflow coming soon",
                  });
                }}
              >
                <Undo2 size={13} /> Bulk Return
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-1.5 text-xs text-emerald-300 hover:bg-emerald-500/20 hover:text-emerald-200"
                onClick={() => {
                  toast.info(`Exporting ${selectedCount} batch(es)`, {
                    description: "Export report coming soon",
                  });
                }}
              >
                <Download size={13} /> Export Report
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-1.5 text-xs text-orange-300 hover:bg-orange-500/20 hover:text-orange-200"
                onClick={() => {
                  toast.info(`Move ${selectedCount} batch(es) to disposal`, {
                    description: "Disposal workflow coming soon",
                  });
                }}
              >
                <Trash2 size={13} /> Move to Disposal
              </Button>
            </div>

            <div className="h-6 w-px bg-white/20" />

            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs text-white/60 hover:bg-white/10 hover:text-white"
              onClick={clearSelection}
            >
              <X size={13} /> Clear
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
