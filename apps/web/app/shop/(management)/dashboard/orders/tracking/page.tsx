"use client";

import {
  AlertCircle,
  AlertTriangle,
  CalendarIcon,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  Loader,
  Package,
  PackageCheck,
  Phone,
  Search,
  ShoppingCart,
  Truck,
  XCircle,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  usePurchaseTracking,
  useAcceptPurchaseModification,
  useRejectPurchaseModification,
} from "@/hooks/use-shop-owner-api";

// ─── Status Config ──────────────────────────────────────────

const statusCfg: Record<string, { label: string; icon: React.ReactNode; cls: string }> = {
  pending:    { label: "Pending Approval", icon: <Clock className="w-3 h-3" />,        cls: "text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-300 dark:bg-amber-950/30" },
  approved:   { label: "Approved",         icon: <CheckCircle2 className="w-3 h-3" />, cls: "text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-300 dark:bg-emerald-950/30" },
  ready_for_dispatch: { label: "Ready for Dispatch", icon: <Package className="w-3 h-3" />, cls: "text-blue-700 bg-blue-50 border-blue-200 dark:text-blue-300 dark:bg-blue-950/30" },
  partially_invoiced: { label: "Partially Invoiced", icon: <PackageCheck className="w-3 h-3" />, cls: "text-violet-700 bg-violet-50 border-violet-200 dark:text-violet-300 dark:bg-violet-950/30" },
  invoiced:   { label: "Invoiced",         icon: <PackageCheck className="w-3 h-3" />, cls: "text-sky-700 bg-sky-50 border-sky-200 dark:text-sky-300 dark:bg-sky-950/30" },
  confirmed:  { label: "Approved",         icon: <CheckCircle2 className="w-3 h-3" />, cls: "text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-300 dark:bg-emerald-950/30" },
  processing: { label: "Processing",  icon: <Truck className="w-3 h-3" />,        cls: "text-indigo-700 bg-indigo-50 border-indigo-200 dark:text-indigo-300 dark:bg-indigo-950/30" },
  delivered:  { label: "Delivered",   icon: <PackageCheck className="w-3 h-3" />, cls: "text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-300 dark:bg-emerald-950/30" },
  cancelled:  { label: "Cancelled",   icon: <XCircle className="w-3 h-3" />,      cls: "text-red-700 bg-red-50 border-red-200 dark:text-red-300 dark:bg-red-950/30" },
};

// ─── CSV Export ──────────────────────────────────────────────

