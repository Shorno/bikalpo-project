"use client";

import {
  ArrowRightIcon,
  BanknoteIcon,
  BellIcon,
  BookOpenIcon,
  CalendarDaysIcon,
  ClipboardCheckIcon,
  DownloadIcon,
  Building2Icon,
  FileTextIcon,
  LockKeyholeIcon,
  PackageIcon,
  PackagePlusIcon,
  ReceiptIcon,
  RefreshCwIcon,
  ShoppingBagIcon,
  ShoppingCartIcon,
  TrendingDownIcon,
  UserRoundIcon,
  UsersIcon,
  WarehouseIcon,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { DaybookExpenseDialog } from "@/components/dashboard/daybook/daybook-expense-dialog";
import { DaybookFixedAssetDialog } from "@/components/dashboard/daybook/daybook-fixed-asset-dialog";
import { useDaybookExpenses } from "@/components/dashboard/daybook/use-daybook-expenses";
import { useDaybookFixedAssetPurchases } from "@/components/dashboard/daybook/use-daybook-fixed-assets";
import { Badge } from "@/components/ui/badge";
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
import { cn } from "@/lib/utils";

type DaybookVariant = "retailer" | "warehouse";

type Metric = {
  href: string;
  icon: ReactNode;
  label: string;
  note: string;
  tone: "amber" | "blue" | "emerald" | "slate";
  value: string;
};

type ActionItem = {
  href?: string;
  icon: ReactNode;
  kind?: "expense" | "fixedAsset";
  label: string;
  primary?: boolean;
};

type NotificationItem = {
  action: string;
  href: string;
  time: string;
  title: string;
};

type TransactionItem = {
  amount: string;
  reference: string;
  time: string;
  type: string;
};

type StockPanel = {
  action: string;
  href: string;
  items: string[];
  title: string;
};

type DaybookConfig = {
  activityLabel: string;
  activityNote: string;
  activityValue: string;
  basePath: string;
  businessUnit: string;
  closeSummary: Array<{ label: string; value: string }>;
  metrics: Metric[];
  notifications: NotificationItem[];
  quickActions: ActionItem[];
  stockPanels: StockPanel[];
  systemCash: number;
  transactions: TransactionItem[];
  unitLabel: string;
  validationChecks: Array<{ label: string; status: "done" | "warning" }>;
};

const money = (value: number) => `Tk ${value.toLocaleString("en-US")}`;

function moneyToNumber(value: string) {
  const parsed = Number.parseFloat(value.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

const timeLabel = (date: Date) =>
  date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });

const dateLabel = (date: Date) =>
  date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

const daybookConfigs: Record<DaybookVariant, DaybookConfig> = {
  retailer: {
    activityLabel: "Counter Staff Present",
    activityNote: "Store attendance is ready for staff module wiring.",
    activityValue: "3",
    basePath: "/dashboard",
    businessUnit: "Ratul Store",
    closeSummary: [
      { label: "Sales", value: money(45_000) },
      { label: "Orders", value: "25" },
      { label: "Collection", value: money(35_000) },
      { label: "Expense", value: money(10_000) },
    ],
    metrics: [
      {
        href: "/dashboard/orders",
        icon: <ShoppingBagIcon className="size-5" />,
        label: "Orders Today",
        note: "Retail purchase and sales orders",
        tone: "blue",
        value: "25",
      },
      {
        href: "/dashboard/sales",
        icon: <ReceiptIcon className="size-5" />,
        label: "Sales Today",
        note: "Recorded sales value",
        tone: "emerald",
        value: money(45_000),
      },
      {
        href: "/dashboard/orders",
        icon: <PackagePlusIcon className="size-5" />,
        label: "Purchases Today",
        note: "Purchase orders and stock intake",
        tone: "amber",
        value: money(8_500),
      },
      {
        href: "/dashboard/finance",
        icon: <BanknoteIcon className="size-5" />,
        label: "Financial Position",
        note: "Cash balance after expense",
        tone: "slate",
        value: money(15_000),
      },
    ],
    notifications: [
      {
        action: "Accept Order",
        href: "/dashboard/incoming-orders",
        time: "10:30",
        title: "New order received from Rahim Store",
      },
      {
        action: "View Transaction",
        href: "/dashboard/finance/receivable",
        time: "10:15",
        title: "Payment received from Karim Traders",
      },
      {
        action: "Reorder Product",
        href: "/dashboard/stock/low",
        time: "09:50",
        title: "Low stock alert: Soybean Oil 5L",
      },
      {
        action: "View Purchase",
        href: "/dashboard/orders",
        time: "09:20",
        title: "Supplier order approved",
      },
      {
        action: "View Details",
        href: "/dashboard/orders/tracking",
        time: "08:45",
        title: "Delivery completed for order ORD102",
      },
    ],
    quickActions: [
      {
        href: "/dashboard/sales",
        icon: <ReceiptIcon className="size-4" />,
        label: "Sale",
        primary: true,
      },
      {
        href: "/dashboard/orders",
        icon: <PackageIcon className="size-4" />,
        label: "Create Purchase",
      },
      {
        href: "/dashboard/open-orders",
        icon: <FileTextIcon className="size-4" />,
        label: "Estimate",
      },
      {
        href: "/dashboard/finance/receivable",
        icon: <BanknoteIcon className="size-4" />,
        label: "Collect",
      },
      {
        icon: <TrendingDownIcon className="size-4" />,
        kind: "expense",
        label: "Expense",
      },
      {
        icon: <Building2Icon className="size-4" />,
        kind: "fixedAsset",
        label: "Fixed Asset",
      },
    ],
    stockPanels: [
      {
        action: "Reorder",
        href: "/dashboard/stock/low",
        items: ["Soybean Oil 5L - 2 pcs left", "Sugar 1KG - 5 pcs left"],
        title: "Low Stock Products",
      },
      {
        action: "View Stock",
        href: "/dashboard/stock/expired",
        items: ["Fresh Milk Pack - 2 days left", "Yogurt Cup - 3 days left"],
        title: "Expiring Soon Products",
      },
    ],
    systemCash: 15_000,
    transactions: [
      {
        amount: money(1_200),
        reference: "Invoice INV102",
        time: "10:00",
        type: "Customer Payment",
      },
      {
        amount: money(800),
        reference: "Purchase PUR101",
        time: "09:30",
        type: "Supplier Payment",
      },
      {
        amount: money(300),
        reference: "Transport Cost",
        time: "09:00",
        type: "Expense",
      },
    ],
    unitLabel: "Retailer",
    validationChecks: [
      { label: "Sales recorded", status: "done" },
      { label: "Payments updated", status: "done" },
      { label: "2 orders pending", status: "warning" },
      { label: "1 delivery failed", status: "warning" },
    ],
  },
  warehouse: {
    activityLabel: "Present Employees",
    activityNote: "Warehouse floor attendance snapshot.",
    activityValue: "6",
    basePath: "/warehouse/dashboard",
    businessUnit: "Rahim Distribution Hub",
    closeSummary: [
      { label: "Sales", value: money(62_500) },
      { label: "Orders", value: "18" },
      { label: "Collection", value: money(48_200) },
      { label: "Expense", value: money(12_400) },
    ],
    metrics: [
      {
        href: "/warehouse/dashboard/supply-orders",
        icon: <ShoppingBagIcon className="size-5" />,
        label: "Orders Today",
        note: "Warehouse supply movement",
        tone: "blue",
        value: "18",
      },
      {
        href: "/warehouse/dashboard/sales-history",
        icon: <ReceiptIcon className="size-5" />,
        label: "Sales Today",
        note: "POS and wholesale sales",
        tone: "emerald",
        value: money(62_500),
      },
      {
        href: "/warehouse/dashboard/purchases",
        icon: <PackagePlusIcon className="size-5" />,
        label: "Purchases Today",
        note: "Supplier purchase intake",
        tone: "amber",
        value: money(28_000),
      },
      {
        href: "/warehouse/dashboard/finance",
        icon: <BanknoteIcon className="size-5" />,
        label: "Financial Position",
        note: "Cash balance after expense",
        tone: "slate",
        value: money(22_300),
      },
    ],
    notifications: [
      {
        action: "Accept Order",
        href: "/warehouse/dashboard/supply-orders",
        time: "10:30",
        title: "New order received from Rahim Store",
      },
      {
        action: "View Transaction",
        href: "/warehouse/dashboard/transactions",
        time: "10:15",
        title: "Payment received from Karim Traders",
      },
      {
        action: "Reorder Product",
        href: "/warehouse/dashboard/stock",
        time: "09:50",
        title: "Low stock alert: Soybean Oil 5L",
      },
      {
        action: "View Purchase",
        href: "/warehouse/dashboard/purchases",
        time: "09:20",
        title: "Supplier order approved",
      },
      {
        action: "View Details",
        href: "/warehouse/dashboard/delivery-tracking",
        time: "08:45",
        title: "Delivery completed for order ORD102",
      },
    ],
    quickActions: [
      {
        href: "/warehouse/dashboard/pos",
        icon: <ReceiptIcon className="size-4" />,
        label: "Sale (POS)",
        primary: true,
      },
      {
        href: "/warehouse/dashboard/quick-purchase",
        icon: <PackageIcon className="size-4" />,
        label: "Create Purchase",
      },
      {
        href: "/warehouse/dashboard/estimates",
        icon: <FileTextIcon className="size-4" />,
        label: "Estimate",
      },
      {
        href: "/warehouse/dashboard/transactions",
        icon: <BanknoteIcon className="size-4" />,
        label: "Collect",
      },
      {
        icon: <TrendingDownIcon className="size-4" />,
        kind: "expense",
        label: "Expense",
      },
      {
        icon: <Building2Icon className="size-4" />,
        kind: "fixedAsset",
        label: "Fixed Asset",
      },
      {
        href: "/warehouse/dashboard/stock/add",
        icon: <PackagePlusIcon className="size-4" />,
        label: "Add Stock",
      },
    ],
    stockPanels: [
      {
        action: "Reorder",
        href: "/warehouse/dashboard/stock",
        items: ["Soybean Oil 5L - 2 pcs left", "Sugar 1KG - 5 pcs left"],
        title: "Low Stock Products",
      },
      {
        action: "View Stock",
        href: "/warehouse/dashboard/stock/expired",
        items: ["Fresh Milk Pack - 2 days left", "Yogurt Cup - 3 days left"],
        title: "Expiring Soon Products",
      },
    ],
    systemCash: 22_300,
    transactions: [
      {
        amount: money(12_000),
        reference: "Invoice INV102",
        time: "10:00",
        type: "Customer Payment",
      },
      {
        amount: money(8_000),
        reference: "Purchase PUR101",
        time: "09:30",
        type: "Supplier Payment",
      },
      {
        amount: money(3_000),
        reference: "Transport Cost",
        time: "09:00",
        type: "Expense",
      },
    ],
    unitLabel: "Warehouse",
    validationChecks: [
      { label: "Sales recorded", status: "done" },
      { label: "Payments updated", status: "done" },
      { label: "2 orders pending", status: "warning" },
      { label: "1 delivery failed", status: "warning" },
    ],
  },
};

export function DaybookKpiPage({ variant }: { variant: DaybookVariant }) {
  const config = daybookConfigs[variant];
  const savedExpenses = useDaybookExpenses(variant);
  const savedFixedAssetPurchases = useDaybookFixedAssetPurchases(variant);
  const [lastUpdated, setLastUpdated] = useState(() => new Date());
  const [expenseDialogOpen, setExpenseDialogOpen] = useState(false);
  const [fixedAssetDialogOpen, setFixedAssetDialogOpen] = useState(false);
  const [physicalCash, setPhysicalCash] = useState("");
  const savedExpenseTotal = useMemo(
    () => savedExpenses.reduce((sum, expense) => sum + expense.total, 0),
    [savedExpenses],
  );
  const savedFixedAssetTotal = useMemo(
    () =>
      savedFixedAssetPurchases.reduce(
        (sum, purchase) => sum + purchase.total,
        0,
      ),
    [savedFixedAssetPurchases],
  );
  const adjustedSystemCash =
    config.systemCash - savedExpenseTotal - savedFixedAssetTotal;
  const overviewMetrics = useMemo(
    () =>
      config.metrics.map((metric) =>
        metric.label === "Financial Position"
          ? { ...metric, value: money(adjustedSystemCash) }
          : metric,
      ),
    [adjustedSystemCash, config.metrics],
  );
  const closeSummary = useMemo(
    () =>
      config.closeSummary.map((line) =>
        line.label === "Expense"
          ? {
              ...line,
              value: money(moneyToNumber(line.value) + savedExpenseTotal),
            }
          : line,
      ),
    [config.closeSummary, savedExpenseTotal],
  );
  const snapshotTransactions = useMemo(() => {
    const expenseTransactions = savedExpenses
      .toSorted(
        (first, second) =>
          new Date(second.createdAt).getTime() -
          new Date(first.createdAt).getTime(),
      )
      .map((expense) => ({
        amount: money(expense.total),
        reference:
          expense.referenceNo ||
          expense.payee ||
          expense.lines[0]?.category ||
          expense.paymentAccountName,
        time: timeLabel(new Date(expense.createdAt)),
        type: "Expense",
      }));

    const fixedAssetTransactions = savedFixedAssetPurchases
      .toSorted(
        (first, second) =>
          new Date(second.createdAt).getTime() -
          new Date(first.createdAt).getTime(),
      )
      .map((purchase) => ({
        amount: money(purchase.total),
        reference:
          [
            purchase.lines[0]?.productName || purchase.lines[0]?.accountName,
            purchase.supplier,
            purchase.referenceNo || purchase.billNo,
          ]
            .filter(Boolean)
            .join(" - ") || purchase.paymentAccountName,
        time: timeLabel(new Date(purchase.createdAt)),
        type: "Fixed Asset Purchase",
      }));

    return [...fixedAssetTransactions, ...expenseTransactions, ...config.transactions];
  }, [config.transactions, savedExpenses, savedFixedAssetPurchases]);
  const cashDifference = useMemo(() => {
    const parsedCash = Number(physicalCash.replace(/,/g, ""));
    return Number.isFinite(parsedCash) && physicalCash.trim()
      ? parsedCash - adjustedSystemCash
      : 0;
  }, [adjustedSystemCash, physicalCash]);

  return (
    <div className="min-h-screen bg-slate-50/60 px-4 py-5 print:bg-white sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
        <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-slate-200 border-b px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                <BookOpenIcon className="size-5" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="font-semibold text-2xl text-slate-950">
                    Business Daybook
                  </h1>
                  <Badge
                    variant="outline"
                    className="h-6 rounded-md px-2 text-slate-600"
                  >
                    Daily Business Control Center
                  </Badge>
                </div>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-slate-600 text-sm">
                  <span className="inline-flex items-center gap-1.5">
                    <WarehouseIcon className="size-3.5" />
                    Business Unit: {config.businessUnit}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarDaysIcon className="size-3.5" />
                    {dateLabel(lastUpdated)}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <RefreshCwIcon className="size-3.5" />
                    Last updated {timeLabel(lastUpdated)} auto
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Badge className="h-8 rounded-md bg-slate-100 px-3 text-slate-700 hover:bg-slate-100">
                Language: EN / BN
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setLastUpdated(new Date())}
              >
                <RefreshCwIcon data-icon="inline-start" />
                Refresh
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.print()}
              >
                <DownloadIcon data-icon="inline-start" />
                Export Report
              </Button>
            </div>
          </div>

          <div className="grid gap-3 px-4 py-3 md:grid-cols-3">
            <ControlSelect label="Date" value="today" values={["Today"]} />
            <ControlSelect
              label="Unit"
              value={variant}
              values={[config.unitLabel]}
            />
            <ControlSelect label="User" value="all" values={["All"]} />
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <SectionHeader
            action={
              <Badge variant="outline" className="h-7 rounded-md">
                Quick Entry Ready
              </Badge>
            }
            icon={<ClipboardCheckIcon className="size-4" />}
            title="Daily Overview"
          />
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {overviewMetrics.map((metric) => (
              <OverviewCard key={metric.label} metric={metric} />
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <SectionHeader
            icon={<ShoppingCartIcon className="size-4" />}
            title="Quick Entry"
          />
          <div className="grid gap-2 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {config.quickActions.map((action) => (
              <QuickAction
                action={action}
                key={action.label}
                onFixedAssetClick={() => setFixedAssetDialogOpen(true)}
                onExpenseClick={() => setExpenseDialogOpen(true)}
              />
            ))}
          </div>
        </section>

        <div className="grid gap-5 xl:grid-cols-[1.4fr_0.6fr]">
          <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
            <SectionHeader
              icon={<BellIcon className="size-4" />}
              title="Action Notifications"
            />
            <SimpleTable
              headers={["Time", "Activity / Notification", "Action"]}
              rows={config.notifications.map((item) => [
                item.time,
                item.title,
                <Link
                  key={`${item.time}-${item.action}`}
                  href={item.href}
                  className="inline-flex items-center gap-1 font-medium text-blue-700 text-sm hover:underline"
                >
                  {item.action}
                  <ArrowRightIcon className="size-3.5" />
                </Link>,
              ])}
            />
          </section>

          <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
            <SectionHeader
              icon={<UsersIcon className="size-4" />}
              title="Employee Activity"
            />
            <div className="p-4">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-medium text-slate-500 text-sm">
                      {config.activityLabel}
                    </p>
                    <p className="mt-1 font-semibold text-3xl text-slate-950">
                      {config.activityValue}
                    </p>
                  </div>
                  <div className="flex size-11 items-center justify-center rounded-lg bg-white text-slate-600 shadow-sm">
                    <UserRoundIcon className="size-5" />
                  </div>
                </div>
                <p className="mt-3 text-slate-500 text-xs">
                  {config.activityNote}
                </p>
              </div>
            </div>
          </section>
        </div>

        <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <SectionHeader
            icon={<BanknoteIcon className="size-4" />}
            title="Finance & Accounts Snapshot"
          />
          <SimpleTable
            headers={["Time", "Transaction Type", "Amount", "Reference"]}
            rows={snapshotTransactions.map((item) => [
              item.time,
              item.type,
              <span
                key={`${item.time}-${item.amount}`}
                className="font-semibold text-slate-950"
              >
                {item.amount}
              </span>,
              item.reference,
            ])}
          />
        </section>

        <section className="flex flex-col gap-3">
          <SectionHeader
            icon={<PackageIcon className="size-4" />}
            title="Stock Alerts"
          />
          <div className="grid gap-5 lg:grid-cols-2">
            {config.stockPanels.map((panel) => (
              <StockAlertCard key={panel.title} panel={panel} />
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <SectionHeader
            icon={<LockKeyholeIcon className="size-4" />}
            title="Close Day"
          />
          <div className="grid gap-5 p-4 lg:grid-cols-[1fr_0.85fr]">
            <div className="space-y-4">
              <Badge className="h-7 rounded-md bg-emerald-100 px-3 text-emerald-800 hover:bg-emerald-100">
                Status: Not Closed
              </Badge>
              <div className="grid gap-2">
                {closeSummary.map((line) => (
                  <SummaryLine
                    key={line.label}
                    label={line.label}
                    value={line.value}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-lg border border-slate-200 p-3">
                <h3 className="font-semibold text-slate-950 text-sm">
                  Validation Check
                </h3>
                <div className="mt-3 grid gap-2">
                  {config.validationChecks.map((check) => (
                    <div
                      key={check.label}
                      className="flex items-center justify-between gap-3 text-sm"
                    >
                      <span className="text-slate-700">{check.label}</span>
                      <Badge
                        className={cn(
                          "h-6 rounded-md px-2",
                          check.status === "done"
                            ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-100"
                            : "bg-amber-100 text-amber-800 hover:bg-amber-100",
                        )}
                      >
                        {check.status === "done" ? "Done" : "Warning"}
                      </Badge>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-slate-500 text-xs">
                  Warning only, not blocking.
                </p>
              </div>

              <div className="rounded-lg border border-slate-200 p-3">
                <h3 className="font-semibold text-slate-950 text-sm">
                  Cash Check
                </h3>
                <div className="mt-3 grid gap-3">
                  <SummaryLine
                    label="System Cash"
                    value={money(adjustedSystemCash)}
                  />
                  <div className="grid gap-1">
                    <label
                      className="font-medium text-slate-600 text-sm"
                      htmlFor={`${variant}-physical-cash`}
                    >
                      Physical Cash
                    </label>
                    <Input
                      id={`${variant}-physical-cash`}
                      inputMode="decimal"
                      placeholder="Enter counted cash"
                      value={physicalCash}
                      onChange={(event) => setPhysicalCash(event.target.value)}
                    />
                  </div>
                  <SummaryLine
                    label="Difference"
                    value={money(cashDifference)}
                    valueClassName={
                      cashDifference === 0
                        ? "text-emerald-700"
                        : "text-amber-700"
                    }
                  />
                </div>
              </div>

              <Button className="w-full">
                <LockKeyholeIcon data-icon="inline-start" />
                Close Day
              </Button>
            </div>
          </div>
        </section>
      </div>
      <DaybookExpenseDialog
        onOpenChange={setExpenseDialogOpen}
        open={expenseDialogOpen}
        scope={variant}
      />
      <DaybookFixedAssetDialog
        onOpenChange={setFixedAssetDialogOpen}
        open={fixedAssetDialogOpen}
        scope={variant}
      />
    </div>
  );
}

function ControlSelect({
  label,
  value,
  values,
}: {
  label: string;
  value: string;
  values: string[];
}) {
  return (
    <div className="grid gap-1.5">
      <span className="font-medium text-slate-500 text-xs uppercase">
        {label}
      </span>
      <Select value={value}>
        <SelectTrigger className="w-full bg-white">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {values.map((item) => (
            <SelectItem key={item} value={item.toLowerCase()}>
              {item}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function SectionHeader({
  action,
  icon,
  title,
}: {
  action?: ReactNode;
  icon: ReactNode;
  title: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-slate-200 border-b px-4 py-3">
      <div className="flex items-center gap-2">
        <span className="flex size-8 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
          {icon}
        </span>
        <h2 className="font-semibold text-slate-950 text-sm uppercase">
          {title}
        </h2>
      </div>
      {action}
    </div>
  );
}

function OverviewCard({ metric }: { metric: Metric }) {
  const toneClass = {
    amber: "bg-amber-50 text-amber-700 ring-amber-200",
    blue: "bg-blue-50 text-blue-700 ring-blue-200",
    emerald: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    slate: "bg-slate-100 text-slate-700 ring-slate-200",
  }[metric.tone];

  return (
    <Link
      href={metric.href}
      className="group rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition hover:border-blue-200 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-slate-500 text-sm">{metric.label}</p>
          <p className="mt-2 truncate font-semibold text-2xl text-slate-950">
            {metric.value}
          </p>
          <p className="mt-1 text-slate-500 text-xs">{metric.note}</p>
        </div>
        <span
          className={cn(
            "flex size-11 shrink-0 items-center justify-center rounded-lg ring-1",
            toneClass,
          )}
        >
          {metric.icon}
        </span>
      </div>
    </Link>
  );
}

function QuickAction({
  action,
  onFixedAssetClick,
  onExpenseClick,
}: {
  action: ActionItem;
  onFixedAssetClick: () => void;
  onExpenseClick: () => void;
}) {
  if (action.kind === "expense") {
    return (
      <Button
        className={cn(
          "h-10 justify-start rounded-lg",
          !action.primary && "bg-slate-100 text-slate-800 hover:bg-slate-200",
        )}
        onClick={onExpenseClick}
        type="button"
        variant={action.primary ? "default" : "secondary"}
      >
        {action.icon}
        {action.label}
      </Button>
    );
  }

  if (action.kind === "fixedAsset") {
    return (
      <Button
        className={cn(
          "h-10 justify-start rounded-lg",
          !action.primary && "bg-slate-100 text-slate-800 hover:bg-slate-200",
        )}
        onClick={onFixedAssetClick}
        type="button"
        variant={action.primary ? "default" : "secondary"}
      >
        {action.icon}
        {action.label}
      </Button>
    );
  }

  return (
    <Button
      asChild
      className={cn(
        "h-10 justify-start rounded-lg",
        !action.primary && "bg-slate-100 text-slate-800 hover:bg-slate-200",
      )}
      variant={action.primary ? "default" : "secondary"}
    >
      <Link href={action.href ?? "#"}>
        {action.icon}
        {action.label}
      </Link>
    </Button>
  );
}

function SimpleTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: ReactNode[][];
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          {headers.map((header) => (
            <TableHead key={header}>{header}</TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row, index) => (
          <TableRow key={`${index}-${row[0]}`}>
            {row.map((cell, cellIndex) => (
              <TableCell key={`${index}-${headers[cellIndex] ?? cellIndex}`}>
                {cell}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function StockAlertCard({ panel }: { panel: StockPanel }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-slate-950">{panel.title}</h3>
          <div className="mt-3 grid gap-2 text-slate-700 text-sm">
            {panel.items.map((item) => (
              <div
                key={item}
                className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2"
              >
                {item}
              </div>
            ))}
          </div>
        </div>
        <PackageIcon className="size-5 shrink-0 text-slate-400" />
      </div>
      <Button asChild variant="outline" className="mt-4 w-full">
        <Link href={panel.href}>{panel.action}</Link>
      </Button>
    </div>
  );
}

function SummaryLine({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md bg-slate-50 px-3 py-2 text-sm">
      <span className="text-slate-600">{label}</span>
      <span className={cn("font-semibold text-slate-950", valueClassName)}>
        {value}
      </span>
    </div>
  );
}
