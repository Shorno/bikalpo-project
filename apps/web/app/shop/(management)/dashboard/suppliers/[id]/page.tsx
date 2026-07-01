"use client";

import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Building2,
  Mail,
  MapPin,
  Phone,
  ShoppingCart,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useSupplierDetail } from "@/hooks/use-shop-owner-api";

type SupplierDetailData = {
  identity: {
    warehouseId: string;
    name: string;
    phone: string | null;
    email: string | null;
    address: string | null;
    connectionStatus: string | null;
    connectedAt: string | Date | null;
    lastOrderedAt: string | Date | null;
  };
  business: {
    name: string;
    phone: string | null;
    email: string | null;
    location: string | null;
    yourShopName: string | null;
    yourAddress: string | null;
  };
  orderStats: {
    total: number;
    pending: number;
    confirmed: number;
    processing: number;
    delivered: number;
    cancelled: number;
  };
  salesman: {
    name: string;
    phone: string | null;
    status: "active" | "inactive";
  } | null;
  delivery: {
    scope: "matched_area" | "warehouse" | "none";
    matchSource: string | null;
    yourAddress: string | null;
    areaHint: string | null;
    matchedArea: {
      id: number;
      name: string;
      description: string | null;
    } | null;
    availableAreas: string[];
    weeklyDays: Array<{
      dayOfWeek: number;
      dayName: string;
      areaNames: string[];
      riderName: string | null;
      riderPhone: string | null;
    }>;
    hasDeliveryToday: boolean;
    todayDayName: string;
    nextDelivery: {
      dayOfWeek: number;
      dayName: string;
      date: string;
      offsetDays: number;
    } | null;
    cutoffTime: string | null;
  };
  accountSummary: {
    totalPurchase: number;
    paid: number;
    payable: number;
    payableOrders: number;
  };
  purchaseHistory: Array<{
    id: number;
    orderNumber: string;
    date: string | Date;
    productSummary: string;
    amount: number;
    orderStatus: string;
    paymentStatus: "paid" | "due" | "pending";
    dueAmount: number;
  }>;
  quickInfo: {
    lastOrderNumber: string | null;
    lastOrderStatus: string | null;
    pendingOrders: number;
    activeOrders: number;
    payableOrders: number;
    lastDeliveredAt: string | Date | null;
  };
  pendingOrders: Array<{
    id: number;
    orderNumber: string;
    status: string;
    createdAt: string | Date;
    total: string | number;
    items: Array<{
      id: number;
      productName: string;
      quantity: number;
      modifiedQty: number | null;
    }>;
  }>;
};

const WEEKDAY_LABELS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

const orderStatusStyles: Record<string, string> = {
  pending: "border-amber-200 bg-amber-50 text-amber-700",
  confirmed: "border-sky-200 bg-sky-50 text-sky-700",
  processing: "border-indigo-200 bg-indigo-50 text-indigo-700",
  delivered: "border-emerald-200 bg-emerald-50 text-emerald-700",
  cancelled: "border-rose-200 bg-rose-50 text-rose-700",
  returned: "border-slate-200 bg-slate-100 text-slate-700",
};

const paymentStatusStyles: Record<string, string> = {
  paid: "border-emerald-200 bg-emerald-50 text-emerald-700",
  due: "border-rose-200 bg-rose-50 text-rose-700",
  pending: "border-amber-200 bg-amber-50 text-amber-700",
};

function formatCurrency(value: number) {
  return `Tk ${value.toLocaleString("en-BD")}`;
}

