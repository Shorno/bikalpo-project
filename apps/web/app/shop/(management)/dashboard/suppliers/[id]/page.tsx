"use client";

import {
  AlertCircle,
  ArrowLeft,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  Gauge,
  Loader,
  Mail,
  MapPin,
  Package,
  Phone,
  ShoppingCart,
  Target,
  TrendingUp,
  Truck,
  Users,
  Wallet,
  XCircle,
  Zap,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useSupplierDetail } from "@/hooks/use-shop-owner-api";

const statusCfg: Record<string, { label: string; cls: string }> = {
  pending:    { label: "Pending",    cls: "text-amber-700 bg-amber-50 border-amber-200" },
  confirmed:  { label: "Confirmed",  cls: "text-blue-700 bg-blue-50 border-blue-200" },
  processing: { label: "Processing", cls: "text-indigo-700 bg-indigo-50 border-indigo-200" },
  delivered:  { label: "Delivered",  cls: "text-emerald-700 bg-emerald-50 border-emerald-200" },
  cancelled:  { label: "Cancelled",  cls: "text-red-700 bg-red-50 border-red-200" },
};

export default function SupplierDetailPage() {
  const params = useParams();
  const warehouseId = params.id as string;
  const { data, isLoading, isError } = useSupplierDetail(warehouseId);

  if (isLoading) return <DetailSkeleton />;
  if (isError || !data) return (
    <div className="space-y-4">
      <Button asChild variant="ghost" size="sm"><Link href="/dashboard/suppliers"><ArrowLeft className="mr-1.5 h-4 w-4" />Back</Link></Button>
      <div className="bg-card rounded-xl border p-12 text-center">
        <AlertCircle className="w-12 h-12 text-red-300 mx-auto mb-3" />
        <p className="text-muted-foreground font-medium">Supplier not found</p>
      </div>
    </div>
  );

  const { identity, financial, orderStats, pendingOrders, recentHistory, topProducts, performance } = data;

  return (
    <div className="space-y-6">
      {/* Back + Header */}
      <Button asChild variant="ghost" size="sm"><Link href="/dashboard/suppliers"><ArrowLeft className="mr-1.5 h-4 w-4" />Back to Suppliers</Link></Button>

      {/* Identity Card */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Users className="w-7 h-7 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold">{identity.name}</h1>
                <div className="flex flex-wrap items-center gap-3 mt-1 text-sm text-muted-foreground">
                  {identity.phone && <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" />{identity.phone}</span>}
                  {identity.email && <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5" />{identity.email}</span>}
                  {identity.address && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{identity.address}</span>}
                </div>
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              {identity.phone && (
                <Button variant="outline" size="sm" asChild><a href={`tel:${identity.phone}`}><Phone className="mr-1.5 h-3.5 w-3.5" />Call</a></Button>
              )}
              <Button size="sm" asChild><Link href="/dashboard/order-from-warehouse"><ShoppingCart className="mr-1.5 h-3.5 w-3.5" />Create Order</Link></Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Financial Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-950/30 flex items-center justify-center shrink-0">
              <TrendingUp className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Purchase</p>
              <p className="text-lg font-bold tabular-nums">৳ {financial.totalPurchased.toLocaleString("en-BD")}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-950/30 flex items-center justify-center shrink-0">
              <Wallet className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Paid</p>
              <p className="text-lg font-bold tabular-nums text-emerald-600">৳ {financial.totalPaid.toLocaleString("en-BD")}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-100 dark:bg-red-950/30 flex items-center justify-center shrink-0">
              <AlertCircle className="w-5 h-5 text-red-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Due</p>
              <p className={`text-lg font-bold tabular-nums ${financial.totalDue > 0 ? "text-red-600" : "text-muted-foreground"}`}>
                ৳ {financial.totalDue.toLocaleString("en-BD")}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Order Stats */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">Order Status</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
            {([
              { label: "Total", value: orderStats.total, color: "text-foreground" },
              { label: "Pending", value: orderStats.pending, color: "text-amber-600" },
              { label: "Confirmed", value: orderStats.confirmed, color: "text-blue-600" },
              { label: "Processing", value: orderStats.processing, color: "text-indigo-600" },
              { label: "Delivered", value: orderStats.delivered, color: "text-emerald-600" },
              { label: "Cancelled", value: orderStats.cancelled, color: "text-red-600" },
            ] as const).map((s) => (
              <div key={s.label} className="text-center p-2 rounded-lg bg-muted/30">
                <p className={`text-lg font-bold tabular-nums ${s.color}`}>{s.value}</p>
                <p className="text-[10px] text-muted-foreground uppercase">{s.label}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pending Orders */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-500" /> Pending Orders
              {pendingOrders.length > 0 && <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-200 bg-amber-50">{pendingOrders.length}</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pendingOrders.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No pending orders</p>
            ) : (
              <div className="space-y-3">
                {pendingOrders.map((po: any) => {
                  const cfg = statusCfg[po.status] || statusCfg.pending;
                  return (
                    <Link key={po.id} href={`/dashboard/orders/${po.id}`} className="block p-3 rounded-lg border hover:bg-muted/30 transition-colors">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-mono text-sm font-semibold">{po.orderNumber}</span>
                        <Badge variant="outline" className={`text-[10px] ${cfg.cls}`}>{cfg.label}</Badge>
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{po.items?.map((i: any) => `${i.productName} × ${i.modifiedQty ?? i.quantity}`).join(", ")}</span>
                        <span className="tabular-nums font-medium">৳ {Number(po.total).toLocaleString("en-BD")}</span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent History */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">Recent History</CardTitle>
              <Button asChild variant="ghost" size="sm" className="h-7 text-xs">
                <Link href="/dashboard/orders/history">View All <ArrowUpRight className="ml-1 w-3 h-3" /></Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {recentHistory.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No completed orders yet</p>
            ) : (
              <div className="space-y-2">
                {recentHistory.map((h: any) => {
                  const cfg = statusCfg[h.status] || statusCfg.delivered;
                  return (
                    <Link key={h.id} href={`/dashboard/orders/${h.id}`} className="flex items-center justify-between p-2.5 rounded-lg border hover:bg-muted/30 transition-colors">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-semibold">{h.orderNumber}</span>
                        <Badge variant="outline" className={`text-[10px] ${cfg.cls}`}>{cfg.label}</Badge>
                      </div>
                      <div className="flex items-center gap-3 text-xs">
                        <span className="font-medium tabular-nums">৳ {Number(h.total).toLocaleString("en-BD")}</span>
                        <span className="text-muted-foreground tabular-nums">{new Date(h.createdAt).toLocaleDateString("en-BD", { day: "numeric", month: "short" })}</span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Products */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">Top Purchased Products</CardTitle></CardHeader>
          <CardContent>
            {topProducts.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No product data</p>
            ) : (
              <div className="space-y-2">
                {topProducts.map((p: any, i: number) => (
                  <div key={i} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/20">
                    {p.image ? (
                      <Image src={p.image} alt="" width={32} height={32} className="w-8 h-8 rounded border object-cover" />
                    ) : (
                      <div className="w-8 h-8 rounded border bg-muted flex items-center justify-center"><Package className="w-3.5 h-3.5" /></div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{p.name}</p>
                      <p className="text-[10px] text-muted-foreground">{p.orderCount} order{p.orderCount > 1 ? "s" : ""}</p>
                    </div>
                    <span className="text-sm font-semibold tabular-nums shrink-0">{p.totalQty} pcs</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Performance Score */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">Performance Score</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-muted/30 text-center">
                <div className={`w-10 h-10 mx-auto rounded-full flex items-center justify-center mb-2 ${
                  performance.deliverySpeed === "Fast" ? "bg-emerald-100 text-emerald-600" :
                  performance.deliverySpeed === "Normal" ? "bg-blue-100 text-blue-600" :
                  "bg-red-100 text-red-600"
                }`}>
                  <Zap className="w-5 h-5" />
                </div>
                <p className="text-sm font-bold">{performance.deliverySpeed}</p>
                <p className="text-[10px] text-muted-foreground">Delivery Speed</p>
                <p className="text-xs text-muted-foreground mt-0.5">~{performance.avgDeliveryDays} day{performance.avgDeliveryDays !== 1 ? "s" : ""}</p>
              </div>
              <div className="p-4 rounded-xl bg-muted/30 text-center">
                <div className={`w-10 h-10 mx-auto rounded-full flex items-center justify-center mb-2 ${
                  performance.orderAccuracy >= 90 ? "bg-emerald-100 text-emerald-600" :
                  performance.orderAccuracy >= 70 ? "bg-amber-100 text-amber-600" :
                  "bg-red-100 text-red-600"
                }`}>
                  <Target className="w-5 h-5" />
                </div>
                <p className="text-sm font-bold">{performance.orderAccuracy}%</p>
                <p className="text-[10px] text-muted-foreground">Order Accuracy</p>
                <p className="text-xs text-muted-foreground mt-0.5">{performance.modificationRate}% modified</p>
              </div>
              <div className="p-4 rounded-xl bg-muted/30 text-center col-span-2">
                <div className="flex items-center justify-center gap-4">
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase">Reliability</p>
                    <p className="text-sm font-bold">
                      {performance.orderAccuracy >= 90 && performance.deliverySpeed === "Fast" ? "Excellent" :
                       performance.orderAccuracy >= 70 ? "Good" : "Needs Improvement"}
                    </p>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                    performance.orderAccuracy >= 90 && performance.deliverySpeed === "Fast"
                      ? "bg-emerald-100 text-emerald-700" : performance.orderAccuracy >= 70
                      ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"
                  }`}>
                    {performance.orderAccuracy >= 90 && performance.deliverySpeed === "Fast" ? "⭐ Top Supplier" :
                     performance.orderAccuracy >= 70 ? "👍 Reliable" : "⚠ Review"}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-32" />
      <Card><CardContent className="p-6"><div className="flex items-center gap-4">
        <Skeleton className="w-14 h-14 rounded-xl" />
        <div className="space-y-2"><Skeleton className="h-6 w-40" /><Skeleton className="h-4 w-60" /></div>
      </div></CardContent></Card>
      <div className="grid grid-cols-3 gap-4">
        {[1,2,3].map(i => <Card key={i}><CardContent className="p-4"><Skeleton className="h-12 w-full" /></CardContent></Card>)}
      </div>
      <Card><CardContent className="p-4"><Skeleton className="h-24 w-full" /></CardContent></Card>
    </div>
  );
}
