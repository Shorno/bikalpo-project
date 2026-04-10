"use client";

import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Ban,
  Bike,
  Box,
  ClipboardList,
  CreditCard,
  Crown,
  DollarSign,
  FileText,
  Layers,
  MapPin,
  Package,
  PackageX,
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
    { title: "Products", href: `${ADMIN_BASE}/products`, icon: Package },
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
    <div className="space-y-8">
      {/* ═══════════════════════════════════════════════════════════
          HEADER
      ═══════════════════════════════════════════════════════════ */}
      <Stagger index={0}>
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              {getGreeting()},{" "}
              <span className="text-primary">{userName}</span>
            </h1>
            <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
              <span>{formattedDate}</span>
              <span className="flex items-center gap-1.5">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
                Live
              </span>
            </div>
          </div>
        </div>
      </Stagger>

      {/* ═══════════════════════════════════════════════════════════
          PRIMARY KPIs — Hero Treatment
      ═══════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {/* Users */}
        <Stagger index={1}>
          <div className="group relative rounded-xl border bg-card p-5 transition-all hover:shadow-md border-l-4 border-l-indigo-500">
            <div className="flex items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 dark:bg-indigo-950/40">
                <Users className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <ArrowUp className="h-3.5 w-3.5 text-emerald-500 opacity-0 transition-opacity group-hover:opacity-100" />
            </div>
            <p className="mt-4 text-3xl font-bold tabular-nums tracking-tight">
              {isLoading ? <Pulse className="h-9 w-20" /> : formatNumber(s?.totalUsers || 0)}
            </p>
            <p className="mt-0.5 text-[13px] text-muted-foreground">Total Users</p>
            {!isLoading && (s?.newUsersToday || 0) > 0 && (
              <p className="mt-2 flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                <ArrowUp className="h-3 w-3" />
                +{s?.newUsersToday} today
              </p>
            )}
          </div>
        </Stagger>

        {/* Orders */}
        <Stagger index={2}>
          <div className="group relative rounded-xl border bg-card p-5 transition-all hover:shadow-md border-l-4 border-l-blue-500">
            <div className="flex items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-950/40">
                <ShoppingCart className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <ArrowUp className="h-3.5 w-3.5 text-emerald-500 opacity-0 transition-opacity group-hover:opacity-100" />
            </div>
            <p className="mt-4 text-3xl font-bold tabular-nums tracking-tight">
              {isLoading ? <Pulse className="h-9 w-20" /> : formatNumber(s?.totalOrders || 0)}
            </p>
            <p className="mt-0.5 text-[13px] text-muted-foreground">Total Orders</p>
            {!isLoading && (s?.ordersToday || 0) > 0 && (
              <p className="mt-2 flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                <ArrowUp className="h-3 w-3" />
                +{s?.ordersToday} today
              </p>
            )}
          </div>
        </Stagger>

        {/* Total Sales */}
        <Stagger index={3}>
          <div className="group relative rounded-xl border bg-card p-5 transition-all hover:shadow-md border-l-4 border-l-emerald-500">
            <div className="flex items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-950/40">
                <DollarSign className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <ArrowUp className="h-3.5 w-3.5 text-emerald-500 opacity-0 transition-opacity group-hover:opacity-100" />
            </div>
            <p className="mt-4 text-3xl font-bold tabular-nums tracking-tight">
              {isLoading ? <Pulse className="h-9 w-20" /> : formatCurrency(s?.totalGMV || 0)}
            </p>
            <p className="mt-0.5 text-[13px] text-muted-foreground">Total Sales</p>
            {!isLoading && (s?.revenueToday || 0) > 0 && (
              <p className="mt-2 flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                <ArrowUp className="h-3 w-3" />
                +{formatCurrency(s?.revenueToday || 0)} today
              </p>
            )}
          </div>
        </Stagger>

        {/* Subscriptions */}
        <Stagger index={4}>
          <div className="group relative rounded-xl border bg-card p-5 transition-all hover:shadow-md border-l-4 border-l-amber-500">
            <div className="flex items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 dark:bg-amber-950/40">
                <CreditCard className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
            </div>
            <p className="mt-4 text-3xl font-bold tabular-nums tracking-tight">
              {isLoading ? <Pulse className="h-9 w-20" /> : formatNumber(s?.subscriptions?.totalActive || 0)}
            </p>
            <p className="mt-0.5 text-[13px] text-muted-foreground">Subscriptions</p>
          </div>
        </Stagger>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          OPERATIONS OVERVIEW
      ═══════════════════════════════════════════════════════════ */}
      <Stagger index={5}>
        <div className="rounded-xl border bg-card">
          <div className="border-b px-5 py-3">
            <h2 className="text-sm font-semibold">Operations Overview</h2>
          </div>
          <div className="grid grid-cols-2 divide-x divide-y sm:grid-cols-4 sm:divide-y-0">
            {/* Pending */}
            <Link
              href={`${ADMIN_BASE}/orders?status=pending`}
              className="flex items-center gap-3 px-5 py-4 transition-colors hover:bg-muted/40"
            >
              <ClipboardList className="h-5 w-5 shrink-0 text-amber-500" />
              <div>
                <p className="text-xl font-bold tabular-nums text-amber-600 dark:text-amber-400">
                  {isLoading ? "–" : s?.pendingOrders || 0}
                </p>
                <p className="text-xs text-muted-foreground">Pending Orders</p>
              </div>
            </Link>

            {/* Cancelled */}
            <Link
              href={`${ADMIN_BASE}/orders?status=cancelled`}
              className="flex items-center gap-3 px-5 py-4 transition-colors hover:bg-muted/40"
            >
              <XCircle className="h-5 w-5 shrink-0 text-red-500" />
              <div>
                <p className="text-xl font-bold tabular-nums text-red-600 dark:text-red-400">
                  {isLoading ? "–" : s?.cancelledTotal || 0}
                </p>
                <p className="text-xs text-muted-foreground">
                  Cancelled
                  {!isLoading && (s?.cancelledToday || 0) > 0 && (
                    <span className="ml-1 text-red-500">({s?.cancelledToday} today)</span>
                  )}
                </p>
              </div>
            </Link>

            {/* Unassigned */}
            <Link
              href={`${ADMIN_BASE}/invoices`}
              className="flex items-center gap-3 px-5 py-4 transition-colors hover:bg-muted/40"
            >
              <FileText className="h-5 w-5 shrink-0 text-purple-500" />
              <div>
                <p className="text-xl font-bold tabular-nums text-purple-600 dark:text-purple-400">
                  {isLoading ? "–" : s?.pendingInvoices || 0}
                </p>
                <p className="text-xs text-muted-foreground">Unassigned</p>
              </div>
            </Link>

            {/* Active Deliveries */}
            <Link
              href={`${ADMIN_BASE}/delivery`}
              className="flex items-center gap-3 px-5 py-4 transition-colors hover:bg-muted/40"
            >
              <Truck className="h-5 w-5 shrink-0 text-cyan-500" />
              <div>
                <p className="text-xl font-bold tabular-nums text-cyan-600 dark:text-cyan-400">
                  {isLoading ? "–" : s?.activeDeliveries || 0}
                </p>
                <p className="text-xs text-muted-foreground">
                  In Delivery
                  {!isLoading && (s?.deliveriesToday || 0) > 0 && (
                    <span className="ml-1 text-emerald-500">({s?.deliveriesToday} done)</span>
                  )}
                </p>
              </div>
            </Link>
          </div>
        </div>
      </Stagger>

      {/* ═══════════════════════════════════════════════════════════
          B2B vs B2C  |  USER DISTRIBUTION
      ═══════════════════════════════════════════════════════════ */}
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Order Channels */}
        <Stagger index={6}>
          <div className="rounded-xl border bg-card p-5">
            <h2 className="text-sm font-semibold">Order Channels</h2>
            <div className="mt-4 space-y-3">
              {/* Progress bar */}
              <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted/50">
                <div
                  className="rounded-l-full bg-violet-500 transition-all duration-700"
                  style={{ width: `${b2bPercent}%` }}
                />
                <div
                  className="rounded-r-full bg-sky-400 transition-all duration-700"
                  style={{ width: `${100 - b2bPercent}%` }}
                />
              </div>
              {/* Labels */}
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-violet-500" />
                  <span className="text-muted-foreground">B2B</span>
                  <span className="font-bold tabular-nums">
                    {isLoading ? "–" : formatNumber(s?.b2bOrders || 0)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold tabular-nums">
                    {isLoading ? "–" : formatNumber(s?.b2cOrders || 0)}
                  </span>
                  <span className="text-muted-foreground">B2C</span>
                  <span className="h-2.5 w-2.5 rounded-full bg-sky-400" />
                </div>
              </div>
            </div>
          </div>
        </Stagger>

        {/* User Distribution */}
        <Stagger index={7}>
          <div className="rounded-xl border bg-card p-5">
            <h2 className="text-sm font-semibold">User Distribution</h2>
            <div className="mt-4 space-y-2.5">
              {[
                { label: "Consumers", value: s?.totalConsumers || 0, icon: Users, color: "text-blue-500" },
                { label: "Retailers", value: s?.totalRetailers || 0, icon: Store, color: "text-green-500" },
                { label: "Wholesalers", value: s?.totalWholesalers || 0, icon: ShoppingBag, color: "text-violet-500" },
                { label: "Warehouses", value: s?.totalWarehouses || 0, icon: Warehouse, color: "text-teal-500" },
                { label: "Riders", value: s?.totalDeliverymen || 0, icon: Bike, color: "text-orange-500" },
                { label: "Admins", value: s?.totalAdmins || 0, icon: Crown, color: "text-amber-500" },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <item.icon className={`h-4 w-4 ${item.color}`} />
                    <span className="text-sm text-muted-foreground">{item.label}</span>
                  </div>
                  <span className="text-sm font-bold tabular-nums">
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
        <div className="rounded-xl border bg-card">
          <div className="border-b px-5 py-3">
            <h2 className="text-sm font-semibold">Subscription Status</h2>
          </div>
          <div className="grid grid-cols-2 divide-x divide-y sm:grid-cols-4 sm:divide-y-0">
            {[
              { label: "Active", value: s?.subscriptions?.active || 0, dotColor: "bg-emerald-500" },
              { label: "Trial", value: s?.subscriptions?.freeTrial || 0, dotColor: "bg-sky-500" },
              { label: "Expiring Soon", value: s?.subscriptions?.expiringSoon || 0, dotColor: "bg-amber-500" },
              { label: "Expired", value: s?.subscriptions?.expired || 0, dotColor: "bg-red-500" },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-3 px-5 py-4">
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${item.dotColor}`} />
                <div>
                  <p className="text-xl font-bold tabular-nums">
                    {isLoading ? "–" : item.value}
                  </p>
                  <p className="text-xs text-muted-foreground">{item.label}</p>
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
          <div className="rounded-xl border bg-card p-5">
            <h2 className="text-sm font-semibold mb-3">Needs Attention</h2>
            <div className="flex flex-wrap gap-2">
              {attentionItems.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors hover:bg-muted/50"
                >
                  <span className={`flex h-6 w-6 items-center justify-center rounded-md text-xs font-bold ${item.bg} ${item.color}`}>
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
          PERFORMANCE HIGHLIGHT
      ═══════════════════════════════════════════════════════════ */}
      <Stagger index={10}>
        <div className="rounded-xl border bg-card">
          <div className="border-b px-5 py-3">
            <h2 className="text-sm font-semibold">Performance Highlights</h2>
          </div>
          <div className="grid grid-cols-3 divide-x">
            {/* Top Product */}
            <div className="px-5 py-4">
              <div className="flex items-center gap-2 mb-2">
                <Trophy className="h-4 w-4 text-amber-500" />
                <span className="text-xs font-medium text-muted-foreground">Top Product</span>
              </div>
              {isLoading ? (
                <Pulse className="h-5 w-24" />
              ) : s?.performance?.topProduct ? (
                <>
                  <p className="text-sm font-bold truncate">{s.performance.topProduct.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {s.performance.topProduct.value} units sold
                  </p>
                </>
              ) : (
                <p className="text-xs text-muted-foreground">No data</p>
              )}
            </div>

            {/* Top Supplier */}
            <div className="px-5 py-4">
              <div className="flex items-center gap-2 mb-2">
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
            <div className="px-5 py-4">
              <div className="flex items-center gap-2 mb-2">
                <MapPin className="h-4 w-4 text-green-500" />
                <span className="text-xs font-medium text-muted-foreground">Top Area</span>
              </div>
              {isLoading ? (
                <Pulse className="h-5 w-24" />
              ) : s?.performance?.topArea ? (
                <>
                  <p className="text-sm font-bold truncate">{s.performance.topArea.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {s.performance.topArea.orders} orders
                  </p>
                </>
              ) : (
                <p className="text-xs text-muted-foreground">No data</p>
              )}
            </div>
          </div>
        </div>
      </Stagger>

      {/* ═══════════════════════════════════════════════════════════
          QUICK ACTIONS — Professional grid
      ═══════════════════════════════════════════════════════════ */}
      <Stagger index={11}>
        <div className="rounded-xl border bg-card p-5">
          <h2 className="text-sm font-semibold mb-4">Quick Actions</h2>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
            {quickActions.map((action) => (
              <Link
                key={action.href}
                href={action.href}
                className="group flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition-colors hover:bg-muted/60"
              >
                <action.icon className="h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
                <span className="truncate text-[13px] font-medium text-muted-foreground transition-colors group-hover:text-foreground">
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
