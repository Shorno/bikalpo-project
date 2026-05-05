"use client";

import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  Banknote,
  Bell,
  BookOpenIcon,
  CalendarDays,
  Download,
  FileText,
  LockKeyhole,
  Package,
  PackagePlus,
  Receipt,
  RefreshCw,
  ShoppingBag,
  ShoppingCart,
  TrendingDown,
  UserRound,
  Users,
  Warehouse,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { orpc } from "@/utils/orpc";

const WH = "/warehouse/dashboard";

type RecentSale = {
  id: number;
  invoiceNo: string;
  saleType: "retail" | "wholesale";
  customerName: string;
  total: string;
  paid: string;
  due: string;
  paymentMethod: string;
  createdAt: string | Date;
};

type PurchaseRow = {
  id: number;
  purchaseNumber: string;
  total: string;
  purchaseDate: string;
  createdAt: string | Date;
  supplier?: { name?: string | null } | null;
};

type ExpenseRow = {
  id: number;
  expenseNumber: string;
  title: string;
  amount: string;
  paymentDate: string;
  paymentMethod: string;
  category?: { name?: string | null } | null;
};

function todayKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isSameLocalDay(value: string | Date | null | undefined, key: string) {
  if (!value) return false;
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value === key;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  return todayKey(date) === key;
}

function toNumber(value: string | number | null | undefined) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (!value) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function money(value: string | number | null | undefined) {
  return `\u09F3${toNumber(value).toLocaleString("en-US", {
    maximumFractionDigits: 2,
  })}`;
}

