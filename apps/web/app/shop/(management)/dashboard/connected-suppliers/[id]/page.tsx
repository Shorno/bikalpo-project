"use client";

import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Download,
  ExternalLink,
  FileCheck2,
  Mail,
  MapPin,
  MessageCircle,
  Package,
  Phone,
  ShoppingCart,
  Users,
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
import { useConnectedSupplierDetail } from "@/hooks/use-shop-owner-api";

type ConnectedSupplierDetail = {
  identity: {
    warehouseId: string;
    warehouseSlug: string | null;
    name: string;
    type: string;
    location: string | null;
    phone: string | null;
    email: string | null;
    image: string | null;
    connectionStatus: string | null;
    connectedAt: string | Date | null;
    lastOrderedAt: string | Date | null;
  };
  business: {
    name: string;
    category: string | null;
    yearsInBusiness: string | null;
    yourStoreName: string | null;
    yourAddress: string | null;
  };
  documents: {
    applicationStatus: string | null;
    tradeLicenseNumber: string | null;
    uploadedDocumentCount: number;
    uploadedDocuments: string[];
    hasTradeLicense: boolean;
    hasVatBin: boolean;
    hasAgreement: boolean;
    hasProductAuthorization: boolean;
  };
  financialSummary: {
    totalPurchase: number;
    totalPaid: number;
    totalDue: number;
    creditLimit: number | null;
    availableCredit: number | null;
    health: "attention" | "safe";
  };
  orderStatus: {
    totalOrders: number;
    pendingOrders: number;
    processingOrders: number;
    outForDeliveryOrders: number;
    deliveredOrders: number;
  };
  pendingOrders: Array<{
    id: number;
    orderNumber: string;
    status: string;
    createdAt: string | Date;
    total: number;
    deliveryStatus: string | null;
    expectedDeliveryAt: string | Date | null;
    items: Array<{
      id: number;
      productName: string;
      quantity: number;
      rawQuantity: number;
    }>;
  }>;
  dueStatus: {
    totalPayable: number;
    overdueAmount: number;
    payableOrders: number;
    lastPayment: {
      orderNumber: string;
      amount: number;
      date: string | Date;
    } | null;
    alert: string;
  };
  purchaseHistory: Array<{
    id: number;
    orderNumber: string;
    date: string | Date;
    productSummary: string;
    amount: number;
    orderStatus: string;
    paymentStatus: string;
    dueAmount: number;
  }>;
  productRelation: {
    topProducts: Array<{
      name: string;
      image: string | null;
      totalQty: number;
      orderCount: number;
    }>;
    totalSkuPurchased: number;
    topCategories: Array<{
      name: string;
      totalQty: number;
      orderCount: number;
    }>;
  };
  performance: {
    avgDeliveryDays: number;
    deliverySpeed: string;
    orderAccuracy: number;
    reliability: string;
    issueRate: number;
  };
  issues: {
    totalIssues: number;
    resolvedIssues: number;
    unresolvedIssues: number;
    lastIssue: {
      type: string;
      status: string;
      description: string;
      delayReason: string | null;
      createdAt: string | Date;
    } | null;
  };
  salesman: {
    id: string;
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
  smartInsight: {
    headline: string;
    warning: string | null;
    suggestion: string;
    compareCategory: string | null;
  };
  emptyState: {
    hasTransactions: boolean;
  };
};

const WEEKDAY_LABELS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

function formatCurrency(value: number | null | undefined) {
  return `Tk ${Number(value || 0).toLocaleString("en-BD")}`;
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
  nextDelivery: ConnectedSupplierDetail["delivery"]["nextDelivery"],
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

  for (let index = 0; index < offset; index += 1) {
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

function escapeCsvValue(value: string | number) {
  const text = String(value);
  if (text.includes(",") || text.includes('"') || text.includes("\n")) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
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
  tone?: "default" | "danger" | "success";
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

function DetailSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-9 w-40" />
      <Card>
        <CardContent className="space-y-4 p-6">
          <Skeleton className="h-8 w-72" />
          <Skeleton className="h-5 w-96" />
          <div className="grid gap-4 md:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-28 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
      <div className="grid gap-4 xl:grid-cols-2">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-64 w-full" />
        ))}
      </div>
    </div>
  );
}

