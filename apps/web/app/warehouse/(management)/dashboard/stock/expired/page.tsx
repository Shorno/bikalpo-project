"use client";

import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeftRight,
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
import { useMemo, useState } from "react";
import { orpc } from "@/utils/orpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";

// ─── Types ─────────────────────────────────────────────────────

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

// ─── Stat Card ─────────────────────────────────────────────────

function StatCard({
  label, value, sub, icon: Icon, color,
}: {
  label: string; value: string | number; sub?: string;
  icon: React.ElementType;
  color: "red" | "amber" | "emerald" | "blue";
}) {
  const c = {
    red: { bg: "bg-red-50/60 border-red-200", icon: "bg-red-100 text-red-600", val: "text-red-700", lbl: "text-red-500" },
    amber: { bg: "bg-amber-50/60 border-amber-200", icon: "bg-amber-100 text-amber-600", val: "text-amber-700", lbl: "text-amber-500" },
    emerald: { bg: "bg-emerald-50/60 border-emerald-200", icon: "bg-emerald-100 text-emerald-600", val: "text-emerald-700", lbl: "text-emerald-500" },
    blue: { bg: "bg-blue-50/60 border-blue-200", icon: "bg-blue-100 text-blue-600", val: "text-blue-700", lbl: "text-blue-500" },
  }[color];

  return (
    <div className={`border rounded-xl p-4 ${c.bg}`}>
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${c.icon}`}><Icon size={18} /></div>
        <div>
          <div className={`text-2xl font-bold ${c.val}`}>{value}</div>
          <div className={`text-xs font-medium ${c.lbl}`}>{label}</div>
          {sub && <div className={`text-[10px] ${c.lbl} mt-0.5`}>{sub}</div>}
        </div>
      </div>
    </div>
  );
}

// ─── Status Badge ──────────────────────────────────────────────

function ExpiryStatusBadge({ status, days }: { status: string; days: number }) {
  if (status === "expired") {
    return (
      <Badge className="bg-red-100 text-red-700 border-red-200 gap-1 text-xs">
        🔴 Expired {Math.abs(days)}d ago
      </Badge>
    );
  }
  if (status === "nearExpiry") {
    return (
      <Badge className="bg-amber-100 text-amber-700 border-amber-200 gap-1 text-xs">
        ⚠ {days}d left
      </Badge>
    );
  }
  return <Badge variant="secondary" className="text-xs">Safe</Badge>;
}

// ─── Expandable Row Detail ─────────────────────────────────────

function BatchDetail({ item }: { item: ExpiryItem }) {
  return (
    <div className="bg-gray-50/80 border-t border-dashed">
      {/* Detail Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 px-6 py-4 text-sm">
        <div>
          <p className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wider">Batch ID</p>
          <p className="font-medium">{item.batchNo}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wider">Expiry Date</p>
          <p className="font-medium">{new Date(item.expiryDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</p>
        </div>
        {item.manufactureDate && (
          <div>
            <p className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wider">Manufacture Date</p>
            <p className="font-medium">{new Date(item.manufactureDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</p>
          </div>
        )}
        <div>
          <p className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wider">Total Qty</p>
          <p className="font-medium">{Number(item.quantity).toLocaleString()} {item.quantityUnit}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wider">Supplier</p>
          <p className="font-medium">{item.supplierName}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wider">Purchase Price</p>
          <p className="font-medium">৳{Number(item.purchasePrice).toLocaleString()}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wider">Total Cost / Loss</p>
          <p className={`font-bold ${item.expiryStatus === "expired" ? "text-red-600" : ""}`}>
            ৳{Number(item.totalCost).toLocaleString()}
          </p>
        </div>
        {item.storageAreaName && (
          <div>
            <p className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wider">Storage</p>
            <p className="font-medium">{item.storageAreaName}{item.shelfRack ? ` · ${item.shelfRack}` : ""}</p>
          </div>
        )}
        {item.reference && (
          <div>
            <p className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wider">Reference</p>
            <p className="font-medium">{item.reference}</p>
          </div>
        )}
        {item.note && (
          <div className="col-span-2">
            <p className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wider">Note</p>
            <p className="text-muted-foreground">{item.note}</p>
          </div>
        )}
      </div>

      {/* ── Action Panel (per batch) ── */}
      <div className="px-6 py-3 border-t border-dashed border-gray-200 bg-white/60">
        <p className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wider mb-2">Actions</p>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-1.5 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
            onClick={(e) => {
              e.stopPropagation();
              toast.info(`Mark as Damaged — Batch ${item.batchNo}`, { description: "This action will be available soon" });
            }}
          >
            <X size={13} /> Mark as Damaged
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-1.5 border-blue-200 text-blue-600 hover:bg-blue-50 hover:text-blue-700"
            onClick={(e) => {
              e.stopPropagation();
              toast.info(`Return to Supplier — ${item.supplierName}`, { description: "This action will be available soon" });
            }}
          >
            <Undo2 size={13} /> Return to Supplier
          </Button>
          {item.expiryStatus === "nearExpiry" && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs gap-1.5 border-amber-200 text-amber-600 hover:bg-amber-50 hover:text-amber-700"
              onClick={(e) => {
                e.stopPropagation();
                toast.info(`Apply Discount — ${item.coreProductName}`, { description: "Discount workflow coming soon" });
              }}
            >
              <Percent size={13} /> Apply Discount
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-1.5"
            onClick={(e) => {
              e.stopPropagation();
              toast.info(`Adjust Stock — Batch ${item.batchNo}`, { description: "Stock adjustment coming soon" });
            }}
          >
            <SlidersHorizontal size={13} /> Adjust Stock
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────

export default function ExpiredProductsPage() {
  const [statusFilter, setStatusFilter] = useState<"all" | "expired" | "nearExpiry">("all");
  const [categoryId, setCategoryId] = useState<number | undefined>();
  const [supplierId, setSupplierId] = useState<number | undefined>();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const handleSearch = (val: string) => {
    setSearch(val);
    clearTimeout((window as any).__expirySearchTimer);
    (window as any).__expirySearchTimer = setTimeout(() => setDebouncedSearch(val), 400);
  };

  const { data, isLoading, isError } = useQuery({
    queryKey: ["warehouse", "getExpiredProducts", { status: statusFilter, categoryId, supplierId, search: debouncedSearch }],
    queryFn: () =>
      (orpc.warehouse as any).getExpiredProducts.call({
        status: statusFilter,
        categoryId,
        supplierId,
        search: debouncedSearch || undefined,
      }),
  });

  const items: ExpiryItem[] = data?.items ?? [];
  const stats = data?.stats ?? { totalExpiredBatches: 0, totalNearExpiryBatches: 0, totalExpiredQty: 0, totalNearExpiryQty: 0, totalLossValue: 0 };
  const categoryAnalytics: any[] = data?.categoryAnalytics ?? [];
  const alerts = data?.alerts ?? { expired: [], nearExpiry: [] };
  const filterOptions = data?.filterOptions ?? { categories: [], suppliers: [] };

  const hasActiveFilters = !!(categoryId || supplierId || debouncedSearch || statusFilter !== "all");
  const clearFilters = () => { setCategoryId(undefined); setSupplierId(undefined); setSearch(""); setDebouncedSearch(""); setStatusFilter("all"); };

  // ── Bulk selection helpers ──
  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const toggleSelectAll = () => {
    if (selectedIds.size === items.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(items.map((i) => i.stockEntryId)));
    }
  };
  const clearSelection = () => setSelectedIds(new Set());
  const selectedCount = selectedIds.size;
  const isAllSelected = items.length > 0 && selectedIds.size === items.length;

  const hasAlerts = alerts.expired.length > 0 || alerts.nearExpiry.length > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-xl">
              <ShieldAlert className="text-red-600" size={22} />
            </div>
            Expired Products
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track expired & near-expiry stock batches — only products with expiry tracking enabled
          </p>
        </div>
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search product, batch..." value={search} onChange={(e) => handleSearch(e.target.value)} className="pl-10 w-64" />
        </div>
      </div>

      {/* Alert Panel */}
      {hasAlerts && (
        <div className="border border-red-200 rounded-xl bg-red-50/40 overflow-hidden">
          <div className="px-5 py-3 bg-red-100/50 border-b border-red-200 flex items-center gap-2">
            <AlertTriangle className="text-red-600" size={16} />
            <span className="text-sm font-bold text-red-700">Expiry Alerts</span>
          </div>
          <div className="px-5 py-3 space-y-2">
            {alerts.expired.map((a: any, i: number) => (
              <div key={`exp-${i}`} className="flex items-center gap-2 text-sm">
                <span className="text-red-500">🔴</span>
                <span className="font-medium text-red-800">{a.productName}</span>
                <span className="text-red-600">→ {Number(a.quantity).toLocaleString()} {a.quantityUnit} expired {a.daysExpired}d ago</span>
                <span className="text-red-500 ml-auto text-xs font-semibold">Loss ৳{Number(a.lossValue).toLocaleString()}</span>
              </div>
            ))}
            {alerts.nearExpiry.map((a: any, i: number) => (
              <div key={`ne-${i}`} className="flex items-center gap-2 text-sm">
                <span className="text-amber-500">⚠</span>
                <span className="font-medium text-amber-800">{a.productName}</span>
                <span className="text-amber-600">→ Expiring in {a.daysUntilExpiry}d — {Number(a.quantity).toLocaleString()} {a.quantityUnit}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Expired Batches" value={stats.totalExpiredBatches} sub={`${Number(stats.totalExpiredQty).toLocaleString()} units`} icon={ShieldAlert} color="red" />
        <StatCard label="Near Expiry" value={stats.totalNearExpiryBatches} sub={`${Number(stats.totalNearExpiryQty).toLocaleString()} units`} icon={Clock} color="amber" />
        <StatCard label="Total Loss Value" value={`৳${Number(stats.totalLossValue).toLocaleString()}`} icon={TrendingDown} color="red" />
        <StatCard label="Total Tracked" value={stats.totalExpiredBatches + stats.totalNearExpiryBatches} sub="batches with expiry" icon={Package} color="blue" />
      </div>

      {/* Filters */}
      <div className="bg-card border rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Filter size={14} className="text-muted-foreground" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Filter By</span>
          </div>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="h-7 text-xs gap-1"><X size={12} /> Clear</Button>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1">
            <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Expiry Status</Label>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All (Expired + Near)</SelectItem>
                <SelectItem value="expired">Expired Only</SelectItem>
                <SelectItem value="nearExpiry">Near Expiry Only</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Category</Label>
            <Select value={categoryId?.toString() ?? "all"} onValueChange={(v) => setCategoryId(v === "all" ? undefined : Number(v))}>
              <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {filterOptions.categories.map((c: FilterOption) => (
                  <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Supplier</Label>
            <Select value={supplierId?.toString() ?? "all"} onValueChange={(v) => setSupplierId(v === "all" ? undefined : Number(v))}>
              <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Suppliers</SelectItem>
                {filterOptions.suppliers.map((s: FilterOption) => (
                  <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 border rounded-lg">
          <div className="w-8 h-8 border-3 border-red-200 border-t-red-600 rounded-full animate-spin mb-4" />
          <p className="text-sm text-muted-foreground">Loading expiry data...</p>
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center justify-center py-20 border border-dashed border-red-200 rounded-lg bg-red-50/50">
          <AlertTriangle className="text-red-400 mb-4" size={40} />
          <p className="text-red-600 font-semibold">Failed to load expiry data</p>
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 border border-dashed rounded-lg bg-emerald-50/30">
          <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mb-4">
            <span className="text-3xl">✅</span>
          </div>
          <p className="text-emerald-700 text-lg font-semibold">No expired products found</p>
          <p className="text-sm text-emerald-500 mt-1">All stocks are within safe expiry range</p>
          {hasActiveFilters && (
            <Button variant="outline" size="sm" className="mt-4" onClick={clearFilters}>Clear Filters</Button>
          )}
          <a href="/warehouse/dashboard/inventory" className="mt-3 text-sm text-emerald-600 underline font-medium">View Inventory</a>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Showing <span className="font-medium text-foreground">{items.length}</span> {items.length === 1 ? "batch" : "batches"}
          </p>

          {/* Batch Table */}
          <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
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
                  <TableHead className="w-[30px]"></TableHead>
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
                    <> 
                      <TableRow
                        key={item.stockEntryId}
                        className={`cursor-pointer transition-colors ${isExpanded ? "bg-gray-50" : "hover:bg-gray-50/50"} ${item.expiryStatus === "expired" ? "border-l-2 border-l-red-400" : item.expiryStatus === "nearExpiry" ? "border-l-2 border-l-amber-400" : ""}`}
                        onClick={() => setExpandedId(isExpanded ? null : item.stockEntryId)}
                      >
                        <TableCell className="w-[36px] px-2" onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedIds.has(item.stockEntryId)}
                            onCheckedChange={() => toggleSelect(item.stockEntryId)}
                            aria-label={`Select batch ${item.batchNo}`}
                          />
                        </TableCell>
                        <TableCell className="w-[30px] px-2">
                          {isExpanded ? <ChevronDown size={14} className="text-muted-foreground" /> : <ChevronRight size={14} className="text-muted-foreground" />}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded bg-gray-100 overflow-hidden shrink-0">
                              {item.coreProductImage ? (
                                <Image src={item.coreProductImage} alt="" width={28} height={28} className="object-cover w-full h-full" unoptimized={item.coreProductImage.startsWith("http")} />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center"><Package className="w-3.5 h-3.5 text-gray-300" /></div>
                              )}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-900 line-clamp-1">{item.coreProductName}</p>
                              <p className="text-[10px] text-muted-foreground">{item.categoryName}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-gray-600">{item.variantLabel}</TableCell>
                        <TableCell>
                          <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded font-mono">{item.batchNo}</code>
                        </TableCell>
                        <TableCell className="text-sm">
                          {new Date(item.expiryDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                        </TableCell>
                        <TableCell className="text-sm font-medium">{Number(item.quantity).toLocaleString()} {item.quantityUnit}</TableCell>
                        <TableCell className={`text-sm font-semibold ${item.expiryStatus === "expired" ? "text-red-600" : "text-muted-foreground"}`}>
                          {item.expiryStatus === "expired" ? `৳${Number(item.lossValue).toLocaleString()}` : "—"}
                        </TableCell>
                        <TableCell><ExpiryStatusBadge status={item.expiryStatus} days={item.daysUntilExpiry} /></TableCell>
                      </TableRow>
                      {isExpanded && (
                        <TableRow key={`${item.stockEntryId}-detail`}>
                          <TableCell colSpan={9} className="p-0">
                            <BatchDetail item={item} />
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Category Analytics */}
          {categoryAnalytics.length > 0 && (
            <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b bg-gradient-to-r from-gray-50 to-white">
                <h3 className="text-sm font-bold text-gray-900">📊 Category-wise Expiry Breakdown</h3>
              </div>
              <div className="p-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {categoryAnalytics.map((cat: any) => (
                    <div key={cat.name} className="border rounded-lg p-3 bg-gray-50/50">
                      <p className="text-sm font-semibold text-gray-800">{cat.name}</p>
                      <div className="flex items-center gap-3 mt-1.5">
                        {cat.expiredQty > 0 && (
                          <span className="text-xs text-red-600 font-medium">🔴 {cat.expiredQty.toLocaleString()} expired</span>
                        )}
                        {cat.nearExpiryQty > 0 && (
                          <span className="text-xs text-amber-600 font-medium">⚠ {cat.nearExpiryQty.toLocaleString()} near</span>
                        )}
                      </div>
                      {cat.lossValue > 0 && (
                        <p className="text-xs text-red-500 mt-1">Loss: ৳{cat.lossValue.toLocaleString()}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Floating Bulk Action Bar ── */}
      {selectedCount > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4 fade-in duration-200">
          <div className="bg-gray-900 text-white rounded-xl shadow-2xl px-5 py-3 flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold">
                {selectedCount}
              </div>
              <span className="text-sm font-medium">{selectedCount === 1 ? "batch" : "batches"} selected</span>
            </div>

            <div className="w-px h-6 bg-white/20" />

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs gap-1.5 text-red-300 hover:text-red-200 hover:bg-red-500/20"
                onClick={() => {
                  toast.info(`Mark ${selectedCount} batch(es) as damaged`, { description: "Bulk damage workflow coming soon" });
                }}
              >
                <X size={13} /> Mark Damaged
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs gap-1.5 text-blue-300 hover:text-blue-200 hover:bg-blue-500/20"
                onClick={() => {
                  toast.info(`Return ${selectedCount} batch(es) to supplier`, { description: "Bulk return workflow coming soon" });
                }}
              >
                <Undo2 size={13} /> Bulk Return
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs gap-1.5 text-emerald-300 hover:text-emerald-200 hover:bg-emerald-500/20"
                onClick={() => {
                  toast.info(`Exporting ${selectedCount} batch(es)`, { description: "Export report coming soon" });
                }}
              >
                <Download size={13} /> Export Report
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs gap-1.5 text-orange-300 hover:text-orange-200 hover:bg-orange-500/20"
                onClick={() => {
                  toast.info(`Move ${selectedCount} batch(es) to disposal`, { description: "Disposal workflow coming soon" });
                }}
              >
                <Trash2 size={13} /> Move to Disposal
              </Button>
            </div>

            <div className="w-px h-6 bg-white/20" />

            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs text-white/60 hover:text-white hover:bg-white/10"
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