function exportCSV(orders: any[]) {
  const rows = [["PO ID", "Wholesaler", "Ordered", "Delivered", "Remaining", "Status", "Date"]];
  for (const o of orders) {
    rows.push([
      o.orderNumber,
      o.warehouseName,
      String(o.tracking.totalOrdered),
      String(o.tracking.totalDelivered),
      String(o.tracking.remaining),
      o.status,
      new Date(o.createdAt).toLocaleDateString("en-BD"),
    ]);
  }
  const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `purchase-tracking-${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Main Component ─────────────────────────────────────────

export default function PurchaseTrackingPage() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [page, setPage] = useState(1);
  const [dateRange, setDateRange] = useState("all");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const handleSearch = useCallback((v: string) => {
    setSearch(v);
    clearTimeout((window as any).__ptTimer);
    (window as any).__ptTimer = setTimeout(() => { setSearchDebounced(v); setPage(1); }, 400);
  }, []);

  const dateFilt = () => {
    const now = new Date();
    if (dateRange === "7d") { const f = new Date(now); f.setDate(f.getDate() - 7); return { dateFrom: f.toISOString().split("T")[0] }; }
    if (dateRange === "30d") { return { dateFrom: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0] }; }
    return {};
  };

  const { data, isLoading, isError } = usePurchaseTracking({
    search: searchDebounced || undefined,
    status: statusFilter === "all" ? undefined : statusFilter as any,
    ...dateFilt(),
    page,
    limit: 15,
  });

  const orders = data?.orders ?? [];
  const pagination = data?.pagination;
  const alerts = data?.alerts;
  const acceptMut = useAcceptPurchaseModification();
  const rejectMut = useRejectPurchaseModification();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Purchase Order Tracking</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Live tracking of your wholesale orders</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => orders.length && exportCSV(orders)} disabled={!orders.length}>
            <Download className="mr-1.5 h-3.5 w-3.5" /> Export
          </Button>
          <Button asChild size="sm">
            <Link href="/dashboard/order-from-warehouse"><ShoppingCart className="mr-1.5 h-3.5 w-3.5" /> New Order</Link>
          </Button>
        </div>
      </div>

      {/* Alert Cards */}
      {alerts && (alerts.modifiedOrders > 0 || alerts.pendingApprovals > 0) && (
        <div className="flex gap-3 flex-wrap">
          {alerts.modifiedOrders > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-orange-200 bg-orange-50 dark:bg-orange-950/20 dark:border-orange-800">
              <AlertTriangle className="w-4 h-4 text-orange-500" />
              <span className="text-sm font-medium text-orange-700 dark:text-orange-300">{alerts.modifiedOrders} order{alerts.modifiedOrders > 1 ? "s" : ""} modified by wholesalers</span>
            </div>
          )}
          {alerts.pendingApprovals > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800">
              <Clock className="w-4 h-4 text-amber-500" />
              <span className="text-sm font-medium text-amber-700 dark:text-amber-300">{alerts.pendingApprovals} order{alerts.pendingApprovals > 1 ? "s" : ""} pending</span>
            </div>
          )}
          {alerts.totalActive > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-800">
              <Truck className="w-4 h-4 text-blue-500" />
              <span className="text-sm font-medium text-blue-700 dark:text-blue-300">{alerts.totalActive} active order{alerts.totalActive > 1 ? "s" : ""}</span>
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="PO ID / Wholesaler / Product" value={search} onChange={(e) => handleSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
          <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending Approval</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="ready_for_dispatch">Ready for Dispatch</SelectItem>
            <SelectItem value="partially_invoiced">Partially Invoiced</SelectItem>
            <SelectItem value="invoiced">Invoiced</SelectItem>
            <SelectItem value="processing">Processing</SelectItem>
            <SelectItem value="delivered">Delivered</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <Select value={dateRange} onValueChange={(v) => { setDateRange(v); setPage(1); }}>
          <SelectTrigger className="w-[140px]"><CalendarIcon className="mr-2 h-3.5 w-3.5 text-muted-foreground" /><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Time</SelectItem>
            <SelectItem value="7d">Last 7 Days</SelectItem>
            <SelectItem value="30d">This Month</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {isLoading ? <TrackingSkeleton /> : isError ? (
        <div className="bg-card rounded-xl border p-12 text-center">
          <AlertCircle className="w-12 h-12 text-red-300 mx-auto mb-3" />
          <p className="text-muted-foreground font-medium">Failed to load tracking data</p>
        </div>
      ) : orders.length === 0 ? (
        <div className="bg-card rounded-xl border p-12 text-center">
          <Package className="w-14 h-14 text-muted-foreground/20 mx-auto mb-4" />
          <p className="text-lg font-semibold">No purchase orders found</p>
          <p className="text-sm text-muted-foreground mt-1 mb-6">
            {searchDebounced || statusFilter !== "all" ? "Adjust your filters" : "Place your first order to start tracking"}
          </p>
          {!searchDebounced && statusFilter === "all" && (
            <Button asChild><Link href="/dashboard/order-from-warehouse"><ShoppingCart className="mr-2 h-4 w-4" />Create Order</Link></Button>
          )}
        </div>
      ) : (
        <>
          <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="font-semibold w-8" />
                  <TableHead className="font-semibold">PO ID</TableHead>
                  <TableHead className="font-semibold">Wholesaler</TableHead>
                  <TableHead className="font-semibold text-center">Ordered</TableHead>
                  <TableHead className="font-semibold text-center">Received</TableHead>
                  <TableHead className="font-semibold">Status</TableHead>
                  <TableHead className="font-semibold">Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((o: any) => {
                  const cfg = statusCfg[o.status] || statusCfg.pending;
                  const isExpanded = expandedId === o.id;
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
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm font-semibold">{o.orderNumber}</span>
                            {o.modification.needsApproval && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-orange-600 border-orange-200 bg-orange-50">Modified</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell><span className="text-sm">{o.warehouseName}</span></TableCell>
                        <TableCell className="text-center"><span className="text-sm font-medium tabular-nums">{o.tracking.totalOrdered} pcs</span></TableCell>
                        <TableCell className="text-center">
                          <span className={`text-sm font-medium tabular-nums ${o.tracking.totalDelivered > 0 ? "text-emerald-600" : "text-muted-foreground"}`}>
                            {o.tracking.totalDelivered} pcs
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`gap-1 text-[11px] ${cfg.cls}`}>{cfg.icon}{cfg.label}</Badge>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs text-muted-foreground tabular-nums">
                            {new Date(o.updatedAt).toLocaleDateString("en-BD", { day: "numeric", month: "short" })}
                          </span>
                        </TableCell>
                      </TableRow>

                      {/* Expanded Detail Panel */}
                      {isExpanded && (
                        <TableRow key={`${o.id}-detail`}>
                          <TableCell colSpan={7} className="p-0">
                            <ExpandedPanel order={o} acceptMut={acceptMut} rejectMut={rejectMut} />
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Page {pagination.page} of {pagination.totalPages} · {pagination.totalCount} orders</p>
              <div className="flex gap-1.5">
                <Button variant="outline" size="icon" className="h-8 w-8" disabled={page <= 1} onClick={() => setPage(p => p - 1)}><ChevronLeft className="h-4 w-4" /></Button>
                <Button variant="outline" size="icon" className="h-8 w-8" disabled={page >= pagination.totalPages} onClick={() => setPage(p => p + 1)}><ChevronRight className="h-4 w-4" /></Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Expanded Panel ─────────────────────────────────────────

function ExpandedPanel({ order: o, acceptMut, rejectMut }: { order: any; acceptMut: any; rejectMut: any }) {
  return (
    <div className="bg-muted/10 border-t px-6 py-5 space-y-5 animate-in slide-in-from-top-2 duration-200">
      {/* Modification Alert */}
      {o.modification.needsApproval && (
        <div className="p-4 rounded-xl border border-orange-200 bg-orange-50/80 dark:bg-orange-950/20 dark:border-orange-800">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-orange-700 dark:text-orange-300 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" /> Wholesaler Modified This Order
              </p>
              <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">Review the changes below and accept or reject.</p>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" onClick={() => rejectMut.mutate({ orderId: o.id })} disabled={rejectMut.isPending}>
                {rejectMut.isPending ? <Loader className="w-3 h-3 animate-spin mr-1" /> : <XCircle className="w-3 h-3 mr-1" />} Reject
              </Button>
              <Button size="sm" onClick={() => acceptMut.mutate({ orderId: o.id })} disabled={acceptMut.isPending}>
                {acceptMut.isPending ? <Loader className="w-3 h-3 animate-spin mr-1" /> : <CheckCircle2 className="w-3 h-3 mr-1" />} Accept
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Item Breakdown */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Item Breakdown</p>
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="bg-muted/40 text-xs">
              <th className="text-left p-2 pl-3 font-medium">Product</th>
              <th className="text-center p-2 font-medium">Ordered</th>
              <th className="text-center p-2 font-medium">Updated</th>
              <th className="text-center p-2 font-medium">Delivered</th>
              <th className="text-center p-2 pr-3 font-medium">Remaining</th>
            </tr></thead>
            <tbody>
              {o.items?.map((item: any) => {
                const effective = item.modifiedQty ?? item.quantity;
                const delivered = item.deliveredQty || 0;
                const remaining = effective - delivered;
                const wasModified = item.modifiedQty !== null && item.modifiedQty !== item.quantity;
                return (
                  <tr key={item.id} className="border-t">
                    <td className="p-2 pl-3">
                      <div className="flex items-center gap-2">
                        {item.productImage ? (
                          <Image src={item.productImage} alt="" width={28} height={28} className="w-7 h-7 rounded border object-cover" />
                        ) : (
                          <div className="w-7 h-7 rounded border bg-muted flex items-center justify-center"><Package className="w-3 h-3" /></div>
                        )}
                        <span className="truncate max-w-[180px]">{item.productName}</span>
                      </div>
                    </td>
                    <td className="text-center p-2 tabular-nums">{item.quantity}</td>
                    <td className="text-center p-2 tabular-nums">
                      {wasModified ? (
                        <span className="text-orange-600 font-medium">{effective} ↓</span>
                      ) : (
                        <span className="text-muted-foreground">{effective}</span>
                      )}
                    </td>
                    <td className="text-center p-2 tabular-nums">
                      <span className={delivered > 0 ? "text-emerald-600 font-medium" : "text-muted-foreground"}>{delivered}</span>
                    </td>
                    <td className="text-center p-2 pr-3 tabular-nums">
                      <span className={remaining > 0 ? "text-amber-600 font-medium" : "text-emerald-600"}>{remaining}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delivery Progress */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Delivery Progress</p>
          <div className="p-3 rounded-lg border bg-card">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-muted-foreground">Delivered</span>
              <span className="font-semibold">{o.tracking.totalDelivered} / {o.tracking.totalOrdered} pcs</span>
            </div>
            <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${o.tracking.deliveryProgress >= 100 ? "bg-emerald-500" : o.tracking.deliveryProgress > 0 ? "bg-blue-500" : "bg-muted-foreground/20"}`}
                style={{ width: `${Math.min(o.tracking.deliveryProgress, 100)}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-muted-foreground mt-1.5">
              <span>{o.tracking.deliveryProgress}% complete</span>
              {o.tracking.remaining > 0 && <span>{o.tracking.remaining} remaining</span>}
            </div>
            {o.tracking.isPartialDelivery && (
              <Badge variant="outline" className="mt-2 text-[10px] text-blue-600 border-blue-200 bg-blue-50">Partial Delivery</Badge>
            )}
          </div>
        </div>

        {/* Delivery Details */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Delivery Details</p>
          <div className="p-3 rounded-lg border bg-card space-y-2">
            {o.trackingId && (
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Tracking</span><span className="font-mono text-xs">{o.trackingId}</span></div>
            )}
            {o.riderName && (
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Rider</span><span>{o.riderName}</span></div>
            )}
            {o.riderPhone && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Phone</span>
                <a href={`tel:${o.riderPhone}`} className="text-primary hover:underline flex items-center gap-1"><Phone className="w-3 h-3" />{o.riderPhone}</a>
              </div>
            )}
            {!o.trackingId && !o.riderName && (
              <p className="text-xs text-muted-foreground">No delivery info yet</p>
            )}
          </div>
        </div>
      </div>

      {/* 8-Step Timeline */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Order Timeline</p>
        <MiniTimeline steps={o.timeline} />
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <Button asChild size="sm" variant="outline"><Link href={`/dashboard/orders/${o.id}`}>View Full Detail</Link></Button>
        {o.warehousePhone && (
          <Button size="sm" variant="outline" asChild><a href={`tel:${o.warehousePhone}`}><Phone className="mr-1 h-3 w-3" />Contact</a></Button>
        )}
      </div>
    </div>
  );
}

// ─── Mini Timeline ──────────────────────────────────────────

function MiniTimeline({ steps }: { steps: any[] }) {
  return (
    <div className="flex items-center gap-0 overflow-x-auto pb-1">
      {steps.map((s: any, i: number) => {
        const isLast = i === steps.length - 1;
        return (
          <div key={i} className="flex items-center">
            <div className="flex flex-col items-center min-w-[64px]">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] ${
                s.completed
                  ? s.isModification
                    ? "bg-orange-500 text-white"
                    : "bg-primary text-primary-foreground"
                  : "bg-muted border-2 border-muted-foreground/20"
              }`}>
                {s.completed ? <CheckCircle2 className="w-3.5 h-3.5" /> : <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30" />}
              </div>
              <p className={`text-[10px] mt-1 font-medium ${s.completed ? (s.isModification ? "text-orange-600" : "text-foreground") : "text-muted-foreground"}`}>{s.step}</p>
              {s.date && <p className="text-[9px] text-muted-foreground">{new Date(s.date).toLocaleDateString("en-BD", { day: "numeric", month: "short" })}</p>}
            </div>
            {!isLast && <div className={`w-6 h-0.5 -mt-4 ${steps[i + 1]?.completed ? "bg-primary" : "bg-muted"}`} />}
          </div>
        );
      })}
    </div>
  );
}

// ─── Skeleton ───────────────────────────────────────────────

function TrackingSkeleton() {
  return (
    <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
      <Table>
        <TableHeader><TableRow className="bg-muted/30">
          <TableHead className="w-8" /><TableHead>PO ID</TableHead><TableHead>Wholesaler</TableHead>
          <TableHead className="text-center">Ordered</TableHead><TableHead className="text-center">Received</TableHead>
          <TableHead>Status</TableHead><TableHead>Updated</TableHead>
        </TableRow></TableHeader>
        <TableBody>
          {Array.from({ length: 5 }).map((_, i) => (
            <TableRow key={i}>
              <TableCell><Skeleton className="h-4 w-4" /></TableCell>
              <TableCell><Skeleton className="h-4 w-20" /></TableCell>
              <TableCell><Skeleton className="h-4 w-24" /></TableCell>
              <TableCell><Skeleton className="h-4 w-12 mx-auto" /></TableCell>
              <TableCell><Skeleton className="h-4 w-12 mx-auto" /></TableCell>
              <TableCell><Skeleton className="h-5 w-20" /></TableCell>
              <TableCell><Skeleton className="h-4 w-14" /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
