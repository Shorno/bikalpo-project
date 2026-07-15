"use client";

import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  ArrowLeft,
  Ban,
  CheckCircle2,
  Clock,
  CreditCard,
  Loader,
  MapPin,
  Package,
  PackageCheck,
  Phone,
  RotateCcw,
  Truck,
  Warehouse,
  XCircle,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import {
  type OrderFlowStep,
  OrderFlowStepper,
} from "@/components/features/orders/order-flow-stepper";
import {
  formatRetailerOrderItemQuantity,
  getRetailerOrderFulfillmentSummary,
  getRetailerOrderItemDeliveredQty,
  getRetailerOrderItemEffectiveQty,
  getRetailerOrderItemOrderedQty,
} from "@/components/features/orders/retailer-order-fulfillment";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useCancelPurchaseOrder,
  useMarkPurchaseReceived,
  usePurchaseOrderDetail,
} from "@/hooks/use-shop-owner-api";
import { cn } from "@/lib/utils";

type StatusDefinition = {
  label: string;
  icon: LucideIcon;
  className: string;
};

const STATUS_CONFIG: Record<string, StatusDefinition> = {
  pending: {
    label: "Pending approval",
    icon: Clock,
    className: "border-amber-200 bg-amber-50 text-amber-700",
  },
  approved: {
    label: "Approved",
    icon: CheckCircle2,
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  confirmed: {
    label: "Approved",
    icon: CheckCircle2,
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  ready_for_dispatch: {
    label: "Ready for dispatch",
    icon: PackageCheck,
    className: "border-violet-200 bg-violet-50 text-violet-700",
  },
  partially_invoiced: {
    label: "Partially invoiced",
    icon: Package,
    className: "border-amber-200 bg-amber-50 text-amber-700",
  },
  invoiced: {
    label: "Invoiced",
    icon: CreditCard,
    className: "border-blue-200 bg-blue-50 text-blue-700",
  },
  processing: {
    label: "In delivery",
    icon: Truck,
    className: "border-blue-200 bg-blue-50 text-blue-700",
  },
  delivered: {
    label: "Received",
    icon: PackageCheck,
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  returned: {
    label: "Returned",
    icon: RotateCcw,
    className: "border-orange-200 bg-orange-50 text-orange-700",
  },
  cancelled: {
    label: "Cancelled",
    icon: XCircle,
    className: "border-red-200 bg-red-50 text-red-700",
  },
};

function formatMoney(value: unknown) {
  return `৳ ${Number(value || 0).toLocaleString("en-BD")}`;
}

function formatDateTime(value?: string | Date | null) {
  if (!value) return "Not recorded";

  return new Date(value).toLocaleString("en-BD", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatLabel(value?: string | null) {
  if (!value) return "Not recorded";

  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function buildRetailerFlow(order: any, timeline: any[]): OrderFlowStep[] {
  if (order.status === "cancelled") {
    return [
      {
        key: "placed",
        label: "Order placed",
        completed: true,
        date: order.createdAt,
      },
      {
        key: "cancelled",
        label: "Cancelled",
        completed: true,
        date: order.cancelledAt || order.updatedAt,
        tone: "danger",
      },
    ];
  }

  const normalized = (timeline || []).map((step, index) => ({
    key: `${String(step.step)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")}-${index}`,
    label: step.step,
    completed: step.completed,
    date: step.date,
    tone: step.isModification ? ("warning" as const) : undefined,
  }));

  if (order.status === "returned") {
    normalized.push({
      key: "returned",
      label: "Returned",
      completed: true,
      date: order.returnedAt || order.updatedAt,
      tone: "warning",
    });
  }

  return normalized;
}

export default function PurchaseOrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = Number(params.id);

  const { data, isLoading, isError } = usePurchaseOrderDetail(orderId || null);
  const [showReceiveDialog, setShowReceiveDialog] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [receivedItems, setReceivedItems] = useState<Record<number, number>>(
    {},
  );

  const receiveMutation = useMarkPurchaseReceived();
  const cancelMutation = useCancelPurchaseOrder();

  if (isLoading) return <DetailSkeleton />;

  if (isError || !data) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <div className="max-w-sm text-center">
          <Package className="mx-auto mb-4 h-12 w-12 text-muted-foreground/30" />
          <h1 className="text-lg font-semibold text-foreground">
            Order not found
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            This purchase order does not exist or is unavailable to your
            account.
          </p>
          <Button asChild variant="outline" className="mt-5">
            <Link href="/dashboard/orders">Back to orders</Link>
          </Button>
        </div>
      </div>
    );
  }

  const { order, timeline, hasModifications, delivery } = data;
  const status = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
  const StatusIcon = status.icon;
  const isCancellable = ["pending", "confirmed"].includes(order.status);
  const isReceivable =
    ["processing", "delivered"].includes(order.status) && !order.receivedAt;
  const hasActions = isCancellable || isReceivable || !!order.warehousePhone;
  const requestedSummary = getRetailerOrderFulfillmentSummary(
    order.items,
    getRetailerOrderItemOrderedQty,
  );
  const approvedSummary = getRetailerOrderFulfillmentSummary(
    order.items,
    getRetailerOrderItemEffectiveQty,
  );
  const flowSteps = buildRetailerFlow(order, timeline);

  const initReceiveItems = () => {
    const items: Record<number, number> = {};
    for (const item of order.items || []) {
      items[item.id] = item.modifiedQty ?? item.quantity;
    }
    setReceivedItems(items);
    setShowReceiveDialog(true);
  };

  const handleReceive = () => {
    const received = Object.entries(receivedItems).map(([id, quantity]) => ({
      itemId: Number(id),
      receivedQty: quantity,
    }));

    receiveMutation.mutate(
      { orderId: order.id, receivedItems: received },
      {
        onSuccess: () => {
          setShowReceiveDialog(false);
          router.refresh();
        },
      },
    );
  };

  const handleCancel = () => {
    cancelMutation.mutate(
      { orderId: order.id },
      {
        onSuccess: () => {
          setShowCancelDialog(false);
          router.push("/dashboard/orders");
        },
      },
    );
  };

  return (
    <div className="mx-auto max-w-[1280px] space-y-4 pb-24 xl:pb-12">
      <header className="flex items-start gap-3">
        <Button
          asChild
          variant="outline"
          size="icon"
          className="h-9 w-9 shrink-0 rounded-lg shadow-none"
        >
          <Link href="/dashboard/orders" aria-label="Back to retailer orders">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="font-mono text-xl font-bold tracking-tight text-foreground">
              {order.orderNumber}
            </h1>
            <Badge
              variant="outline"
              className={cn(
                "gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold",
                status.className,
              )}
            >
              <StatusIcon className="h-3 w-3" />
              {status.label}
            </Badge>
            {hasModifications && (
              <Badge
                variant="outline"
                className="gap-1.5 rounded-full border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700"
              >
                <AlertTriangle className="h-3 w-3" />
                Modified
              </Badge>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">
              {order.warehouseName}
            </span>
            <span aria-hidden="true"> · </span>
            <time dateTime={new Date(order.createdAt).toISOString()}>
              {formatDateTime(order.createdAt)}
            </time>
            <span aria-hidden="true"> · </span>
            {order.items?.length || 0} line item
            {(order.items?.length || 0) === 1 ? "" : "s"}
          </p>
        </div>
      </header>

      <section
        className="overflow-hidden rounded-lg border bg-card"
        aria-labelledby="order-progress-heading"
      >
        <header className="border-b bg-zinc-50/70 px-4 py-3">
          <h2
            id="order-progress-heading"
            className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
          >
            Order progress
          </h2>
        </header>
        <div className="p-4 sm:p-5">
          <OrderFlowStepper steps={flowSteps} variant="inline" />
        </div>
      </section>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <main className="min-w-0 space-y-4">
          <OrderItems items={order.items || []} />

          {(order.customerNote || order.adminNote) && (
            <section
              className="overflow-hidden rounded-lg border bg-card"
              aria-labelledby="order-notes-heading"
            >
              <header className="border-b px-4 py-3">
                <h2
                  id="order-notes-heading"
                  className="text-sm font-semibold text-foreground"
                >
                  Notes
                </h2>
              </header>
              <dl className="divide-y">
                {order.customerNote && (
                  <div className="grid gap-1 px-4 py-3 sm:grid-cols-[9rem_1fr] sm:gap-4">
                    <dt className="text-xs font-medium text-muted-foreground">
                      Your order note
                    </dt>
                    <dd className="text-sm text-foreground">
                      {order.customerNote}
                    </dd>
                  </div>
                )}
                {order.adminNote && (
                  <div className="grid gap-1 px-4 py-3 sm:grid-cols-[9rem_1fr] sm:gap-4">
                    <dt className="text-xs font-medium text-muted-foreground">
                      Warehouse note
                    </dt>
                    <dd className="text-sm text-foreground">
                      {order.adminNote}
                    </dd>
                  </div>
                )}
              </dl>
            </section>
          )}
        </main>

        <SummaryRail
          order={order}
          delivery={delivery}
          requestedSummary={requestedSummary}
          approvedSummary={approvedSummary}
          isCancellable={isCancellable}
          isReceivable={isReceivable}
          onCancel={() => setShowCancelDialog(true)}
          onReceive={initReceiveItems}
        />
      </div>

      {hasActions && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background px-4 py-3 xl:hidden">
          <div className="mx-auto max-w-[1280px]">
            <OrderActions
              warehousePhone={order.warehousePhone}
              isCancellable={isCancellable}
              isReceivable={isReceivable}
              onCancel={() => setShowCancelDialog(true)}
              onReceive={initReceiveItems}
              compact
            />
          </div>
        </div>
      )}

      <ReceiveOrderDialog
        open={showReceiveDialog}
        onOpenChange={setShowReceiveDialog}
        items={order.items || []}
        receivedItems={receivedItems}
        setReceivedItems={setReceivedItems}
        pending={receiveMutation.isPending}
        onConfirm={handleReceive}
      />

      <CancelOrderDialog
        open={showCancelDialog}
        onOpenChange={setShowCancelDialog}
        orderNumber={order.orderNumber}
        pending={cancelMutation.isPending}
        onConfirm={handleCancel}
      />
    </div>
  );
}

function OrderItems({ items }: { items: any[] }) {
  return (
    <section
      className="overflow-hidden rounded-lg border bg-card"
      aria-labelledby="order-items-heading"
    >
      <header className="flex items-center justify-between gap-3 border-b px-4 py-3">
        <div>
          <h2
            id="order-items-heading"
            className="text-sm font-semibold text-foreground"
          >
            Ordered items
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {items.length} line item{items.length === 1 ? "" : "s"}
          </p>
        </div>
      </header>

      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr className="border-b bg-zinc-50/70 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-3 font-semibold">Product</th>
              <th className="px-3 py-3 font-semibold">Mode</th>
              <th className="px-3 py-3 text-right font-semibold">Requested</th>
              <th className="px-3 py-3 text-right font-semibold">Approved</th>
              <th className="px-3 py-3 text-right font-semibold">Received</th>
              <th className="px-3 py-3 text-right font-semibold">Unit price</th>
              <th className="px-4 py-3 text-right font-semibold">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {items.map((item) => {
              const quantityChanged =
                item.modifiedQty !== null &&
                item.modifiedQty !== undefined &&
                item.modifiedQty !== item.quantity;
              const priceChanged =
                item.modifiedUnitPrice !== null &&
                item.modifiedUnitPrice !== undefined &&
                Number(item.modifiedUnitPrice) !== Number(item.unitPrice);
              const modified = quantityChanged || priceChanged;
              const approvedQuantity = getRetailerOrderItemEffectiveQty(item);
              const receivedQuantity = getRetailerOrderItemDeliveredQty(item);
              const approvedPrice = Number(
                item.modifiedUnitPrice ?? item.unitPrice ?? 0,
              );

              return (
                <tr
                  key={item.id}
                  className={cn(
                    "align-middle transition-colors hover:bg-zinc-50/60",
                    modified && "bg-amber-50/40",
                  )}
                >
                  <td className="px-4 py-3">
                    <ProductIdentity item={item} />
                  </td>
                  <td className="px-3 py-3">
                    <Badge
                      variant="outline"
                      className="rounded-md font-normal text-muted-foreground"
                    >
                      {item.supplyModeLabel || formatLabel(item.supplyMode)}
                    </Badge>
                  </td>
                  <td className="px-3 py-3 text-right font-mono text-xs tabular-nums text-muted-foreground">
                    {formatRetailerOrderItemQuantity(item.quantity, item)}
                  </td>
                  <td className="px-3 py-3 text-right font-mono text-xs tabular-nums">
                    <span
                      className={cn(
                        quantityChanged && "font-semibold text-amber-700",
                      )}
                    >
                      {formatRetailerOrderItemQuantity(approvedQuantity, item)}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right font-mono text-xs tabular-nums">
                    {formatRetailerOrderItemQuantity(receivedQuantity, item)}
                  </td>
                  <td className="px-3 py-3 text-right font-mono text-xs tabular-nums">
                    {priceChanged && (
                      <span className="mr-1.5 text-muted-foreground line-through">
                        {formatMoney(item.unitPrice)}
                      </span>
                    )}
                    <span
                      className={cn(
                        priceChanged && "font-semibold text-amber-700",
                      )}
                    >
                      {formatMoney(approvedPrice)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs font-semibold tabular-nums">
                    {formatMoney(approvedPrice * approvedQuantity)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="divide-y lg:hidden">
        {items.map((item) => {
          const quantityChanged =
            item.modifiedQty !== null &&
            item.modifiedQty !== undefined &&
            item.modifiedQty !== item.quantity;
          const priceChanged =
            item.modifiedUnitPrice !== null &&
            item.modifiedUnitPrice !== undefined &&
            Number(item.modifiedUnitPrice) !== Number(item.unitPrice);
          const approvedQuantity = getRetailerOrderItemEffectiveQty(item);
          const receivedQuantity = getRetailerOrderItemDeliveredQty(item);
          const approvedPrice = Number(
            item.modifiedUnitPrice ?? item.unitPrice ?? 0,
          );

          return (
            <article key={item.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <ProductIdentity item={item} />
                <Badge
                  variant="outline"
                  className="shrink-0 rounded-md font-normal text-muted-foreground"
                >
                  {item.supplyModeLabel || formatLabel(item.supplyMode)}
                </Badge>
              </div>

              <dl className="mt-4 grid grid-cols-2 gap-x-5 gap-y-3 sm:grid-cols-5">
                <MobileMetric
                  label="Requested"
                  value={formatRetailerOrderItemQuantity(item.quantity, item)}
                />
                <MobileMetric
                  label="Approved"
                  value={formatRetailerOrderItemQuantity(
                    approvedQuantity,
                    item,
                  )}
                  changed={quantityChanged}
                />
                <MobileMetric
                  label="Received"
                  value={formatRetailerOrderItemQuantity(
                    receivedQuantity,
                    item,
                  )}
                />
                <MobileMetric
                  label="Unit price"
                  value={formatMoney(approvedPrice)}
                  previousValue={
                    priceChanged ? formatMoney(item.unitPrice) : undefined
                  }
                  changed={priceChanged}
                />
                <MobileMetric
                  label="Total"
                  value={formatMoney(approvedPrice * approvedQuantity)}
                  strong
                />
              </dl>

              {(quantityChanged || priceChanged) && (
                <p className="mt-3 flex items-center gap-1.5 text-xs text-amber-700">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Warehouse adjusted this line item.
                </p>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function ProductIdentity({ item }: { item: any }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      {item.productImage ? (
        <Image
          src={item.productImage}
          alt=""
          width={40}
          height={40}
          className="h-10 w-10 shrink-0 rounded-md border object-cover"
        />
      ) : (
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border bg-zinc-50">
          <Package className="h-4 w-4 text-muted-foreground" />
        </div>
      )}
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-foreground">
          {item.productName}
        </p>
        <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">
          {item.variant?.sku || `ITEM-${item.id}`}
          {item.productSize ? ` · ${item.productSize}` : ""}
        </p>
      </div>
    </div>
  );
}

function MobileMetric({
  label,
  value,
  previousValue,
  changed,
  strong,
}: {
  label: string;
  value: string;
  previousValue?: string;
  changed?: boolean;
  strong?: boolean;
}) {
  return (
    <div>
      <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd
        className={cn(
          "mt-1 font-mono text-xs tabular-nums text-foreground",
          changed && "font-semibold text-amber-700",
          strong && "font-semibold",
        )}
      >
        {previousValue && (
          <span className="mr-1.5 text-muted-foreground line-through">
            {previousValue}
          </span>
        )}
        {value}
      </dd>
    </div>
  );
}

function SummaryRail({
  order,
  delivery,
  requestedSummary,
  approvedSummary,
  isCancellable,
  isReceivable,
  onCancel,
  onReceive,
}: {
  order: any;
  delivery: any;
  requestedSummary: ReturnType<typeof getRetailerOrderFulfillmentSummary>;
  approvedSummary: ReturnType<typeof getRetailerOrderFulfillmentSummary>;
  isCancellable: boolean;
  isReceivable: boolean;
  onCancel: () => void;
  onReceive: () => void;
}) {
  const paymentStatus = formatLabel(order.paymentStatus);
  const paymentStatusClass =
    order.paymentStatus === "paid"
      ? "text-emerald-700"
      : order.paymentStatus
        ? "text-amber-700"
        : "text-muted-foreground";
  const hasTracking =
    delivery.trackingId || delivery.riderName || delivery.riderPhone;

  return (
    <aside className="xl:sticky xl:top-4" aria-label="Order summary">
      <div className="overflow-hidden rounded-lg border bg-card">
        <RailSection title="Order summary">
          <dl className="space-y-3">
            <SummaryValue
              label="Requested"
              value={requestedSummary.primary}
              secondary={requestedSummary.secondary}
            />
            <SummaryValue
              label="Approved"
              value={approvedSummary.primary}
              secondary={approvedSummary.secondary}
            />
          </dl>

          <Separator className="my-4" />

          <dl className="space-y-2.5 text-sm">
            <MoneyRow label="Subtotal" value={order.subtotal} />
            {Number(order.discount) > 0 && (
              <MoneyRow
                label="Discount"
                value={-Number(order.discount)}
                tone="discount"
              />
            )}
            {Number(order.shippingCost) > 0 && (
              <MoneyRow label="Shipping" value={order.shippingCost} />
            )}
          </dl>

          <Separator className="my-4" />

          <div className="flex items-end justify-between gap-4">
            <span className="text-sm font-semibold text-foreground">Total</span>
            <span className="font-mono text-lg font-bold tabular-nums text-foreground">
              {formatMoney(order.total)}
            </span>
          </div>
        </RailSection>

        <RailSection title="Payment" divided>
          <dl className="space-y-2.5 text-sm">
            <InfoPair
              label="Status"
              value={paymentStatus}
              valueClassName={paymentStatusClass}
            />
            <InfoPair label="Method" value={formatLabel(order.paymentMethod)} />
          </dl>
        </RailSection>

        <RailSection title="Delivery" divided>
          <div className="flex gap-2.5">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <address className="min-w-0 text-sm not-italic text-foreground">
              <p className="font-medium">{order.shippingName}</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {order.shippingAddress}
                <br />
                {order.shippingArea ? `${order.shippingArea}, ` : ""}
                {order.shippingCity}
              </p>
              <a
                href={`tel:${order.shippingPhone}`}
                className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-blue-700 hover:underline"
              >
                <Phone className="h-3 w-3" />
                {order.shippingPhone}
              </a>
            </address>
          </div>

          {hasTracking && (
            <dl className="mt-4 space-y-2.5 border-t pt-4 text-sm">
              {delivery.trackingId && (
                <InfoPair label="Tracking" value={delivery.trackingId} mono />
              )}
              {delivery.riderName && (
                <InfoPair label="Rider" value={delivery.riderName} />
              )}
              {delivery.riderPhone && (
                <InfoPair
                  label="Rider phone"
                  value={delivery.riderPhone}
                  mono
                />
              )}
            </dl>
          )}
        </RailSection>

        <RailSection title="Supplier" divided>
          <div className="flex items-start gap-2.5">
            <Warehouse className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">
                {order.warehouseName}
              </p>
              {order.warehousePhone && (
                <a
                  href={`tel:${order.warehousePhone}`}
                  className="mt-1.5 inline-flex items-center gap-1.5 font-mono text-xs text-blue-700 hover:underline"
                >
                  <Phone className="h-3 w-3" />
                  {order.warehousePhone}
                </a>
              )}
            </div>
          </div>
        </RailSection>

        {(isCancellable || isReceivable || order.warehousePhone) && (
          <div className="hidden border-t p-4 xl:block">
            <OrderActions
              warehousePhone={order.warehousePhone}
              isCancellable={isCancellable}
              isReceivable={isReceivable}
              onCancel={onCancel}
              onReceive={onReceive}
            />
          </div>
        )}
      </div>
    </aside>
  );
}

function RailSection({
  title,
  children,
  divided,
}: {
  title: string;
  children: React.ReactNode;
  divided?: boolean;
}) {
  return (
    <section className={cn("p-4", divided && "border-t")}>
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h2>
      {children}
    </section>
  );
}

function SummaryValue({
  label,
  value,
  secondary,
}: {
  label: string;
  value: string;
  secondary?: string | null;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-right">
        <p className="font-mono text-sm font-semibold tabular-nums text-foreground">
          {value}
        </p>
        {secondary && (
          <p className="mt-0.5 max-w-44 text-xs leading-4 text-muted-foreground">
            {secondary}
          </p>
        )}
      </dd>
    </div>
  );
}

function MoneyRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: unknown;
  tone?: "discount";
}) {
  const amount = Number(value || 0);

  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "font-mono text-xs font-medium tabular-nums text-foreground",
          tone === "discount" && "text-emerald-700",
        )}
      >
        {amount < 0 ? `−${formatMoney(Math.abs(amount))}` : formatMoney(amount)}
      </dd>
    </div>
  );
}

function InfoPair({
  label,
  value,
  mono,
  valueClassName,
}: {
  label: string;
  value: string;
  mono?: boolean;
  valueClassName?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "text-right text-xs font-medium text-foreground",
          mono && "font-mono tabular-nums",
          valueClassName,
        )}
      >
        {value}
      </dd>
    </div>
  );
}

function OrderActions({
  warehousePhone,
  isCancellable,
  isReceivable,
  onCancel,
  onReceive,
  compact,
}: {
  warehousePhone?: string | null;
  isCancellable: boolean;
  isReceivable: boolean;
  onCancel: () => void;
  onReceive: () => void;
  compact?: boolean;
}) {
  return (
    <div className={cn("flex gap-2", compact ? "flex-row" : "flex-col")}>
      {isReceivable && (
        <Button
          type="button"
          onClick={onReceive}
          className="min-w-0 flex-1 bg-blue-700 text-white hover:bg-blue-800"
          size="sm"
        >
          <PackageCheck className="h-4 w-4" />
          <span className="truncate">Mark received</span>
        </Button>
      )}
      {warehousePhone && (
        <Button
          asChild
          variant="outline"
          size="sm"
          className="min-w-0 flex-1 shadow-none"
        >
          <a href={`tel:${warehousePhone}`}>
            <Phone className="h-4 w-4" />
            <span className="truncate">Contact</span>
          </a>
        </Button>
      )}
      {isCancellable && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="min-w-0 flex-1 border-red-200 text-red-700 shadow-none hover:bg-red-50 hover:text-red-800"
          onClick={onCancel}
        >
          <Ban className="h-4 w-4" />
          <span className="truncate">Cancel</span>
        </Button>
      )}
    </div>
  );
}

function ReceiveOrderDialog({
  open,
  onOpenChange,
  items,
  receivedItems,
  setReceivedItems,
  pending,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: any[];
  receivedItems: Record<number, number>;
  setReceivedItems: React.Dispatch<
    React.SetStateAction<Record<number, number>>
  >;
  pending: boolean;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="border-b px-5 py-4 text-left">
          <DialogTitle className="flex items-center gap-2 text-base">
            <PackageCheck className="h-4 w-4 text-blue-700" />
            Confirm receipt
          </DialogTitle>
          <DialogDescription>
            Verify each received quantity before completing this order.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[52vh] divide-y overflow-y-auto">
          {items.map((item) => {
            const expectedQuantity = getRetailerOrderItemEffectiveQty(item);
            const currentQuantity = receivedItems[item.id] ?? expectedQuantity;
            const matches = currentQuantity === expectedQuantity;

            return (
              <div key={item.id} className="flex items-center gap-3 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">
                    {item.productName}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Expected:{" "}
                    {formatRetailerOrderItemQuantity(expectedQuantity, item)}
                  </p>
                </div>
                <label className="sr-only" htmlFor={`received-${item.id}`}>
                  Received quantity for {item.productName}
                </label>
                <Input
                  id={`received-${item.id}`}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  className={cn(
                    "h-9 w-20 text-center font-mono text-sm tabular-nums",
                    !matches && "border-amber-300 focus-visible:ring-amber-200",
                  )}
                  value={currentQuantity}
                  onChange={(event) => {
                    const value = event.target.value.replace(/[^0-9]/g, "");
                    setReceivedItems((current) => ({
                      ...current,
                      [item.id]: Number(value) || 0,
                    }));
                  }}
                />
                <CheckCircle2
                  className={cn(
                    "h-4 w-4 shrink-0",
                    matches ? "text-emerald-600" : "text-zinc-200",
                  )}
                  aria-hidden="true"
                />
              </div>
            );
          })}
        </div>

        <DialogFooter className="border-t bg-zinc-50/70 px-5 py-4 sm:justify-between">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={pending}
            className="shadow-none"
          >
            Back
          </Button>
          <Button
            onClick={onConfirm}
            disabled={pending}
            className="bg-blue-700 text-white hover:bg-blue-800"
          >
            {pending ? (
              <Loader className="h-4 w-4 animate-spin" />
            ) : (
              <PackageCheck className="h-4 w-4" />
            )}
            Confirm receipt
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CancelOrderDialog({
  open,
  onOpenChange,
  orderNumber,
  pending,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderNumber: string;
  pending: boolean;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Ban className="h-4 w-4 text-red-700" />
            Cancel order
          </DialogTitle>
          <DialogDescription>
            Cancel {orderNumber}? Reserved warehouse inventory will be restored.
            This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={pending}
            className="shadow-none"
          >
            Keep order
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={pending}>
            {pending ? (
              <Loader className="h-4 w-4 animate-spin" />
            ) : (
              <XCircle className="h-4 w-4" />
            )}
            Cancel order
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DetailSkeleton() {
  return (
    <div className="mx-auto max-w-[1280px] space-y-4">
      <div className="flex items-center gap-3">
        <Skeleton className="h-9 w-9 rounded-lg" />
        <div className="space-y-2">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
      </div>
      <Skeleton className="h-32 w-full rounded-lg" />
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="overflow-hidden rounded-lg border">
          <Skeleton className="h-14 w-full rounded-none" />
          <div className="space-y-px">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-16 w-full rounded-none" />
            ))}
          </div>
        </div>
        <Skeleton className="h-[560px] w-full rounded-lg" />
      </div>
    </div>
  );
}
