"use client";

import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Building2,
  CalendarClock,
  ClipboardList,
  type LucideIcon,
  Mail,
  MapPin,
  Phone,
  ReceiptText,
  Store,
  User,
  Wallet,
} from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { use, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SALES_PORTAL_BASE } from "@/lib/sales-routing";
import { orpc } from "@/utils/orpc";

const LocationViewMap = dynamic(
  () =>
    import("@/components/features/onboarding/location-view-map").then(
      (mod) => mod.LocationViewMap,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[250px] w-full items-center justify-center bg-muted/30 text-sm text-muted-foreground">
        Loading map...
      </div>
    ),
  },
);

type ShopType = "retailer" | "warehouse";

type ShopOrder = {
  id: number;
  orderNumber: string;
  total: string;
  status: string;
  paymentStatus: string;
  createdAt: Date | string;
};

type ShopEstimate = {
  id: number;
  estimateNumber: string;
  total: string;
  status: string;
  createdAt: Date | string;
};

type AssignedShopDetail = {
  id: string;
  customerType: ShopType;
  displayName: string;
  contactName: string;
  email: string;
  phoneNumber: string | null;
  address: string | null;
  locationLat: string | null;
  locationLng: string | null;
  shopName: string | null;
  warehouseName: string | null;
  connectedAt: Date | string | null;
  assignedAt: Date | string;
  lastActivityAt: Date | string | null;
  stats: {
    totalEstimates: number;
    totalOrders: number;
    totalSpent: string;
    pendingAmount: string;
  };
  estimates: ShopEstimate[];
  orders: ShopOrder[];
};

function formatDate(value: Date | string | null | undefined) {
  if (!value) return "No date";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function formatMoney(value: string | number | null | undefined) {
  return `Tk ${Number(value ?? 0).toLocaleString("en-BD")}`;
}

function getLocationCoordinates(
  lat: string | null | undefined,
  lng: string | null | undefined,
) {
  const latitude = Number.parseFloat(lat ?? "");
  const longitude = Number.parseFloat(lng ?? "");

  if (Number.isNaN(latitude) || Number.isNaN(longitude)) return null;

  return { latitude, longitude };
}

function formatStatus(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function ShopTypeBadge({ type }: { type: ShopType }) {
  const isWarehouse = type === "warehouse";
  const Icon = isWarehouse ? Building2 : Store;

  return (
    <Badge
      variant="outline"
      className={
        isWarehouse
          ? "gap-1 border-sky-200 bg-sky-50 text-sky-700"
          : "gap-1 border-emerald-200 bg-emerald-50 text-emerald-700"
      }
    >
      <Icon className="h-3 w-3" />
      {isWarehouse ? "Warehouse" : "Retail Shop"}
    </Badge>
  );
}

function StatusBadge({ value }: { value: string }) {
  const isGood = [
    "approved",
    "confirmed",
    "delivered",
    "paid",
    "converted",
  ].includes(value);
  const isWarning = ["pending", "processing", "sent", "draft"].includes(value);

  return (
    <Badge
      variant="outline"
      className={
        isGood
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : isWarning
            ? "border-amber-200 bg-amber-50 text-amber-700"
            : "border-muted bg-muted/50 text-muted-foreground"
      }
    >
      {formatStatus(value)}
    </Badge>
  );
}

function MetricCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
}) {
  return (
    <Card className="p-0">
      <CardContent className="flex items-center justify-between gap-3 p-4">
        <div className="min-w-0">
          <p className="truncate text-2xl font-bold tabular-nums">{value}</p>
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
        </div>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
      </CardContent>
    </Card>
  );
}

function LoadingState() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10" />
        <div className="space-y-2">
          <Skeleton className="h-7 w-56" />
          <Skeleton className="h-4 w-80" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((item) => (
          <Skeleton key={item} className="h-24" />
        ))}
      </div>
      <Skeleton className="h-72" />
    </div>
  );
}