function timeLabel(value: string | Date) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function dateLabel(value: Date) {
  return value.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function WarehouseDaybookPage() {
  const [lastUpdated, setLastUpdated] = useState(() => new Date());
  const today = todayKey();
  const { data: session, isPending: sessionLoading } = authClient.useSession();
  const user = session?.user as any;

  const statsQuery = useQuery({
    queryKey: ["warehouse", "getDashboardStats"],
    queryFn: () => orpc.warehouse.getDashboardStats.call({}),
  });

  const salesQuery = useQuery({
    queryKey: ["warehousePos", "recentSales", "daybook"],
    queryFn: () => orpc.warehousePos.listRecentSales.call({ limit: 50 }),
  });

  const purchasesQuery = useQuery({
    queryKey: ["purchase", "list", "daybook"],
    queryFn: () => orpc.purchase.list.call({ limit: 50 }),
  });

  const expensesQuery = useQuery({
    queryKey: ["expense", "getExpenses", "daybook", today],
    queryFn: () =>
      orpc.expense.getExpenses.call({
        startDate: today,
        endDate: today,
        page: 1,
        limit: 50,
      }),
  });

  const recentSales = (salesQuery.data?.sales ?? []) as RecentSale[];
  const purchases = (purchasesQuery.data ?? []) as PurchaseRow[];
  const expenses = (expensesQuery.data?.expenses ?? []) as ExpenseRow[];

  const todaySales = useMemo(
    () => recentSales.filter((sale) => isSameLocalDay(sale.createdAt, today)),
    [recentSales, today],
  );

  const todayPurchases = useMemo(
    () =>
      purchases.filter(
        (purchase) =>
          isSameLocalDay(purchase.purchaseDate, today) ||
          isSameLocalDay(purchase.createdAt, today),
      ),
    [purchases, today],
  );

  const salesTotal = todaySales.reduce(
    (sum, sale) => sum + toNumber(sale.total),
    0,
  );
  const collectionTotal = todaySales.reduce(
    (sum, sale) => sum + toNumber(sale.paid),
    0,
  );
  const dueTotal = todaySales.reduce(
    (sum, sale) => sum + toNumber(sale.due),
    0,
  );
  const purchaseTotal = todayPurchases.reduce(
    (sum, purchase) => sum + toNumber(purchase.total),
    0,
  );
  const expenseTotal = expenses.reduce(
    (sum, expense) => sum + toNumber(expense.amount),
    0,
  );
  const cashPosition = collectionTotal - expenseTotal;
  const pendingOrders = Number(statsQuery.data?.pendingOrders ?? 0);

  const transactions = [
    ...todaySales.map((sale) => ({
      id: `sale-${sale.id}`,
      time: timeLabel(sale.createdAt),
      type:
        sale.saleType === "wholesale"
          ? "Wholesale POS sale"
          : "Retail POS sale",
      amount: money(sale.total),
      reference: sale.invoiceNo,
      href: `${WH}/sales-history`,
    })),
    ...todayPurchases.map((purchase) => ({
      id: `purchase-${purchase.id}`,
      time: timeLabel(purchase.createdAt || purchase.purchaseDate),
      type: "Supplier purchase",
      amount: money(purchase.total),
      reference: purchase.purchaseNumber,
      href: `${WH}/purchases`,
    })),
    ...expenses.map((expense) => ({
      id: `expense-${expense.id}`,
      time: "Today",
      type: expense.category?.name || "Expense",
      amount: money(expense.amount),
      reference: expense.title || expense.expenseNumber,
      href: `${WH}/finance/expenses`,
    })),
  ].slice(0, 8);

  const notifications = [
    pendingOrders > 0
      ? {
          id: "pending-orders",
          time: "Now",
          title: `${pendingOrders} supply order${pendingOrders === 1 ? "" : "s"} pending`,
          action: "Review orders",
          href: `${WH}/supply-orders`,
        }
      : null,
    dueTotal > 0
      ? {
          id: "due-sales",
          time: "Today",
          title: `${money(dueTotal)} POS due amount needs follow-up`,
          action: "View sales",
          href: `${WH}/sales-history`,
        }
      : null,
    statsQuery.data?.totalProducts
      ? {
          id: "stock-live",
          time: "Today",
          title: `${statsQuery.data.totalProducts} stock item${statsQuery.data.totalProducts === 1 ? "" : "s"} available in warehouse`,
          action: "View stock",
          href: `${WH}/stock`,
        }
      : null,
  ].filter(Boolean) as Array<{
    id: string;
    time: string;
    title: string;
    action: string;
    href: string;
  }>;

  const refreshDaybook = async () => {
    await Promise.all([
      statsQuery.refetch(),
      salesQuery.refetch(),
      purchasesQuery.refetch(),
      expensesQuery.refetch(),
    ]);
    setLastUpdated(new Date());
  };

  const isLoading =
    sessionLoading ||
    statsQuery.isLoading ||
    salesQuery.isLoading ||
    purchasesQuery.isLoading ||
    expensesQuery.isLoading;

  const businessName = user?.warehouseName || user?.name || "Warehouse";

  return (
    <div className="space-y-5 bg-slate-50/40 print:bg-white">
      <div className="rounded-lg border bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
              <BookOpenIcon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-slate-950">
                Business Daybook
              </h1>
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
                <span className="inline-flex items-center gap-1.5">
                  <Warehouse className="h-3.5 w-3.5" />
                  {sessionLoading ? (
                    <Skeleton className="h-4 w-36" />
                  ) : (
                    businessName
                  )}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays className="h-3.5 w-3.5" />
                  {dateLabel(new Date())}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <RefreshCw className="h-3.5 w-3.5" />
                  Last updated {timeLabel(lastUpdated)}
                </span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className="h-8 rounded-md px-3 font-medium"
            >
              Unit: Warehouse
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={refreshDaybook}
              disabled={isLoading}
            >
              <RefreshCw
                className={cn("h-4 w-4", isLoading && "animate-spin")}
              />
              Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Download className="h-4 w-4" />
              Export Report
            </Button>
          </div>
        </div>

        <div className="grid gap-3 px-4 py-3 md:grid-cols-3">
          <ControlPill label="Date" value="Today" />
          <ControlPill label="Unit" value="Warehouse" />
          <ControlPill label="User" value={user?.name || "All"} />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <OverviewCard
          href={`${WH}/supply-orders`}
          icon={<ShoppingBag className="h-5 w-5" />}
          label="Orders Today"
          value={
            statsQuery.isLoading
              ? null
              : String(statsQuery.data?.totalOrders ?? 0)
          }
          tone="blue"
        />
        <OverviewCard
          href={`${WH}/sales-history`}
          icon={<Receipt className="h-5 w-5" />}
          label="Sales Today"
          value={salesQuery.isLoading ? null : money(salesTotal)}
          tone="emerald"
        />
        <OverviewCard
          href={`${WH}/purchases`}
          icon={<PackagePlus className="h-5 w-5" />}
          label="Purchases Today"
          value={purchasesQuery.isLoading ? null : money(purchaseTotal)}
          tone="amber"
        />
        <OverviewCard
          href={`${WH}/finance`}
          icon={<Banknote className="h-5 w-5" />}
          label="Financial Position"
          value={
            expensesQuery.isLoading || salesQuery.isLoading
              ? null
              : money(cashPosition)
          }
          tone="slate"
        />
      </div>

      <section className="rounded-lg border bg-white shadow-sm">
        <SectionTitle
          icon={<ShoppingCart className="h-4 w-4" />}
          title="Quick Entry"
        />
        <div className="grid gap-2 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <QuickAction
            href={`${WH}/pos`}
            icon={<Receipt className="h-4 w-4" />}
            label="Sale (POS)"
            primary
          />
          <QuickAction
            href={`${WH}/supply-orders`}
            icon={<Package className="h-4 w-4" />}
            label="Create Order"
          />
          <QuickAction
            href={`${WH}/sales`}
            icon={<FileText className="h-4 w-4" />}
            label="Estimate"
          />
          <QuickAction
            href={`${WH}/transactions`}
            icon={<Banknote className="h-4 w-4" />}
            label="Collect"
          />
          <QuickAction
            href={`${WH}/stock/add`}
            icon={<PackagePlus className="h-4 w-4" />}
            label="Add Stock"
          />
          <QuickAction
            href={`${WH}/finance/expenses`}
            icon={<TrendingDown className="h-4 w-4" />}
            label="Expense"
          />
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-lg border bg-white shadow-sm">
          <SectionTitle
            icon={<Bell className="h-4 w-4" />}
            title="Action Notifications"
          />
          <DataTable
            emptyTitle="No urgent warehouse tasks for today"
            headers={["Time", "Activity / Notification", "Action"]}
            rows={notifications.map((item) => [
              item.time,
              item.title,
              <Link
                key={item.id}
                href={item.href}
                className="inline-flex items-center gap-1 text-sm font-medium text-blue-700 hover:underline"
              >
                {item.action}
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>,
            ])}
          />
        </section>

        <section className="rounded-lg border bg-white shadow-sm">
          <SectionTitle
            icon={<Users className="h-4 w-4" />}
            title="Employee Activity"
          />
          <div className="p-4">
            <div className="rounded-lg border bg-slate-50 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500">
                    Present Employees
                  </p>
                  <p className="mt-1 text-3xl font-bold text-slate-950">0</p>
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-white text-slate-600 shadow-sm">
                  <UserRound className="h-5 w-5" />
                </div>
              </div>
              <p className="mt-3 text-xs text-slate-500">
                Attendance data is not connected yet.
              </p>
            </div>
          </div>
        </section>
      </div>

      <section className="rounded-lg border bg-white shadow-sm">
        <SectionTitle
          icon={<Banknote className="h-4 w-4" />}
          title="Finance & Accounts Snapshot"
        />
        <DataTable
          emptyTitle="No sales, purchases, or expenses recorded today"
          headers={["Time", "Transaction Type", "Amount", "Reference"]}
          rows={transactions.map((item) => [
            item.time,
            item.type,
            <span
              key={`${item.id}-amount`}
              className="font-semibold text-slate-950"
            >
              {item.amount}
            </span>,
            <Link
              key={item.id}
              href={item.href}
              className="font-medium text-blue-700 hover:underline"
            >
              {item.reference}
            </Link>,
          ])}
        />
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <StockAlertCard
          title="Low Stock Products"
          description="Low-stock product details are available from stock control."
          href={`${WH}/stock`}
          action="View stock"
        />
        <StockAlertCard
          title="Expiring Soon Products"
          description="Expiry tracking is available from the expired products page."
          href={`${WH}/stock/expired`}
          action="View expiry"
        />
      </div>

      <section className="rounded-lg border bg-white shadow-sm">
        <SectionTitle
          icon={<LockKeyhole className="h-4 w-4" />}
          title="Close Day"
        />
        <div className="grid gap-5 p-4 lg:grid-cols-[1fr_0.8fr]">
          <div className="space-y-3">
            <Badge className="rounded-md bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
              Not Closed
            </Badge>
            <div className="grid gap-2 text-sm">
              <SummaryLine label="Sales" value={money(salesTotal)} />
              <SummaryLine
                label="Orders"
                value={String(statsQuery.data?.totalOrders ?? 0)}
              />
              <SummaryLine label="Collection" value={money(collectionTotal)} />
              <SummaryLine label="Expense" value={money(expenseTotal)} />
            </div>
          </div>

          <div className="rounded-lg border bg-white p-4">
            <h3 className="text-sm font-semibold text-slate-950">Cash Check</h3>
            <SummaryLine
              label="System Cash"
              value={money(cashPosition)}
              className="mt-3"
            />
            <label
              className="mt-3 block text-xs font-medium text-slate-500"
              htmlFor="physical-cash"
            >
              Physical Cash
            </label>
            <input
              id="physical-cash"
              className="mt-1 h-9 w-full rounded-md border bg-white px-3 text-sm outline-none focus:border-slate-400"
              placeholder="Enter amount"
              inputMode="decimal"
            />
            <Button className="mt-4 w-full" type="button">
              <LockKeyhole className="h-4 w-4" />
              Close Day
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}

function ControlPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex h-10 items-center justify-between rounded-md border bg-slate-50 px-3 text-sm">
      <span className="font-medium text-slate-500">{label}</span>
      <span className="font-semibold text-slate-900">{value}</span>
    </div>
  );
}

