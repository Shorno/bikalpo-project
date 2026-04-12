"use client";

import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import {
  ArrowUp,
  Bike,
  ClipboardList,
  CreditCard,
  Crown,
  DollarSign,
  FileText,
  Layers,
  MapPin,
  Package,
  RotateCcw,
  ShoppingBag,
  ShoppingCart,
  Store,
  TrendingUp,
  Trophy,
  Truck,
  Users,
  Users2,
  Warehouse,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { orpc } from "@/utils/orpc";

const ADMIN_BASE = "/dashboard/admin";

// ── Formatters ──────────────────────────────────────────────────────
function formatCurrency(amount: number) {
  if (amount >= 1_00_00_000) return `৳${(amount / 1_00_00_000).toFixed(1)} Cr`;
  if (amount >= 1_00_000) return `৳${(amount / 1_00_000).toFixed(1)} Lakh`;
  if (amount >= 1_000) return `৳${(amount / 1_000).toFixed(1)}K`;
  return `৳${amount.toLocaleString("en-IN")}`;
}

function formatNumber(num: number) {
  if (num >= 1_00_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toLocaleString();
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good Morning";
  if (hour < 17) return "Good Afternoon";
  return "Good Evening";
}

// ── Skeleton ────────────────────────────────────────────────────────
function Pulse({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-block animate-pulse rounded-md bg-muted/60 ${className}`}
    />
  );
}

// ── Stagger wrapper ─────────────────────────────────────────────────
function Stagger({
  children,
  index,
  className = "",
}: {
  children: React.ReactNode;
  index: number;
  className?: string;
}) {
  return (
    <div
      className={`animate-in fade-in slide-in-from-bottom-2 fill-mode-both duration-400 ${className}`}
      style={{ animationDelay: `${index * 60}ms` }}
    >
      {children}
    </div>
  );
}

export function AdminDashboardClient() {
  const { data: session } = authClient.useSession();

  const { data, isLoading } = useQuery({
    ...orpc.dashboard.getStats.queryOptions(),
    refetchInterval: 60_000,
  });

  const s = data?.stats;
  const userName = session?.user?.name?.split(" ")[0] || "Admin";

  const now = new Date();
  const formattedDate = now.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  // ── Quick actions ─────────────────────────────────────────────────
  const quickActions = [
    { title: "Product Catalog", href: `${ADMIN_BASE}/products`, icon: Package },
    { title: "Consumer Prices", href: `${ADMIN_BASE}/consumer-products`, icon: DollarSign },
    { title: "Orders", href: `${ADMIN_BASE}/orders`, icon: ShoppingCart },
    { title: "Invoices", href: `${ADMIN_BASE}/invoices`, icon: FileText },
    { title: "Delivery", href: `${ADMIN_BASE}/delivery`, icon: Truck },
    { title: "Customers", href: `${ADMIN_BASE}/customers`, icon: Users },
    { title: "Reports", href: `${ADMIN_BASE}/sales-reports`, icon: TrendingUp },
    { title: "Returns", href: `${ADMIN_BASE}/returns`, icon: RotateCcw },
    { title: "Stock", href: `${ADMIN_BASE}/stock`, icon: Warehouse },
    { title: "Deliverymen", href: `${ADMIN_BASE}/deliverymen`, icon: Bike },
    { title: "Salesmen", href: `${ADMIN_BASE}/salesmen`, icon: Users2 },
    { title: "Performance", href: `${ADMIN_BASE}/employee-performance`, icon: TrendingUp },
    { title: "Audit Log", href: `${ADMIN_BASE}/audit`, icon: ClipboardList },
  ];

  // Attention items — only show non-zero
  const attentionItems = [
    { label: "Open Tickets", count: s?.openTickets || 0, href: `${ADMIN_BASE}/tickets`, color: "text-orange-600 dark:text-orange-400", bg: "bg-orange-100 dark:bg-orange-900/30" },
    { label: "Item Requests", count: s?.pendingItemRequests || 0, href: `${ADMIN_BASE}/item-requests`, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-100 dark:bg-blue-900/30" },
    { label: "Seller Apps", count: s?.pendingSellerApps || 0, href: `${ADMIN_BASE}/seller-applications`, color: "text-violet-600 dark:text-violet-400", bg: "bg-violet-100 dark:bg-violet-900/30" },
    { label: "Low Stock", count: s?.lowStockProducts || 0, href: `${ADMIN_BASE}/stock`, color: "text-yellow-600 dark:text-yellow-400", bg: "bg-yellow-100 dark:bg-yellow-900/30" },
    { label: "Out of Stock", count: s?.outOfStockProducts || 0, href: `${ADMIN_BASE}/stock`, color: "text-red-600 dark:text-red-400", bg: "bg-red-100 dark:bg-red-900/30" },
  ].filter((item) => isLoading || item.count > 0);

  // B2B vs B2C ratio
  const totalChannelOrders = (s?.b2bOrders || 0) + (s?.b2cOrders || 0);
  const b2bPercent = totalChannelOrders > 0 ? Math.round(((s?.b2bOrders || 0) / totalChannelOrders) * 100) : 0;

  return (
    <div className="space-y-5">
      {/* ═══════════════════════════════════════════════════════════
          HEADER
      ═══════════════════════════════════════════════════════════ */}
      <Stagger index={0}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              {getGreeting()},{" "}
              <span className="text-primary">{userName}</span>
            </h1>
            <p className="mt-0.5 text-xs text-muted-foreground">{formattedDate}</p>
          </div>
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
            </span>
            Live
          </span>
        </div>
      </Stagger>

      {/* ═══════════════════════════════════════════════════════════
          PRIMARY KPIs — Compact
      ═══════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          {
            label: "Users",
            value: s?.totalUsers || 0,
            icon: Users,
            delta: s?.newUsersToday || 0,
            deltaLabel: "today",
          },
          {
            label: "Orders",
            value: s?.totalOrders || 0,
            icon: ShoppingCart,
            delta: s?.ordersToday || 0,
            deltaLabel: "today",
          },
          {
            label: "Total Sales",
            value: s?.totalGMV || 0,
            icon: DollarSign,
            isCurrency: true,
            delta: s?.revenueToday || 0,
            deltaLabel: "today",
          },
          {
            label: "Subscriptions",
            value: s?.subscriptions?.totalActive || 0,
            icon: CreditCard,
          },
        ].map((kpi, i) => (
          <Stagger key={kpi.label} index={i + 1}>
            <div className="rounded-lg border bg-card px-4 py-3 transition-colors hover:bg-muted/30">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <kpi.icon className="h-3.5 w-3.5" />
                <span className="text-xs">{kpi.label}</span>
              </div>
              <p className="mt-1 text-2xl font-bold tabular-nums tracking-tight">
                {isLoading ? (
                  <Pulse className="h-7 w-16" />
                ) : kpi.isCurrency ? (
                  formatCurrency(kpi.value)
                ) : (
                  formatNumber(kpi.value)
                )}
              </p>
              {!isLoading && (kpi.delta || 0) > 0 && (
                <p className="mt-0.5 flex items-center gap-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                  <ArrowUp className="h-2.5 w-2.5" />
                  +{kpi.isCurrency ? formatCurrency(kpi.delta!) : kpi.delta} {kpi.deltaLabel}
                </p>
              )}
            </div>
          </Stagger>
        ))}
      </div>

      {/* ═══════════════════════════════════════════════════════════
          OPERATIONS OVERVIEW
      ═══════════════════════════════════════════════════════════ */}
      <Stagger index={5}>
        <div className="rounded-lg border bg-card">
          <div className="border-b px-4 py-2.5">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Operations</h2>
          </div>
          <div className="grid grid-cols-2 divide-x divide-y sm:grid-cols-4 sm:divide-y-0">
            {[
              { href: `${ADMIN_BASE}/orders?status=pending`, icon: ClipboardList, value: s?.pendingOrders || 0, label: "Pending", color: "text-amber-500", extra: null },
              { href: `${ADMIN_BASE}/orders?status=cancelled`, icon: XCircle, value: s?.cancelledTotal || 0, label: "Cancelled", color: "text-red-500", extra: (s?.cancelledToday || 0) > 0 ? `${s?.cancelledToday} today` : null },
              { href: `${ADMIN_BASE}/invoices`, icon: FileText, value: s?.pendingInvoices || 0, label: "Unassigned", color: "text-purple-500", extra: null },
              { href: `${ADMIN_BASE}/delivery`, icon: Truck, value: s?.activeDeliveries || 0, label: "In Delivery", color: "text-cyan-500", extra: (s?.deliveriesToday || 0) > 0 ? `${s?.deliveriesToday} done` : null },
            ].map((op) => (
              <Link
                key={op.label}
                href={op.href}
                className="flex items-center gap-2.5 px-4 py-3 transition-colors hover:bg-muted/40"
              >
                <op.icon className={`h-4 w-4 shrink-0 ${op.color}`} />
                <div>
                  <p className={`text-lg font-bold tabular-nums ${op.color}`}>
                    {isLoading ? "–" : op.value}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {op.label}
                    {!isLoading && op.extra && (
                      <span className="ml-1 opacity-70">({op.extra})</span>
                    )}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </Stagger>

      {/* ═══════════════════════════════════════════════════════════
          B2B vs B2C  |  USER DISTRIBUTION
      ═══════════════════════════════════════════════════════════ */}
      <div className="grid gap-3 sm:grid-cols-2">
        {/* Order Channels */}
        <Stagger index={6}>
          <div className="rounded-lg border bg-card px-4 py-3">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Order Channels</h2>
            <div className="mt-3 space-y-2">
              <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted/50">
                <div
                  className="rounded-l-full bg-violet-500 transition-all duration-700"
                  style={{ width: `${b2bPercent}%` }}
                />
                <div
                  className="rounded-r-full bg-sky-400 transition-all duration-700"
                  style={{ width: `${100 - b2bPercent}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-violet-500" />
                  <span className="text-muted-foreground">B2B</span>
                  <span className="font-bold tabular-nums">
                    {isLoading ? "–" : formatNumber(s?.b2bOrders || 0)}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="font-bold tabular-nums">
                    {isLoading ? "–" : formatNumber(s?.b2cOrders || 0)}
                  </span>
                  <span className="text-muted-foreground">B2C</span>
                  <span className="h-2 w-2 rounded-full bg-sky-400" />
                </div>
              </div>
            </div>
          </div>
        </Stagger>

        {/* User Distribution */}
        <Stagger index={7}>
          <div className="rounded-lg border bg-card px-4 py-3">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">User Distribution</h2>
            <div className="mt-3 space-y-1.5">
              {[
                { label: "Consumers", value: s?.totalConsumers || 0, icon: Users, color: "text-blue-500" },
                { label: "Retailers", value: s?.totalRetailers || 0, icon: Store, color: "text-green-500" },
                { label: "Wholesalers", value: s?.totalWholesalers || 0, icon: ShoppingBag, color: "text-violet-500" },
                { label: "Warehouses", value: s?.totalWarehouses || 0, icon: Warehouse, color: "text-teal-500" },
                { label: "Riders", value: s?.totalDeliverymen || 0, icon: Bike, color: "text-orange-500" },
                { label: "Admins", value: s?.totalAdmins || 0, icon: Crown, color: "text-amber-500" },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between py-0.5">
                  <div className="flex items-center gap-2">
                    <item.icon className={`h-3.5 w-3.5 ${item.color}`} />
                    <span className="text-xs text-muted-foreground">{item.label}</span>
                  </div>
                  <span className="text-xs font-bold tabular-nums">
                    {isLoading ? "–" : formatNumber(item.value)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </Stagger>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          SUBSCRIPTION STATUS
      ═══════════════════════════════════════════════════════════ */}
      <Stagger index={8}>
        <div className="rounded-lg border bg-card">
          <div className="border-b px-4 py-2.5">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Subscriptions</h2>
          </div>
          <div className="grid grid-cols-2 divide-x divide-y sm:grid-cols-4 sm:divide-y-0">
            {[
              { label: "Active", value: s?.subscriptions?.active || 0, dotColor: "bg-emerald-500" },
              { label: "Trial", value: s?.subscriptions?.freeTrial || 0, dotColor: "bg-sky-500" },
              { label: "Expiring Soon", value: s?.subscriptions?.expiringSoon || 0, dotColor: "bg-amber-500" },
              { label: "Expired", value: s?.subscriptions?.expired || 0, dotColor: "bg-red-500" },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-2.5 px-4 py-3">
                <span className={`h-2 w-2 shrink-0 rounded-full ${item.dotColor}`} />
                <div>
                  <p className="text-lg font-bold tabular-nums">
                    {isLoading ? "–" : item.value}
                  </p>
                  <p className="text-[11px] text-muted-foreground">{item.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Stagger>

      {/* ═══════════════════════════════════════════════════════════
          NEEDS ATTENTION — Alert badges (only non-zero)
      ═══════════════════════════════════════════════════════════ */}
      {attentionItems.length > 0 && (
        <Stagger index={9}>
          <div className="rounded-lg border bg-card px-4 py-3">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2.5">Needs Attention</h2>
            <div className="flex flex-wrap gap-1.5">
              {attentionItems.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs transition-colors hover:bg-muted/50"
                >
                  <span className={`flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold ${item.bg} ${item.color}`}>
                    {isLoading ? "–" : item.count}
                  </span>
                  <span className="text-muted-foreground">{item.label}</span>
                </Link>
              ))}
            </div>
          </div>
        </Stagger>
      )}

      {/* ═══════════════════════════════════════════════════════════
          PERFORMANCE + LIVE ACTIVITY (side by side on lg)
      ═══════════════════════════════════════════════════════════ */}
      <div className="grid gap-3 lg:grid-cols-5">
        {/* Performance Highlights — 2 cols */}
        <Stagger index={10} className="lg:col-span-2">
          <div className="rounded-lg border bg-card h-full">
            <div className="border-b px-4 py-2.5">
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Performance</h2>
            </div>
            <div className="divide-y">
              {/* Top Product */}
              <div className="px-4 py-3">
                <div className="flex items-center gap-2 mb-1.5">
                  <Trophy className="h-4 w-4 text-amber-500" />
                  <span className="text-xs font-medium text-muted-foreground">Top Product</span>
                </div>
                {isLoading ? (
                  <Pulse className="h-5 w-24" />
                ) : s?.performance?.topProduct ? (
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold truncate">{s.performance.topProduct.name}</p>
                    <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{s.performance.topProduct.value} sold</span>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">No data</p>
                )}
              </div>

              {/* Top Supplier */}
              <div className="px-4 py-3">
                <div className="flex items-center gap-2 mb-1.5">
                  <Layers className="h-4 w-4 text-blue-500" />
                  <span className="text-xs font-medium text-muted-foreground">Top Supplier</span>
                </div>
                {isLoading ? (
                  <Pulse className="h-5 w-24" />
                ) : s?.performance?.topSupplier ? (
                  <p className="text-sm font-bold truncate">{s.performance.topSupplier.name}</p>
                ) : (
                  <p className="text-xs text-muted-foreground">No data</p>
                )}
              </div>

              {/* Top Area */}
              <div className="px-4 py-3">
                <div className="flex items-center gap-2 mb-1.5">
                  <MapPin className="h-4 w-4 text-green-500" />
                  <span className="text-xs font-medium text-muted-foreground">Top Area</span>
                </div>
                {isLoading ? (
                  <Pulse className="h-5 w-24" />
                ) : s?.performance?.topArea ? (
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold truncate">{s.performance.topArea.name}</p>
                    <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{s.performance.topArea.orders} orders</span>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">No data</p>
                )}
              </div>
            </div>
          </div>
        </Stagger>

        {/* Live Activity Feed — 3 cols */}
        <Stagger index={11} className="lg:col-span-3">
          <div className="rounded-lg border bg-card h-full">
            <div className="flex items-center justify-between border-b px-4 py-2.5">
              <div className="flex items-center gap-2">
                <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Activity</h2>
                <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[9px] font-medium text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  </span>
                  LIVE
                </span>
              </div>
              <span className="text-[10px] text-muted-foreground">60s refresh</span>
            </div>

            <div className="max-h-[240px] overflow-y-auto">
              {isLoading ? (
                <div className="space-y-0 divide-y">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                      <Pulse className="h-2 w-2 shrink-0 rounded-full" />
                      <div className="flex-1 space-y-1">
                        <Pulse className="h-3.5 w-24" />
                        <Pulse className="h-3 w-36" />
                      </div>
                      <Pulse className="h-3 w-16" />
                    </div>
                  ))}
                </div>
              ) : !s?.activityFeed?.length ? (
                <div className="px-5 py-8 text-center text-sm text-muted-foreground">
                  No recent activity
                </div>
              ) : (
                <div className="divide-y">
                  {s.activityFeed.map((item: any, i: number) => {
                    const dotColor =
                      item.icon === "green" ? "bg-emerald-500"
                      : item.icon === "red" ? "bg-red-500"
                      : item.icon === "yellow" ? "bg-amber-500"
                      : "bg-blue-500";

                    return (
                      <div
                        key={`${item.type}-${i}`}
                        className="flex items-start gap-2.5 px-4 py-2.5 animate-in fade-in slide-in-from-left-2 duration-300"
                        style={{ animationDelay: `${i * 50}ms` }}
                      >
                        <div className="relative mt-1 flex shrink-0">
                          <span className={`h-2 w-2 rounded-full ${dotColor}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-semibold leading-tight">
                            {item.title}
                          </p>
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">
                            {item.description}
                          </p>
                        </div>
                        <span className="shrink-0 text-[11px] text-muted-foreground/60">
                          {formatDistanceToNow(new Date(item.timestamp), { addSuffix: true })}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </Stagger>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          QUICK ACTIONS — Professional grid
      ═══════════════════════════════════════════════════════════ */}
      <Stagger index={12}>
        <div className="rounded-lg border bg-card px-4 py-3">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Quick Actions</h2>
          <div className="grid grid-cols-3 gap-1 sm:grid-cols-4 md:grid-cols-6">
            {quickActions.map((action) => (
              <Link
                key={action.href}
                href={action.href}
                className="group flex items-center gap-2 rounded-md px-2.5 py-2 text-xs transition-colors hover:bg-muted/60"
              >
                <action.icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
                <span className="truncate font-medium text-muted-foreground transition-colors group-hover:text-foreground">
                  {action.title}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </Stagger>
    </div>
  );
}
