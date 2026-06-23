"use client";

import {
  AlertCircle,
  CalendarIcon,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  Package,
  RotateCcw,
  Search,
  ShoppingCart,
  TrendingUp,
  XCircle,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState, useCallback } from "react";
import {
  formatRetailerOrderItemQuantity,
  getRetailerOrderFulfillmentSummary,
} from "@/components/features/orders/retailer-order-fulfillment";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { usePurchaseHistory } from "@/hooks/use-shop-owner-api";

// ─── Status Config ──────────────────────────────────────────

const statusCfg: Record<string, { label: string; icon: React.ReactNode; cls: string }> = {
  delivered:  { label: "Received",  icon: <CheckCircle2 className="w-3 h-3" />, cls: "text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-300 dark:bg-emerald-950/30" },
  cancelled:  { label: "Cancelled", icon: <XCircle className="w-3 h-3" />,      cls: "text-red-700 bg-red-50 border-red-200 dark:text-red-300 dark:bg-red-950/30" },
  returned:   { label: "Returned",  icon: <RotateCcw className="w-3 h-3" />,    cls: "text-orange-700 bg-orange-50 border-orange-200 dark:text-orange-300 dark:bg-orange-950/30" },
};

// ─── CSV Export ──────────────────────────────────────────────

function exportCSV(orders: any[]) {
  const rows = [[
    "PO ID",
    "Wholesaler",
    "Product",
    "Fulfillment",
    "Mode Breakdown",
    "Amount",
    "Date",
    "Status",
    "Payment",
    "Invoice",
  ]];
  for (const o of orders) {
    const productNames = o.items?.map((i: any) => i.productName).join("; ") || "";
    const fulfillment = getRetailerOrderFulfillmentSummary(o.items);
    rows.push([
      o.orderNumber, o.warehouseName, productNames,
      fulfillment.primary,
      fulfillment.secondary || fulfillment.badges.join("; "),
      String(o.totalAmount),
      new Date(o.createdAt).toLocaleDateString("en-BD"),
      o.status, o.paymentMethod || "", o.invoiceNumber || "",
    ]);
  }
  const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `purchase-history-${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Main Component ─────────────────────────────────────────

export default function PurchaseHistoryPage() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [page, setPage] = useState(1);
  const [dateRange, setDateRange] = useState("all");
  const [whFilter, setWhFilter] = useState("all");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const handleSearch = useCallback((v: string) => {
    setSearch(v);
    clearTimeout((window as any).__phTimer);
    (window as any).__phTimer = setTimeout(() => { setSearchDebounced(v); setPage(1); }, 400);
  }, []);

  const dateFilt = () => {
    const now = new Date();
    if (dateRange === "7d") { const f = new Date(now); f.setDate(f.getDate() - 7); return { dateFrom: f.toISOString().split("T")[0] }; }
    if (dateRange === "30d") return { dateFrom: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0] };
    if (dateRange === "last") return { dateFrom: new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split("T")[0], dateTo: new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split("T")[0] };
    return {};
  };

  const { data, isLoading, isError } = usePurchaseHistory({
    search: searchDebounced || undefined,
    status: statusFilter === "all" ? undefined : statusFilter as any,
    warehouseId: whFilter === "all" ? undefined : whFilter,
    ...dateFilt(),
    page,
    limit: 15,
  });

  const orders = data?.orders ?? [];
  const pagination = data?.pagination;
  const trend = data?.trend ?? [];
  const wholesalers = data?.wholesalers ?? [];
  const maxTrendAmount = Math.max(...trend.map((t) => t.amount), 1);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Purchase History</h1>
          <p className="text-sm text-muted-foreground mt-0.5">All completed &amp; past purchases</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => orders.length && exportCSV(orders)} disabled={!orders.length}>
            <Download className="mr-1.5 h-3.5 w-3.5" /> Export Report
          </Button>
          <Button asChild size="sm">
            <Link href="/dashboard/order-from-warehouse"><ShoppingCart className="mr-1.5 h-3.5 w-3.5" /> New Order</Link>
          </Button>
        </div>
      </div>

      {/* 7-Day Trend */}
      {trend.length > 0 && trend.some((t) => t.orders > 0) && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" /> Purchase Trend (Last 7 Days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-2 h-20">
              {trend.map((t, i) => {
                const h = maxTrendAmount > 0 ? Math.max((t.amount / maxTrendAmount) * 100, 4) : 4;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-[10px] text-muted-foreground tabular-nums">
                      {t.orders > 0 ? `৳${(t.amount / 1000).toFixed(0)}k` : ""}
                    </span>
                    <div
                      className={`w-full rounded-t transition-all duration-300 ${t.orders > 0 ? "bg-primary/80 hover:bg-primary" : "bg-muted"}`}
                      style={{ height: `${h}%` }}
                      title={`${t.label}: ${t.orders} orders, ৳${t.amount.toLocaleString("en-BD")}`}
                    />
                    <span className="text-[10px] text-muted-foreground font-medium">{t.label}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="PO ID / Wholesaler / Product" value={search} onChange={(e) => handleSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="delivered">Received</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
            <SelectItem value="returned">Returned</SelectItem>
          </SelectContent>
        </Select>
        {wholesalers.length > 0 && (
          <Select value={whFilter} onValueChange={(v) => { setWhFilter(v); setPage(1); }}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="All Wholesalers" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Wholesalers</SelectItem>
              {wholesalers.map((w: any) => (
                <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Select value={dateRange} onValueChange={(v) => { setDateRange(v); setPage(1); }}>
          <SelectTrigger className="w-[140px]"><CalendarIcon className="mr-2 h-3.5 w-3.5 text-muted-foreground" /><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Time</SelectItem>
            <SelectItem value="7d">Last 7 Days</SelectItem>
            <SelectItem value="30d">This Month</SelectItem>
            <SelectItem value="last">Last Month</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {isLoading ? <HistorySkeleton /> : isError ? (
        <div className="bg-card rounded-xl border p-12 text-center">
          <AlertCircle className="w-12 h-12 text-red-300 mx-auto mb-3" />
          <p className="text-muted-foreground font-medium">Failed to load history</p>
        </div>
      ) : orders.length === 0 ? (
        <div className="bg-card rounded-xl border p-12 text-center">
          <Package className="w-14 h-14 text-muted-foreground/20 mx-auto mb-4" />
          <p className="text-lg font-semibold">No purchase history found</p>
          <p className="text-sm text-muted-foreground mt-1 mb-6">
            {searchDebounced || statusFilter !== "all" ? "Adjust your filters" : "Completed orders will appear here"}
          </p>
          {!searchDebounced && statusFilter === "all" && (
            <Button asChild><Link href="/dashboard/order-from-warehouse"><ShoppingCart className="mr-2 h-4 w-4" />Create Purchase Order</Link></Button>
          )}
        </div>
      ) : (
        <>
          <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="w-8" />
                  <TableHead className="font-semibold">PO ID</TableHead>
                  <TableHead className="font-semibold">Wholesaler</TableHead>
                  <TableHead className="font-semibold">Product</TableHead>
                  <TableHead className="font-semibold text-center">Fulfillment</TableHead>
                  <TableHead className="font-semibold text-right">Amount</TableHead>
                  <TableHead className="font-semibold">Date</TableHead>
                  <TableHead className="font-semibold">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((o: any) => {
                  const cfg = statusCfg[o.status] || statusCfg.delivered;
                  const isExpanded = expandedId === o.id;
                  const firstProduct = o.items?.[0];
                  const fulfillment = getRetailerOrderFulfillmentSummary(o.items);
                  return (
                    <>
                      <TableRow
                        key={o.id}
                        className="cursor-pointer hover:bg-muted/30 transition-colors"
                        onClick={() => setExpandedId(isExpanded ? null : o.id)}
                      >
                        <TableCell>
                          <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                        </TableCell>
                        <TableCell><span className="font-mono text-sm font-semibold">{o.orderNumber}</span></TableCell>
                        <TableCell><span className="text-sm">{o.warehouseName}</span></TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {firstProduct?.productImage ? (
                              <Image src={firstProduct.productImage} alt="" width={28} height={28} className="w-7 h-7 rounded border object-cover" />
                            ) : (
                              <div className="w-7 h-7 rounded border bg-muted flex items-center justify-center"><Package className="w-3 h-3" /></div>
                            )}
                            <span className="text-sm truncate max-w-[140px]">
                              {firstProduct?.productName || "—"}
                              {(o.items?.length || 0) > 1 && <span className="text-muted-foreground"> +{o.items.length - 1}</span>}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="space-y-0.5">
                            <p className="text-sm font-medium tabular-nums">{fulfillment.primary}</p>
                            {fulfillment.secondary && (
                              <p className="text-[10px] text-muted-foreground">{fulfillment.secondary}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right"><span className="text-sm font-medium tabular-nums">৳ {o.totalAmount.toLocaleString("en-BD")}</span></TableCell>
                        <TableCell>
                          <span className="text-xs text-muted-foreground tabular-nums">
                            {new Date(o.createdAt).toLocaleDateString("en-BD", { day: "numeric", month: "short" })}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`gap-1 text-[11px] ${cfg.cls}`}>{cfg.icon}{cfg.label}</Badge>
                        </TableCell>
                      </TableRow>

                      {isExpanded && (
                        <TableRow key={`${o.id}-detail`}>
                          <TableCell colSpan={8} className="p-0">
                            <HistoryDetail order={o} />
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Page {pagination.page} of {pagination.totalPages} · {pagination.totalCount} records</p>
              <div className="flex gap-1.5">
                <Button variant="outline" size="icon" className="h-8 w-8" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}><ChevronLeft className="h-4 w-4" /></Button>
                <Button variant="outline" size="icon" className="h-8 w-8" disabled={page >= pagination.totalPages} onClick={() => setPage((p) => p + 1)}><ChevronRight className="h-4 w-4" /></Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── History Detail Panel ───────────────────────────────────

function HistoryDetail({ order: o }: { order: any }) {
  return (
    <div className="bg-muted/10 border-t px-6 py-5 space-y-5 animate-in slide-in-from-top-2 duration-200">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Products Received */}
        <div className="md:col-span-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Products {o.status === "delivered" ? "Received" : o.status === "cancelled" ? "(Cancelled)" : "Returned"}</p>
          <div className="space-y-2">
            {o.items?.map((item: any) => {
              const qty = item.modifiedQty ?? item.quantity;
              const price = item.modifiedUnitPrice ?? item.unitPrice;
              return (
                <div key={item.id} className="flex items-center gap-3 p-3 rounded-lg border bg-card">
                  {item.productImage ? (
                    <Image src={item.productImage} alt="" width={40} height={40} className="w-10 h-10 rounded-md border object-cover" />
                  ) : (
                    <div className="w-10 h-10 rounded-md border bg-muted flex items-center justify-center"><Package className="w-4 h-4" /></div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.productName}</p>
                    <p className="text-xs text-muted-foreground">{item.productSize}</p>
                    <Badge variant="outline" className="mt-1 text-[10px]">
                      {item.supplyModeLabel}
                    </Badge>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold tabular-nums">৳ {(qty * Number(price)).toLocaleString("en-BD")}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatRetailerOrderItemQuantity(qty, item)} × ৳{Number(price).toFixed(0)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-4">
          {/* Payment Info */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Payment</p>
            <div className="p-3 rounded-lg border bg-card space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Status</span>
                <Badge variant="outline" className={`text-[10px] ${o.paymentStatus === "paid" ? "text-emerald-600 border-emerald-200 bg-emerald-50" : "text-amber-600 border-amber-200 bg-amber-50"}`}>
                  {o.paymentStatus === "paid" ? "Paid" : o.paymentStatus || "Pending"}
                </Badge>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Method</span>
                <span className="capitalize text-xs">{o.paymentMethod?.replace(/_/g, " ") || "—"}</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="font-medium text-sm">Total</span>
                <span className="font-bold text-primary tabular-nums">৳ {Number(o.total).toLocaleString("en-BD")}</span>
              </div>
            </div>
          </div>

          {/* Invoice */}
          {o.invoiceNumber && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Documents</p>
              <div className="p-3 rounded-lg border bg-card flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-mono">{o.invoiceNumber}</span>
                </div>
                <Button asChild size="sm" variant="outline" className="h-7 text-xs">
                  <Link href={`/dashboard/orders/${o.id}`}>View</Link>
                </Button>
              </div>
            </div>
          )}

          {/* Stock Impact */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Stock Impact</p>
            <div className="p-3 rounded-lg border bg-card space-y-1.5">
              {o.stockImpact?.map((si: any, i: number) => (
                <div key={i} className="flex justify-between text-sm">
                  <span className="truncate max-w-[140px] text-muted-foreground">{si.product}</span>
                  <Badge variant="outline" className={`text-[10px] font-mono ${
                    si.type === "added" ? "text-emerald-600 border-emerald-200 bg-emerald-50"
                    : si.type === "returned" ? "text-orange-600 border-orange-200 bg-orange-50"
                    : "text-muted-foreground border-muted"
                  }`}>
                    {si.change} {si.type === "added" ? "added" : si.type === "returned" ? "returned" : "no impact"}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <Button asChild size="sm" variant="outline"><Link href={`/dashboard/orders/${o.id}`}>View Full Detail</Link></Button>
      </div>
    </div>
  );
}

// ─── Skeleton ───────────────────────────────────────────────

function HistorySkeleton() {
  return (
    <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
      <Table>
        <TableHeader><TableRow className="bg-muted/30">
          <TableHead className="w-8" /><TableHead>PO ID</TableHead><TableHead>Wholesaler</TableHead>
          <TableHead>Product</TableHead><TableHead className="text-center">Qty</TableHead>
          <TableHead className="text-right">Amount</TableHead><TableHead>Date</TableHead><TableHead>Status</TableHead>
        </TableRow></TableHeader>
        <TableBody>
          {Array.from({ length: 5 }).map((_, i) => (
            <TableRow key={i}>
              <TableCell><Skeleton className="h-4 w-4" /></TableCell>
              <TableCell><Skeleton className="h-4 w-16" /></TableCell>
              <TableCell><Skeleton className="h-4 w-20" /></TableCell>
              <TableCell><Skeleton className="h-4 w-24" /></TableCell>
              <TableCell><Skeleton className="h-4 w-10 mx-auto" /></TableCell>
              <TableCell><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
              <TableCell><Skeleton className="h-4 w-12" /></TableCell>
              <TableCell><Skeleton className="h-5 w-16" /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