function OverviewCard({
  href,
  icon,
  label,
  value,
  tone,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  value: string | null;
  tone: "blue" | "emerald" | "amber" | "slate";
}) {
  const tones = {
    blue: "bg-blue-50 text-blue-700",
    emerald: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    slate: "bg-slate-100 text-slate-700",
  };

  return (
    <Link
      href={href}
      className="rounded-lg border bg-white p-4 shadow-sm transition-colors hover:border-slate-300"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          {value === null ? (
            <Skeleton className="mt-2 h-8 w-24" />
          ) : (
            <p className="mt-1 text-2xl font-bold tabular-nums text-slate-950">
              {value}
            </p>
          )}
        </div>
        <div
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-lg",
            tones[tone],
          )}
        >
          {icon}
        </div>
      </div>
    </Link>
  );
}

function SectionTitle({
  icon,
  title,
}: {
  icon: React.ReactNode;
  title: string;
}) {
  return (
    <div className="flex items-center gap-2 border-b px-4 py-3">
      <div className="text-slate-500">{icon}</div>
      <h2 className="text-sm font-bold uppercase tracking-wide text-slate-900">
        {title}
      </h2>
    </div>
  );
}

function QuickAction({
  href,
  icon,
  label,
  primary = false,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  primary?: boolean;
}) {
  return (
    <Button
      asChild
      variant={primary ? "default" : "outline"}
      className="justify-start"
    >
      <Link href={href}>
        {icon}
        {label}
      </Link>
    </Button>
  );
}