export default function AssignedShopDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const { data, isLoading, error } = useQuery(
    orpc.salesman.getCustomerDetails.queryOptions({
      input: { id },
    }),
  );

  const shop = data?.customer as AssignedShopDetail | undefined;

  const latestOrders = useMemo(() => shop?.orders ?? [], [shop?.orders]);
  const latestEstimates = useMemo(
    () => shop?.estimates ?? [],
    [shop?.estimates],
  );
  const locationCoordinates = getLocationCoordinates(
    shop?.locationLat,
    shop?.locationLng,
  );

  if (isLoading) return <LoadingState />;

  if (error || !shop) {
    return (
      <div className="space-y-6">
        <Button asChild variant="ghost" className="w-fit gap-2">
          <Link href={`${SALES_PORTAL_BASE}/assign-shops`}>
            <ArrowLeft className="h-4 w-4" />
            Back to Assign Shops
          </Link>
        </Button>
        <div className="flex min-h-72 items-center justify-center rounded-lg border bg-muted/30 p-8 text-center">
          <div>
            <Store className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
            <p className="text-sm font-medium">Assigned shop not found</p>
            <p className="mt-1 text-xs text-muted-foreground">
              The shop may be inactive, disconnected, or no longer assigned to
              your SR profile.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <Button asChild variant="ghost" size="icon" className="shrink-0">
            <Link href={`${SALES_PORTAL_BASE}/assign-shops`}>
              <ArrowLeft className="h-5 w-5" />
              <span className="sr-only">Back</span>
            </Link>
          </Button>
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
                {shop.displayName}
              </h1>
              <ShopTypeBadge type={shop.customerType} />
            </div>
            <p className="text-sm text-muted-foreground">
              Read-only assigned shop profile for your SR workspace.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard
          label="Orders"
          value={shop.stats.totalOrders}
          icon={ReceiptText}
        />
        <MetricCard
          label="Order Value"
          value={formatMoney(shop.stats.totalSpent)}
          icon={Wallet}
        />
        <MetricCard
          label="Pending Amount"
          value={formatMoney(shop.stats.pendingAmount)}
          icon={CalendarClock}
        />
        <MetricCard
          label="Estimates"
          value={shop.stats.totalEstimates}
          icon={ClipboardList}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-0 lg:col-span-1">
          <CardContent className="space-y-4 p-5">
            <div>
              <h2 className="text-sm font-semibold">Shop Profile</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Contact and assignment details
              </p>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex items-start gap-2">
                <User className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="font-medium">{shop.contactName}</p>
                  <p className="text-xs text-muted-foreground">
                    Contact person
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Phone className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="font-medium">
                    {shop.phoneNumber ?? "No phone"}
                  </p>
                  <p className="text-xs text-muted-foreground">Phone</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Mail className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="truncate font-medium">{shop.email}</p>
                  <p className="text-xs text-muted-foreground">Email</p>
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">Location</p>
                {locationCoordinates ? (
                  <div className="overflow-hidden rounded-lg border bg-muted/20">
                    <LocationViewMap
                      latitude={locationCoordinates.latitude}
                      longitude={locationCoordinates.longitude}
                    />
                    <div className="flex items-start gap-2 border-t bg-background p-3">
                      <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                      <p className="text-sm font-medium">
                        {shop.address ?? "No address"}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-2 rounded-lg border bg-muted/20 p-3">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    <p className="text-sm font-medium">
                      {shop.address ?? "No location saved"}
                    </p>
                  </div>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 border-t pt-4 text-xs">
              <div>
                <p className="text-muted-foreground">Connected</p>
                <p className="mt-1 font-medium">
                  {formatDate(shop.connectedAt)}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Assigned</p>
                <p className="mt-1 font-medium">
                  {formatDate(shop.assignedAt)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4 lg:col-span-2">
          <Card className="p-0">
            <CardContent className="p-0">
              <div className="border-b px-5 py-4">
                <h2 className="text-sm font-semibold">Order History</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Orders from this shop to your warehouse
                </p>
              </div>
              {latestOrders.length === 0 ? (
                <div className="px-5 py-10 text-center text-sm text-muted-foreground">
                  No orders found.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Order</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Payment</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {latestOrders.map((orderItem) => (
                        <TableRow key={orderItem.id}>
                          <TableCell>
                            <p className="font-medium">
                              {orderItem.orderNumber}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatDate(orderItem.createdAt)}
                            </p>
                          </TableCell>
                          <TableCell>
                            <StatusBadge value={orderItem.status} />
                          </TableCell>
                          <TableCell>
                            <StatusBadge value={orderItem.paymentStatus} />
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatMoney(orderItem.total)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="p-0">
            <CardContent className="p-0">
              <div className="border-b px-5 py-4">
                <h2 className="text-sm font-semibold">Estimate History</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Estimates created by your SR profile for this shop
                </p>
              </div>
              {latestEstimates.length === 0 ? (
                <div className="px-5 py-10 text-center text-sm text-muted-foreground">
                  No estimates found.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Estimate</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {latestEstimates.map((estimateItem) => (
                        <TableRow key={estimateItem.id}>
                          <TableCell className="font-medium">
                            {estimateItem.estimateNumber}
                          </TableCell>
                          <TableCell>
                            <StatusBadge value={estimateItem.status} />
                          </TableCell>
                          <TableCell>
                            {formatDate(estimateItem.createdAt)}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatMoney(estimateItem.total)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