export default function ConnectedSupplierDetailPage() {
  const params = useParams();
  const warehouseId = params.id as string;
  const { data, isLoading, isError } = useConnectedSupplierDetail(warehouseId);

  if (isLoading) return <DetailSkeleton />;

  if (isError || !data) {
    return (
      <div className="space-y-4">
        <Button asChild size="sm" variant="ghost">
          <Link href="/dashboard/connected-suppliers">
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Back
          </Link>
        </Button>

        <Card>
          <CardContent className="p-12 text-center">
            <AlertCircle className="mx-auto mb-3 h-12 w-12 text-rose-300" />
            <p className="font-medium text-muted-foreground">
              Connected supplier details could not be loaded.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const detail = data as ConnectedSupplierDetail;
  const phoneForLinks = detail.identity.phone?.replace(/[^\d+]/g, "") || "";
  const orderLink = detail.identity.warehouseSlug
    ? `/dashboard/order-from-warehouse?warehouse=${encodeURIComponent(detail.identity.warehouseSlug)}`
    : "/dashboard/warehouses";
  const compareLink = detail.smartInsight.compareCategory
    ? `/dashboard/connected-suppliers?category=${encodeURIComponent(detail.smartInsight.compareCategory)}`
    : "/dashboard/connected-suppliers";
  const calendar = buildMonthCalendar(
    detail.delivery.weeklyDays.map((day) => day.dayOfWeek),
  );

  const handleDownloadStatement = () => {
    const rows = [
      [
        "Order Number",
        "Date",
        "Products",
        "Amount",
        "Order Status",
        "Payment Status",
        "Due Amount",
      ],
      ...detail.purchaseHistory.map((entry) => [
        entry.orderNumber,
        formatDate(entry.date),
        entry.productSummary,
        String(entry.amount),
        formatLabel(entry.orderStatus),
        formatLabel(entry.paymentStatus),
        String(entry.dueAmount),
      ]),
    ];

    const csv = rows
      .map((row) => row.map((value) => escapeCsvValue(value)).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${detail.identity.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")}-statement.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <Button asChild size="sm" variant="ghost">
        <Link href="/dashboard/connected-suppliers">
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          Back to Connected Suppliers
        </Link>
      </Button>

      <Card className="border-border/70">
        <CardContent className="space-y-5 p-6">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-bold tracking-tight">
                  {detail.identity.name}
                </h1>
                <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50">
                  {formatLabel(detail.identity.connectionStatus)}
                </Badge>
                <Badge variant="outline" className="border-border/70">
                  {formatLabel(detail.identity.type)}
                </Badge>
                {detail.financialSummary.totalDue > 0 ? (
                  <Badge className="border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-50">
                    {formatCurrency(detail.financialSummary.totalDue)} due
                  </Badge>
                ) : null}
              </div>

              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                {detail.identity.phone ? (
                  <span className="flex items-center gap-1.5">
                    <Phone className="h-4 w-4" />
                    {detail.identity.phone}
                  </span>
                ) : null}
                {detail.identity.email ? (
                  <span className="flex items-center gap-1.5">
                    <Mail className="h-4 w-4" />
                    {detail.identity.email}
                  </span>
                ) : null}
                {detail.identity.location ? (
                  <span className="flex items-center gap-1.5">
                    <MapPin className="h-4 w-4" />
                    {detail.identity.location}
                  </span>
                ) : null}
              </div>

              <p className="max-w-2xl text-sm text-muted-foreground">
                {detail.smartInsight.headline}
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row xl:flex-col">
              <Button asChild>
                <Link href={orderLink}>
                  <ShoppingCart className="mr-2 h-4 w-4" />
                  Create Order
                </Link>
              </Button>
              {phoneForLinks ? (
                <Button asChild variant="outline">
                  <a href={`tel:${phoneForLinks}`}>
                    <Phone className="mr-2 h-4 w-4" />
                    Call
                  </a>
                </Button>
              ) : (
                <Button variant="outline" disabled>
                  <Phone className="mr-2 h-4 w-4" />
                  Call
                </Button>
              )}
              {phoneForLinks ? (
                <Button asChild variant="outline">
                  <a
                    href={`https://wa.me/${phoneForLinks.replace(/^\+/, "")}`}
                    rel="noreferrer"
                    target="_blank"
                  >
                    <MessageCircle className="mr-2 h-4 w-4" />
                    Chat
                  </a>
                </Button>
              ) : (
                <Button variant="outline" disabled>
                  <MessageCircle className="mr-2 h-4 w-4" />
                  Chat
                </Button>
              )}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <StatCard
              label="Total Purchase"
              value={formatCurrency(detail.financialSummary.totalPurchase)}
              hint={`Connected ${formatDate(detail.identity.connectedAt)}`}
            />
            <StatCard
              label="Total Due"
              value={formatCurrency(detail.financialSummary.totalDue)}
              hint={`${detail.dueStatus.payableOrders} payable order${detail.dueStatus.payableOrders === 1 ? "" : "s"}`}
              tone={detail.financialSummary.totalDue > 0 ? "danger" : "success"}
            />
            <StatCard
              label="Pending Orders"
              value={detail.orderStatus.pendingOrders}
              hint={`${detail.orderStatus.outForDeliveryOrders} out for delivery`}
              tone={
                detail.orderStatus.pendingOrders > 0 ? "default" : "success"
              }
            />
          </div>
        </CardContent>
      </Card>

      {!detail.emptyState.hasTransactions ? (
        <Card className="border-border/70">
          <CardContent className="flex flex-col items-center gap-4 p-10 text-center">
            <ShoppingCart className="h-12 w-12 text-muted-foreground/30" />
            <div className="space-y-1">
              <p className="text-lg font-semibold">No transaction yet</p>
              <p className="text-sm text-muted-foreground">
                This supplier connection is active, but purchase history has not
                started yet.
              </p>
            </div>
            <Button asChild>
              <Link href={orderLink}>
                Start Buying
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="border-border/70">
          <CardHeader>
            <CardTitle>Supplier Identity</CardTitle>
            <CardDescription>
              Core business and retailer relationship details.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <DetailRow label="Business Name" value={detail.business.name} />
            <DetailRow
              label="Business Category"
              value={formatLabel(detail.business.category)}
            />
            <DetailRow
              label="Years in Business"
              value={detail.business.yearsInBusiness}
            />
            <DetailRow
              label="Your Store"
              value={detail.business.yourStoreName}
            />
            <DetailRow
              label="Your Address"
              value={detail.business.yourAddress}
            />
          </CardContent>
        </Card>

        <Card className="border-border/70">
          <CardHeader>
            <CardTitle>Documents</CardTitle>
            <CardDescription>
              Retailer-facing verification and uploaded business documents.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <DetailRow
                label="Application Status"
                value={formatLabel(detail.documents.applicationStatus)}
              />
              <DetailRow
                label="Trade License"
                value={
                  detail.documents.tradeLicenseNumber
                    ? `Verified (${detail.documents.tradeLicenseNumber})`
                    : "Not provided"
                }
              />
              <DetailRow
                label="Uploaded Documents"
                value={detail.documents.uploadedDocumentCount}
              />
              <DetailRow
                label="Product Authorization"
                value={
                  detail.documents.hasProductAuthorization
                    ? "Available"
                    : "Not uploaded"
                }
              />
            </div>

            {detail.documents.uploadedDocuments.length > 0 ? (
              <div className="space-y-2 rounded-2xl border border-border/60 p-4">
                <p className="text-sm font-medium">Document Links</p>
                <div className="flex flex-col gap-2">
                  {detail.documents.uploadedDocuments.map(
                    (documentUrl, index) => (
                      <a
                        key={documentUrl}
                        className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
                        href={documentUrl}
                        rel="noreferrer"
                        target="_blank"
                      >
                        <FileCheck2 className="h-4 w-4" />
                        Document {index + 1}
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    ),
                  )}
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card className="border-border/70">
          <CardHeader>
            <CardTitle>Financial Summary</CardTitle>
            <CardDescription>
              Total purchase, paid, due, and network financial posture.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <DetailRow
              label="Total Purchase"
              value={formatCurrency(detail.financialSummary.totalPurchase)}
            />
            <DetailRow
              label="Total Paid"
              value={formatCurrency(detail.financialSummary.totalPaid)}
            />
            <DetailRow
              label="Total Due"
              value={formatCurrency(detail.financialSummary.totalDue)}
            />
            <DetailRow
              label="Credit Status"
              value={
                detail.financialSummary.health === "safe"
                  ? "Credit Safe"
                  : "Needs Attention"
              }
            />
            <p className="rounded-2xl border border-dashed border-border/70 px-4 py-3 text-sm text-muted-foreground">
              Platform credit-limit tracking for connected suppliers is not
              configured yet, so this screen focuses on real purchase and due
              data.
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/70">
          <CardHeader>
            <CardTitle>Due / Payable Status</CardTitle>
            <CardDescription>
              Current payable posture and the latest settled purchase.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <DetailRow
              label="Total Payable"
              value={formatCurrency(detail.dueStatus.totalPayable)}
            />
            <DetailRow
              label="Delivered Unpaid"
              value={formatCurrency(detail.dueStatus.overdueAmount)}
            />
            <DetailRow
              label="Last Payment"
              value={
                detail.dueStatus.lastPayment
                  ? `${formatCurrency(detail.dueStatus.lastPayment.amount)} (${formatShortDate(detail.dueStatus.lastPayment.date)})`
                  : "No paid order yet"
              }
            />
            <div className="rounded-2xl border border-border/60 px-4 py-3">
              <p className="text-sm font-medium">Alert</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {detail.dueStatus.alert}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/70">
          <CardHeader>
            <CardTitle>Assigned Salesman</CardTitle>
            <CardDescription>
              The retailer-side contact currently mapped to this supplier.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {detail.salesman ? (
              <>
                <DetailRow label="Name" value={detail.salesman.name} />
                <DetailRow label="Phone" value={detail.salesman.phone} />
                <DetailRow
                  label="Status"
                  value={formatLabel(detail.salesman.status)}
                />
              </>
            ) : (
              <p className="rounded-2xl border border-dashed border-border/70 px-4 py-8 text-center text-sm text-muted-foreground">
                No salesman is currently assigned to this supplier connection.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/70">
          <CardHeader>
            <CardTitle>Delivery Status</CardTitle>
            <CardDescription>
              Matching area, weekly availability, and the next possible
              delivery.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <DetailRow
                label="Delivery Scope"
                value={formatLabel(detail.delivery.scope)}
              />
              <DetailRow
                label="Your Area Match"
                value={
                  detail.delivery.matchedArea?.name ||
                  detail.delivery.areaHint ||
                  "No matched delivery area"
                }
              />
              <DetailRow
                label="Today"
                value={
                  detail.delivery.hasDeliveryToday
                    ? `${detail.delivery.todayDayName} delivery available`
                    : "No delivery today"
                }
              />
              <DetailRow
                label="Next Delivery"
                value={describeNextDelivery(detail.delivery.nextDelivery)}
              />
            </div>

            {detail.delivery.weeklyDays.length > 0 ? (
              <div className="space-y-4 rounded-2xl border border-border/60 p-4">
                <div>
                  <p className="font-medium">{calendar.label}</p>
                  <p className="text-sm text-muted-foreground">
                    Highlighted days reflect supplier delivery coverage.
                  </p>
                </div>
                <div className="grid grid-cols-7 gap-2 text-center text-xs">
                  {WEEKDAY_LABELS.map((label) => (
                    <div
                      key={label}
                      className="font-medium text-muted-foreground"
                    >
                      {label}
                    </div>
                  ))}
                  {calendar.cells.map((cell, index) => (
                    <div
                      key={`${cell.day}-${index}`}
                      className={[
                        "flex h-9 items-center justify-center rounded-xl border text-sm",
                        cell.day === null
                          ? "border-transparent bg-transparent text-transparent"
                          : cell.today
                            ? "border-primary/30 bg-primary/10 font-semibold text-primary"
                            : cell.scheduled
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                              : "border-border/60 text-muted-foreground",
                      ].join(" ")}
                    >
                      {cell.day ?? "0"}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="rounded-2xl border border-dashed border-border/70 px-4 py-8 text-center text-sm text-muted-foreground">
                No delivery schedule has been configured for this supplier yet.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/70">
        <CardHeader>
          <CardTitle>Order Status</CardTitle>
          <CardDescription>
            Combined purchase and delivery state across your connected history.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-5">
          <StatCard
            label="Total Orders"
            value={detail.orderStatus.totalOrders}
          />
          <StatCard
            label="Pending"
            value={detail.orderStatus.pendingOrders}
            tone={detail.orderStatus.pendingOrders > 0 ? "default" : "success"}
          />
          <StatCard
            label="Processing"
            value={detail.orderStatus.processingOrders}
            tone={
              detail.orderStatus.processingOrders > 0 ? "default" : "success"
            }
          />
          <StatCard
            label="Out for Delivery"
            value={detail.orderStatus.outForDeliveryOrders}
            tone={
              detail.orderStatus.outForDeliveryOrders > 0
                ? "default"
                : "success"
            }
          />
          <StatCard
            label="Delivered"
            value={detail.orderStatus.deliveredOrders}
            tone="success"
          />
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="border-border/70">
          <CardHeader>
            <CardTitle>Pending Order Details</CardTitle>
            <CardDescription>
              Open purchase orders still waiting for supplier completion.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {detail.pendingOrders.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-border/70 px-4 py-8 text-center text-sm text-muted-foreground">
                No active pending orders right now.
              </p>
            ) : (
              detail.pendingOrders.map((order) => (
                <div
                  key={order.id}
                  className="space-y-3 rounded-2xl border border-border/60 p-4"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-medium">{order.orderNumber}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatDate(order.createdAt)}
                      </p>
                    </div>
                    <Badge variant="outline" className="w-fit">
                      {formatLabel(order.deliveryStatus || order.status)}
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    {order.items.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between gap-3 text-sm"
                      >
                        <span>{item.productName}</span>
                        <span className="text-muted-foreground">
                          {item.quantity} unit
                          {item.quantity === 1 ? "" : "s"}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-col gap-2 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                    <span>Total: {formatCurrency(order.total)}</span>
                    <span>
                      Expected Delivery:{" "}
                      {order.expectedDeliveryAt
                        ? formatDate(order.expectedDeliveryAt)
                        : "Awaiting supplier update"}
                    </span>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="border-border/70">
          <CardHeader>
            <CardTitle>Performance Score</CardTitle>
            <CardDescription>
              Delivery consistency, order accuracy, and issue-rate signals.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <DetailRow
              label="Delivery Speed"
              value={detail.performance.deliverySpeed}
            />
            <DetailRow
              label="Order Accuracy"
              value={`${detail.performance.orderAccuracy}%`}
            />
            <DetailRow
              label="Reliability"
              value={detail.performance.reliability}
            />
            <DetailRow
              label="Issue Rate"
              value={`${detail.performance.issueRate}%`}
            />
            <DetailRow
              label="Average Delivery Time"
              value={
                detail.performance.avgDeliveryDays > 0
                  ? `${detail.performance.avgDeliveryDays} day${detail.performance.avgDeliveryDays === 1 ? "" : "s"}`
                  : "No delivery data"
              }
            />
          </CardContent>
        </Card>

        <Card className="border-border/70">
          <CardHeader>
            <CardTitle>Product Relation</CardTitle>
            <CardDescription>
              Your strongest purchase categories and top bought products.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <DetailRow
              label="Total SKU Purchased"
              value={detail.productRelation.totalSkuPurchased}
            />

            <div className="space-y-2">
              <p className="text-sm font-medium">Top Purchased Products</p>
              {detail.productRelation.topProducts.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No product purchase data yet.
                </p>
              ) : (
                detail.productRelation.topProducts.map((product) => (
                  <div
                    key={product.name}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-border/60 px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <Package className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="font-medium">{product.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {product.orderCount} order
                          {product.orderCount === 1 ? "" : "s"}
                        </p>
                      </div>
                    </div>
                    <p className="font-medium">{product.totalQty} qty</p>
                  </div>
                ))
              )}
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Top Categories</p>
              {detail.productRelation.topCategories.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No category relationship data yet.
                </p>
              ) : (
                detail.productRelation.topCategories.map((category) => (
                  <div
                    key={category.name}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-border/60 px-4 py-3"
                  >
                    <span className="font-medium">{category.name}</span>
                    <span className="text-sm text-muted-foreground">
                      {category.totalQty} qty across {category.orderCount}{" "}
                      orders
                    </span>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/70">
          <CardHeader>
            <CardTitle>Issue / Complaint History</CardTitle>
            <CardDescription>
              Retailer-reported complaint signals tied to this supplier.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <DetailRow label="Total Issues" value={detail.issues.totalIssues} />
            <DetailRow label="Resolved" value={detail.issues.resolvedIssues} />
            <DetailRow
              label="Unresolved"
              value={detail.issues.unresolvedIssues}
            />
            <div className="rounded-2xl border border-border/60 p-4">
              <p className="text-sm font-medium">Last Issue</p>
              {detail.issues.lastIssue ? (
                <div className="mt-2 space-y-2 text-sm text-muted-foreground">
                  <p>
                    {formatLabel(detail.issues.lastIssue.type)} •{" "}
                    {formatLabel(detail.issues.lastIssue.status)}
                  </p>
                  <p>{detail.issues.lastIssue.description}</p>
                  {detail.issues.lastIssue.delayReason ? (
                    <p>Reason: {detail.issues.lastIssue.delayReason}</p>
                  ) : null}
                  <p>{formatDate(detail.issues.lastIssue.createdAt)}</p>
                </div>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">
                  No issue history has been recorded for this supplier.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/70">
        <CardHeader>
          <CardTitle>Purchase History</CardTitle>
          <CardDescription>
            The most recent purchase orders between this retailer and supplier.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {detail.purchaseHistory.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border/70 px-4 py-8 text-center text-sm text-muted-foreground">
              No purchase history is available yet.
            </p>
          ) : (
            <>
              <div className="hidden lg:block">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Order</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Products</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Payment</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detail.purchaseHistory.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell className="font-medium">
                          {entry.orderNumber}
                        </TableCell>
                        <TableCell>{formatShortDate(entry.date)}</TableCell>
                        <TableCell className="max-w-[280px] truncate">
                          {entry.productSummary}
                        </TableCell>
                        <TableCell>{formatCurrency(entry.amount)}</TableCell>
                        <TableCell>{formatLabel(entry.orderStatus)}</TableCell>
                        <TableCell>
                          {formatLabel(entry.paymentStatus)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="grid gap-3 lg:hidden">
                {detail.purchaseHistory.map((entry) => (
                  <div
                    key={entry.id}
                    className="space-y-2 rounded-2xl border border-border/60 p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-medium">{entry.orderNumber}</p>
                      <span className="text-sm text-muted-foreground">
                        {formatShortDate(entry.date)}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {entry.productSummary}
                    </p>
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span>{formatCurrency(entry.amount)}</span>
                      <span>{formatLabel(entry.paymentStatus)}</span>
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
          <CardTitle>Smart Insight</CardTitle>
          <CardDescription>
            Auto-combined network, financial, and performance observations.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
            <p className="font-medium text-emerald-800">
              {detail.smartInsight.headline}
            </p>
          </div>
          {detail.smartInsight.warning ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800">
              {detail.smartInsight.warning}
            </div>
          ) : null}
          <div className="rounded-2xl border border-border/60 px-4 py-3">
            <p className="font-medium">Suggestion</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {detail.smartInsight.suggestion}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/70">
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>
            Fast actions based on the connected supplier relationship.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 md:flex-row md:flex-wrap">
          <Button asChild>
            <Link href={orderLink}>
              <ShoppingCart className="mr-2 h-4 w-4" />
              Create Order
            </Link>
          </Button>
          <Button variant="outline" disabled>
            <Wallet className="mr-2 h-4 w-4" />
            Make Payment
          </Button>
          <Button asChild variant="outline">
            <Link href={compareLink}>
              <Users className="mr-2 h-4 w-4" />
              Compare Supplier
            </Link>
          </Button>
          <Button variant="outline" onClick={handleDownloadStatement}>
            <Download className="mr-2 h-4 w-4" />
            Download Statement
          </Button>
        </CardContent>
      </Card>

      <p className="text-sm text-muted-foreground">
        Retailer-side payment posting for connected warehouse suppliers is not
        configured yet, so payment actions remain informational for now.
      </p>
    </div>
  );
}