function DataTable({
  headers,
  rows,
  emptyTitle,
}: {
  headers: string[];
  rows: React.ReactNode[][];
  emptyTitle: string;
}) {
  if (rows.length === 0) {
    return (
      <div className="p-8 text-center">
        <p className="text-sm font-medium text-slate-500">{emptyTitle}</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50 text-left">
            {headers.map((header) => (
              <th
                key={header}
                className="whitespace-nowrap px-4 py-2.5 text-xs font-semibold text-slate-500"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="hover:bg-slate-50/70">
              {row.map((cell, cellIndex) => (
                <td
                  key={cellIndex}
                  className="whitespace-nowrap px-4 py-3 text-slate-700"
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StockAlertCard({
  title,
  description,
  href,
  action,
}: {
  title: string;
  description: string;
  href: string;
  action: string;
}) {
  return (
    <section className="rounded-lg border bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-slate-950">{title}</h2>
          <p className="mt-2 text-sm text-slate-500">{description}</p>
        </div>
        <Package className="h-5 w-5 text-amber-600" />
      </div>
      <Button asChild variant="outline" size="sm" className="mt-4">
        <Link href={href}>
          {action}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </Button>
    </section>
  );
}

function SummaryLine({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 text-sm",
        className,
      )}
    >
      <span className="text-slate-500">{label}</span>
      <span className="font-semibold tabular-nums text-slate-950">{value}</span>
    </div>
  );
}