function formatDate(value: string | Date | null) {
  if (!value) return "Not available";

  return new Date(value).toLocaleDateString("en-BD", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatShortDate(value: string | Date | null) {
  if (!value) return "Not available";

  return new Date(value).toLocaleDateString("en-BD", {
    day: "numeric",
    month: "short",
  });
}

function formatLabel(value: string | null | undefined) {
  if (!value) return "Not available";

  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function describeNextDelivery(
  nextDelivery: SupplierDetailData["delivery"]["nextDelivery"],
) {
  if (!nextDelivery) return "No delivery scheduled";

  if (nextDelivery.offsetDays === 1) {
    return `${nextDelivery.dayName} (Tomorrow)`;
  }

  return `${nextDelivery.dayName} - ${formatDate(nextDelivery.date)}`;
}

function buildMonthCalendar(scheduleDays: number[]) {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const offset = (firstDay.getDay() + 6) % 7;
  const cells: Array<{
    day: number | null;
    scheduled: boolean;
    today: boolean;
  }> = [];

  for (let i = 0; i < offset; i += 1) {
    cells.push({ day: null, scheduled: false, today: false });
  }

  for (let day = 1; day <= lastDay.getDate(); day += 1) {
    const current = new Date(year, month, day);
    cells.push({
      day,
      scheduled: scheduleDays.includes(current.getDay()),
      today: day === today.getDate(),
    });
  }

  return {
    label: firstDay.toLocaleDateString("en-BD", {
      month: "long",
      year: "numeric",
    }),
    cells,
  };
}

function StatCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "default" | "success" | "danger";
}) {
  const valueClass =
    tone === "danger"
      ? "text-rose-600"
      : tone === "success"
        ? "text-emerald-600"
        : "text-foreground";

  return (
    <Card className="border-border/70">
      <CardContent className="space-y-1 p-5">
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
          {label}
        </p>
        <p className={`text-2xl font-semibold tracking-tight ${valueClass}`}>
          {value}
        </p>
        {hint ? <p className="text-sm text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: string | number | null | undefined;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-2xl border border-border/60 px-4 py-3">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-right font-medium">{value || "Not available"}</p>
    </div>
  );
}

export default function SupplierDetailPage() {
  const params = useParams();
  const warehouseId = params.id as string;
  const { data, isLoading, isError } = useSupplierDetail(warehouseId);

  if (isLoading) return <DetailSkeleton />;

  if (isError || !data) {
    return (
      <div className="space-y-4">
        <Button asChild size="sm" variant="ghost">
          <Link href="/dashboard/suppliers">
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Back
          </Link>
        </Button>

        <Card>
          <CardContent className="p-12 text-center">
            <AlertCircle className="mx-auto mb-3 h-12 w-12 text-rose-300" />
            <p className="font-medium text-muted-foreground">
              Supplier details could not be loaded.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const detail = data as SupplierDetailData;
  const {
    identity,
    business,
    orderStats,
    salesman,
    delivery,
    accountSummary,
    purchaseHistory,
    quickInfo,
    pendingOrders,
  } = detail;

  const calendar = buildMonthCalendar(
    delivery.weeklyDays.map((day) => day.dayOfWeek),
  );
  const connectionLabel = formatLabel(identity.connectionStatus || "active");
  const hasPaymentFlow = false;

  return (
    <div className="space-y-6">
      <Button asChild size="sm" variant="ghost">
        <Link href="/dashboard/suppliers">
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          Back to Suppliers
        </Link>
      </Button>

      <Card className="border-border/70">
        <CardContent className="space-y-5 p-6">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-bold tracking-tight">
                  {identity.name}
                </h1>
                <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50">
                  {connectionLabel}
                </Badge>
                {accountSummary.payable > 0 ? (
                  <Badge className="border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-50">
                    {formatCurrency(accountSummary.payable)} due
                  </Badge>
                ) : null}
              </div>

              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                {identity.phone ? (
                  <span className="flex items-center gap-1.5">
                    <Phone className="h-4 w-4" />
                    {identity.phone}
                  </span>
                ) : null}
                {identity.email ? (
                  <span className="flex items-center gap-1.5">
                    <Mail className="h-4 w-4" />
                    {identity.email}
                  </span>
                ) : null}
                {identity.address ? (
                  <span className="flex items-center gap-1.5">
                    <MapPin className="h-4 w-4" />
                    {identity.address}
                  </span>
                ) : null}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm">
                <Link href="/dashboard/order-from-warehouse">
                  <ShoppingCart className="mr-1.5 h-3.5 w-3.5" />
                  Place Order
                </Link>
              </Button>
              {identity.phone ? (
                <Button asChild size="sm" variant="outline">
                  <a href={`tel:${identity.phone}`}>
                    <Phone className="mr-1.5 h-3.5 w-3.5" />
                    Contact Supplier
                  </a>
                </Button>
              ) : null}
              {identity.email ? (
                <Button asChild size="sm" variant="outline">
                  <a href={`mailto:${identity.email}`}>
                    <Mail className="mr-1.5 h-3.5 w-3.5" />
                    Email
                  </a>
                </Button>
              ) : null}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Total Purchase"
              value={formatCurrency(accountSummary.totalPurchase)}
              hint={`${orderStats.total} total orders`}
            />
            <StatCard
              label="Paid"
              value={formatCurrency(accountSummary.paid)}
              tone="success"
              hint={`${orderStats.delivered} delivered orders`}
            />
            <StatCard
              label="Payable"
              value={formatCurrency(accountSummary.payable)}
              tone={accountSummary.payable > 0 ? "danger" : "success"}
              hint={`${accountSummary.payableOrders} payable orders`}
            />
            <StatCard
              label="Active Orders"
              value={quickInfo.activeOrders}
              hint={`${quickInfo.pendingOrders} pending or processing`}
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-6">
          <Card className="border-border/70">
            <CardHeader>
              <CardTitle>Business Info</CardTitle>
              <CardDescription>
                Primary supplier profile from the retailer side.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <DetailRow label="Supplier Name" value={business.name} />
              <DetailRow label="Phone" value={business.phone} />
              <DetailRow label="Email" value={business.email} />
              <DetailRow label="Location" value={business.location} />
              <DetailRow
                label="Connected Since"
                value={formatDate(identity.connectedAt)}
              />
            </CardContent>
          </Card>

          <Card className="border-border/70">
            <CardHeader>
              <CardTitle>Purchase History</CardTitle>
              <CardDescription>
                Latest retailer purchases and payment condition.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {purchaseHistory.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No purchase history available yet.
                </p>
              ) : (
                <>
                  <div className="hidden overflow-hidden rounded-2xl border border-border/70 md:block">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="px-4">Date</TableHead>
                          <TableHead>Products</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="px-4">Payment</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {purchaseHistory.map((purchase) => (
                          <TableRow key={purchase.id}>
                            <TableCell className="px-4">
                              {formatShortDate(purchase.date)}
                            </TableCell>
                            <TableCell className="max-w-[18rem] whitespace-normal">
                              <div className="space-y-1">
                                <p className="font-medium">
                                  {purchase.productSummary}
                                </p>
                                <p className="font-mono text-xs text-muted-foreground">
                                  {purchase.orderNumber}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell>
                              {formatCurrency(purchase.amount)}
                            </TableCell>
                            <TableCell>
                              <Badge
                                className={`${orderStatusStyles[purchase.orderStatus] || "border-border bg-muted text-foreground"} hover:bg-current/5`}
                              >
                                {formatLabel(purchase.orderStatus)}
                              </Badge>
                            </TableCell>
                            <TableCell className="px-4">
                              <div className="space-y-1">
                                <Badge
                                  className={`${paymentStatusStyles[purchase.paymentStatus]} hover:bg-current/5`}
                                >
                                  {formatLabel(purchase.paymentStatus)}
                                </Badge>
                                {purchase.dueAmount > 0 ? (
                                  <p className="text-xs text-rose-600">
                                    Due {formatCurrency(purchase.dueAmount)}
                                  </p>
                                ) : null}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  <div className="grid gap-3 md:hidden">
                    {purchaseHistory.map((purchase) => (
                      <div
                        key={purchase.id}
                        className="rounded-2xl border border-border/70 px-4 py-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-medium">
                              {purchase.productSummary}
                            </p>
                            <p className="font-mono text-xs text-muted-foreground">
                              {purchase.orderNumber}
                            </p>
                          </div>
                          <p className="font-semibold">
                            {formatCurrency(purchase.amount)}
                          </p>
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <Badge
                            className={`${orderStatusStyles[purchase.orderStatus] || "border-border bg-muted text-foreground"} hover:bg-current/5`}
                          >
                            {formatLabel(purchase.orderStatus)}
                          </Badge>
                          <Badge
                            className={`${paymentStatusStyles[purchase.paymentStatus]} hover:bg-current/5`}
                          >
                            {formatLabel(purchase.paymentStatus)}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {formatShortDate(purchase.date)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/70">
            <CardHeader>
              <CardTitle>Pending Orders</CardTitle>
              <CardDescription>
                Active purchase orders waiting for completion.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {pendingOrders.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No active supplier orders right now.
                </p>
              ) : (
                pendingOrders.map((pendingOrder) => (
                  <div
                    key={pendingOrder.id}
                    className="rounded-2xl border border-border/70 px-4 py-3"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-mono text-sm font-semibold">
                            {pendingOrder.orderNumber}
                          </p>
                          <Badge
                            className={`${orderStatusStyles[pendingOrder.status] || "border-border bg-muted text-foreground"} hover:bg-current/5`}
                          >
                            {formatLabel(pendingOrder.status)}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {pendingOrder.items
                            .map(
                              (item) =>
                                `${item.productName} x ${item.modifiedQty ?? item.quantity}`,
                            )
                            .join(", ")}
                        </p>
                      </div>
                      <div className="text-sm">
                        <p className="font-semibold">
                          {formatCurrency(Number(pendingOrder.total))}
                        </p>
                        <p className="text-muted-foreground">
                          {formatShortDate(pendingOrder.createdAt)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="border-border/70">
            <CardHeader>
              <CardTitle>Assigned Salesman</CardTitle>
              <CardDescription>
                Retailer-facing contact if the warehouse has assigned one.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {salesman ? (
                <>
                  <DetailRow label="Name" value={salesman.name} />
                  <DetailRow label="Phone" value={salesman.phone} />
                  <DetailRow
                    label="Status"
                    value={salesman.status === "active" ? "Active" : "Inactive"}
                  />
                </>
              ) : (
                <div className="rounded-2xl border border-dashed border-border px-4 py-5 text-sm text-muted-foreground">
                  No salesman is assigned to this retailer for the selected
                  supplier yet.
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/70">
            <CardHeader>
              <CardTitle>Delivery Area Matching</CardTitle>
              <CardDescription>
                How the retailer address maps to the warehouse delivery setup.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <DetailRow
                label="Your Address"
                value={delivery.yourAddress || business.yourAddress}
              />
              <DetailRow label="Area Hint" value={delivery.areaHint} />
              <DetailRow
                label="Matched Delivery Zone"
                value={
                  delivery.matchedArea?.name || "No direct zone matched yet"
                }
              />
              {delivery.scope === "warehouse" ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  A warehouse-wide schedule exists, but no delivery zone matches
                  this retailer address yet.
                </div>
              ) : null}
              {!delivery.matchedArea && delivery.availableAreas.length > 0 ? (
                <div className="rounded-2xl border border-border/60 px-4 py-3">
                  <p className="text-sm font-medium">
                    Available delivery zones
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {delivery.availableAreas.join(", ")}
                  </p>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card className="border-border/70">
            <CardHeader>
              <CardTitle>Delivery Schedule</CardTitle>
              <CardDescription>
                {delivery.scope === "matched_area"
                  ? "Weekly schedule for the matched delivery zone."
                  : delivery.scope === "warehouse"
                    ? "General warehouse delivery schedule."
                    : "No delivery schedule has been configured yet."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="font-medium">{calendar.label}</p>
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                    Scheduled days highlighted
                  </p>
                </div>
                <div className="grid grid-cols-7 gap-2 text-center text-xs text-muted-foreground">
                  {WEEKDAY_LABELS.map((label) => (
                    <div key={label} className="pb-1 font-medium">
                      {label}
                    </div>
                  ))}
                  {calendar.cells.map((cell, index) => (
                    <div
                      key={`${cell.day || "empty"}-${index}`}
                      className={`flex h-10 items-center justify-center rounded-xl border text-sm ${
                        cell.day === null
                          ? "border-transparent bg-transparent"
                          : cell.scheduled
                            ? "border-emerald-200 bg-emerald-50 font-semibold text-emerald-700"
                            : "border-border/70 bg-background text-muted-foreground"
                      } ${cell.today ? "ring-2 ring-primary/30" : ""}`}
                    >
                      {cell.day || ""}
                    </div>
                  ))}
                </div>
              </div>

              {delivery.weeklyDays.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {delivery.weeklyDays.map((day) => (
                    <Badge
                      key={`${day.dayOfWeek}-${day.dayName}`}
                      className="border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50"
                    >
                      {day.dayName}
                    </Badge>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-border px-4 py-5 text-sm text-muted-foreground">
                  No weekly delivery days are available for this supplier yet.
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/70">
            <CardHeader>
              <CardTitle>Delivery Status</CardTitle>
              <CardDescription>
                Today’s delivery signal and the next expected schedule.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <DetailRow
                label={`Today (${delivery.todayDayName})`}
                value={
                  delivery.hasDeliveryToday
                    ? "Delivery scheduled"
                    : "No delivery"
                }
              />
              <DetailRow
                label="Next Delivery"
                value={describeNextDelivery(delivery.nextDelivery)}
              />
              <DetailRow
                label="Cut-off Time"
                value={delivery.cutoffTime || "Not configured"}
              />
            </CardContent>
          </Card>

          <Card className="border-border/70">
            <CardHeader>
              <CardTitle>Account Summary</CardTitle>
              <CardDescription>
                Retailer-side purchase and payable breakdown.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <DetailRow
                label="Total Purchase"
                value={formatCurrency(accountSummary.totalPurchase)}
              />
              <DetailRow
                label="Paid"
                value={formatCurrency(accountSummary.paid)}
              />
              <DetailRow
                label="Payable"
                value={formatCurrency(accountSummary.payable)}
              />
              <DetailRow
                label="Payable Orders"
                value={accountSummary.payableOrders}
              />
            </CardContent>
          </Card>

          <Card className="border-border/70">
            <CardHeader>
              <CardTitle>Order Quick Info</CardTitle>
              <CardDescription>
                Useful retailer-side snapshot before reordering or following up.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <DetailRow
                label="Last Order"
                value={
                  quickInfo.lastOrderNumber
                    ? `${quickInfo.lastOrderNumber} • ${formatLabel(quickInfo.lastOrderStatus)}`
                    : "No orders yet"
                }
              />
              <DetailRow
                label="Pending Orders"
                value={quickInfo.pendingOrders}
              />
              <DetailRow
                label="Last Delivered"
                value={formatDate(quickInfo.lastDeliveredAt)}
              />
            </CardContent>
          </Card>

          <Card className="border-border/70">
            <CardHeader>
              <CardTitle>Actions</CardTitle>
              <CardDescription>
                Shortcuts for the retailer team.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button asChild className="w-full justify-between">
                <Link href="/dashboard/order-from-warehouse">
                  <span className="flex items-center gap-2">
                    <ShoppingCart className="h-4 w-4" />
                    Place Order
                  </span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>

              <Button
                className="w-full justify-between"
                disabled={!hasPaymentFlow || accountSummary.payable <= 0}
                variant="outline"
              >
                <span className="flex items-center gap-2">
                  <Wallet className="h-4 w-4" />
                  Make Payment
                </span>
                <ArrowRight className="h-4 w-4" />
              </Button>

              <Button
                asChild
                className="w-full justify-between"
                variant="outline"
              >
                <Link href="/dashboard/orders/history">
                  <span className="flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    View Purchase Details
                  </span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>

              <div className="rounded-2xl border border-border/60 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
                Warehouse supplier payment posting is not configured in this
                panel yet, so the payment action is visible but disabled for
                now.
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-36" />
      <Card>
        <CardContent className="space-y-4 p-6">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-72" />
          <div className="grid gap-4 md:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-24 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-6">
          {Array.from({ length: 3 }).map((_, index) => (
            <Card key={index}>
              <CardContent className="p-5">
                <Skeleton className="h-40 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="space-y-6">
          {Array.from({ length: 5 }).map((_, index) => (
            <Card key={index}>
              <CardContent className="p-5">
                <Skeleton className="h-28 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
