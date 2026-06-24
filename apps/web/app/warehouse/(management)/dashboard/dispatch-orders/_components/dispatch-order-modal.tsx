"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import {
  CheckCircle2,
  ExternalLink,
  Loader2,
  MapPin,
  Package,
  Truck,
  User,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { OrderFlowStepper } from "@/app/warehouse/(management)/dashboard/order-management/[id]/_components/order-flow-stepper";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { orpc } from "@/utils/orpc";
import type { DispatchOrderRow } from "./dispatch-columns";
import { DispatchItemTable } from "./dispatch-item-table";
import {
  buildDefaultQuantities,
  customerName,
  type DispatchModalMode,
  type FulfillmentMode,
  getDispatchModalMode,
  getLatestPendingInvoice,
  getPendingPickupInvoice,
} from "./dispatch-utils";

function formatMoney(value: string | number) {
  return `৳ ${Number(value || 0).toLocaleString("en-BD")}`;
}

type DispatchStrategy = "full" | "partial";

type PostSubmitState =
  | { kind: "idle" }
  | {
      kind: "self_pickup";
      invoiceId: number;
      invoiceNumber: string;
    }
  | {
      kind: "delivery";
      invoiceNumber: string;
    }
  | { kind: "pickup_complete" };

type DispatchOrderModalProps = {
  open: boolean;
  order: DispatchOrderRow | null;
  actionLoading: string | null;
  onClose: () => void;
  onActionStart: (key: string) => void;
  onActionEnd: () => void;
  onSuccess: () => void;
};

function StrategyOption({
  value,
  selected,
  title,
  description,
  onSelect,
}: {
  value: DispatchStrategy;
  selected: boolean;
  title: string;
  description: string;
  onSelect: (value: DispatchStrategy) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(value)}
      className={cn(
        "flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors",
        selected
          ? "border-violet-500 bg-violet-50/50"
          : "border-border hover:bg-muted/40",
      )}
    >
      <span
        className={cn(
          "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2",
          selected ? "border-violet-600 bg-violet-600" : "border-muted-foreground/40",
        )}
      >
        {selected ? (
          <span className="h-1.5 w-1.5 rounded-full bg-white" />
        ) : null}
      </span>
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      </div>
    </button>
  );
}

function DeliveryModeOption({
  value,
  selected,
  title,
  description,
  onSelect,
}: {
  value: FulfillmentMode;
  selected: boolean;
  title: string;
  description: string;
  onSelect: (value: FulfillmentMode) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(value)}
      className={cn(
        "flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors",
        selected
          ? "border-blue-500 bg-blue-50/50"
          : "border-border hover:bg-muted/40",
      )}
    >
      <span
        className={cn(
          "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2",
          selected ? "border-blue-600 bg-blue-600" : "border-muted-foreground/40",
        )}
      >
        {selected ? (
          <span className="h-1.5 w-1.5 rounded-full bg-white" />
        ) : null}
      </span>
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      </div>
    </button>
  );
}

export function DispatchOrderModal({
  open,
  order,
  actionLoading,
  onClose,
  onActionStart,
  onActionEnd,
  onSuccess,
}: DispatchOrderModalProps) {
  const [strategy, setStrategy] = useState<DispatchStrategy>("full");
  const [fulfillmentMode, setFulfillmentMode] =
    useState<FulfillmentMode>("delivery");
  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const [postSubmit, setPostSubmit] = useState<PostSubmitState>({ kind: "idle" });
  const [otpInput, setOtpInput] = useState("");

  const modalMode: DispatchModalMode | null = order
    ? getDispatchModalMode(order)
    : null;

  const { data: orderDetail } = useQuery({
    queryKey: ["warehouse", "order-detail", order?.id],
    queryFn: () =>
      orpc.warehouse.getOrderDetail.call({ orderId: order!.id }),
    enabled: open && !!order?.id,
  });

  useEffect(() => {
    if (!open || !order) return;
    setStrategy("full");
    setFulfillmentMode("delivery");
    setQuantities(buildDefaultQuantities(order));
    setPostSubmit({ kind: "idle" });
    setOtpInput("");

    const pendingPickup = getPendingPickupInvoice(order);
    if (pendingPickup) {
      setPostSubmit({
        kind: "self_pickup",
        invoiceId: pendingPickup.id,
        invoiceNumber: pendingPickup.invoiceNumber,
      });
    }
  }, [open, order]);

  useEffect(() => {
    if (strategy === "full" && order) {
      setQuantities(buildDefaultQuantities(order));
    }
  }, [strategy, order]);

  const selectedTotal = useMemo(() => {
    if (!order) return 0;
    return order.items.reduce((sum, item) => {
      const quantity = quantities[item.orderItemId] ?? 0;
      return sum + quantity * Number(item.unitPrice);
    }, 0);
  }, [order, quantities]);

  const confirmMutation = useMutation({
    mutationFn: (input: Parameters<typeof orpc.warehouse.confirmDispatch.call>[0]) =>
      orpc.warehouse.confirmDispatch.call(input),
    onSuccess: (result) => {
      toast.success(result.message || "Dispatch confirmed");
      onSuccess();

      if (result.fulfillmentMode === "self_pickup") {
        setPostSubmit({
          kind: "self_pickup",
          invoiceId: result.invoiceId,
          invoiceNumber: result.invoiceNumber,
        });
      } else {
        setPostSubmit({
          kind: "delivery",
          invoiceNumber: result.invoiceNumber,
        });
      }
    },
    onError: (error) =>
      toast.error(error.message || "Failed to confirm dispatch"),
    onSettled: () => onActionEnd(),
  });

  const verifyOtpMutation = useMutation({
    mutationFn: (input: { invoiceId: number; otp: string }) =>
      orpc.warehouse.verifySelfPickupOtp.call(input),
    onSuccess: (result) => {
      toast.success(result.message || "Self pickup completed");
      setPostSubmit({ kind: "pickup_complete" });
      onSuccess();
    },
    onError: (error) =>
      toast.error(error.message || "Invalid pickup OTP"),
    onSettled: () => onActionEnd(),
  });

  const handleQuantityChange = (
    orderItemId: number,
    remainingQty: number,
    nextQuantity: number,
  ) => {
    setQuantities((current) => ({
      ...current,
      [orderItemId]: Math.max(
        0,
        Math.min(remainingQty, Number.isFinite(nextQuantity) ? nextQuantity : 0),
      ),
    }));
  };

  const handleConfirm = () => {
    if (!order) return;

    if (modalMode === "configure") {
      const pendingInvoice = getLatestPendingInvoice(order);
      if (!pendingInvoice) {
        toast.error("No invoice waiting for delivery mode");
        return;
      }
      onActionStart(`confirm-${order.id}`);
      confirmMutation.mutate({
        mode: "configure",
        invoiceId: pendingInvoice.id,
        fulfillmentMode,
      });
      return;
    }

    const items =
      strategy === "partial"
        ? order.items
            .map((item) => ({
              orderItemId: item.orderItemId,
              quantity: quantities[item.orderItemId] ?? 0,
            }))
            .filter((item) => item.quantity > 0)
        : undefined;

    if (strategy === "partial" && (!items || items.length === 0)) {
      toast.error("Select at least one item quantity");
      return;
    }

    onActionStart(`confirm-${order.id}`);
    confirmMutation.mutate({
      mode: "create",
      orderId: order.id,
      strategy,
      items,
      fulfillmentMode,
    });
  };

  const handleVerifyOtp = () => {
    if (postSubmit.kind !== "self_pickup") return;
    if (otpInput.length !== 4) {
      toast.error("Enter the 4-digit OTP");
      return;
    }
    onActionStart(`otp-${postSubmit.invoiceId}`);
    verifyOtpMutation.mutate({
      invoiceId: postSubmit.invoiceId,
      otp: otpInput,
    });
  };

  const isLoading =
    !!actionLoading &&
    (actionLoading === `confirm-${order?.id}` ||
      actionLoading.startsWith("otp-"));

  const primaryLabel = useMemo(() => {
    if (modalMode === "configure") {
      return fulfillmentMode === "self_pickup"
        ? "Set Self Pickup"
        : "Send to Delivery";
    }
    if (strategy === "partial") {
      return fulfillmentMode === "self_pickup"
        ? "Create Partial Invoice & Pickup"
        : "Create Partial Invoice & Send to Delivery";
    }
    return fulfillmentMode === "self_pickup"
      ? "Generate Pickup Invoice"
      : "Confirm & Send to Delivery";
  }, [modalMode, strategy, fulfillmentMode]);

  const invoiceBadge =
    order?.status === "partially_invoiced"
      ? "Partial"
      : order?.status === "invoiced"
        ? "Full"
        : "Ready";

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="flex max-h-[90vh] w-[calc(100vw-1.5rem)] max-w-2xl flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="space-y-1.5 border-b px-5 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <DialogTitle className="text-base font-semibold">
              {order ? `Order #${order.orderNumber}` : "Dispatch Order"}
            </DialogTitle>
            {order ? (
              <Badge variant="outline" className="text-xs">
                {invoiceBadge}
              </Badge>
            ) : null}
          </div>
          {order ? (
            <DialogDescription asChild>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <User className="h-3 w-3" />
                  {customerName(order)}
                </span>
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {order.shipping.area || order.shipping.city || "—"}
                </span>
              </div>
            </DialogDescription>
          ) : null}
        </DialogHeader>

        <div className="space-y-4 overflow-y-auto px-5 py-4">
          {orderDetail?.flow?.length ? (
            <OrderFlowStepper steps={orderDetail.flow} variant="inline" />
          ) : null}

          {postSubmit.kind === "pickup_complete" ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-4 text-center">
              <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" />
              <p className="mt-2 font-semibold text-emerald-900">
                Self Pickup Complete
              </p>
              <ul className="mt-3 space-y-1 text-left text-xs text-emerald-800">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                  Invoice generated
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                  Stock reduced
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                  Finance updated & settlement complete
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                  Order marked completed
                </li>
              </ul>
            </div>
          ) : postSubmit.kind === "delivery" ? (
            <div className="rounded-lg border border-blue-200 bg-blue-50/60 p-4">
              <div className="flex items-start gap-3">
                <Truck className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
                <div>
                  <p className="font-semibold text-blue-900">
                    Invoice saved for delivery
                  </p>
                  <p className="mt-1 text-xs text-blue-800">
                    Invoice {postSubmit.invoiceNumber} is ready in Delivery
                    Management. Create a delivery group when you are ready to
                    assign a rider.
                  </p>
                  <Link
                    href="/warehouse/dashboard/delivery-management"
                    className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-blue-700 underline-offset-2 hover:underline"
                  >
                    Open Delivery Management
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            </div>
          ) : postSubmit.kind === "self_pickup" ? (
            <div className="space-y-4">
              <p className="text-center text-sm text-muted-foreground">
                Ask the customer for their pickup code
              </p>
              <div className="flex flex-col items-center space-y-2">
                <Label htmlFor="pickup-otp" className="sr-only">
                  Pickup code
                </Label>
                <input
                  id="pickup-otp"
                  type="text"
                  inputMode="numeric"
                  maxLength={4}
                  value={otpInput}
                  onChange={(e) =>
                    setOtpInput(e.target.value.replace(/\D/g, "").slice(0, 4))
                  }
                  placeholder="0000"
                  className="h-10 w-[140px] rounded-lg border bg-background px-3 text-center font-mono text-lg tracking-widest outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
                />
              </div>
            </div>
          ) : order ? (
            <>
              {modalMode === "dispatch" ? (
                <>
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Dispatch Strategy
                    </p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <StrategyOption
                        value="full"
                        selected={strategy === "full"}
                        title="Full Dispatch"
                        description="Invoice all remaining approved quantities"
                        onSelect={setStrategy}
                      />
                      <StrategyOption
                        value="partial"
                        selected={strategy === "partial"}
                        title="Partial Dispatch"
                        description="Choose how much to send in this invoice"
                        onSelect={setStrategy}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Item Dispatch Control
                    </p>
                    <DispatchItemTable
                      items={order.items}
                      quantities={quantities}
                      readOnly={strategy === "full"}
                      onQuantityChange={handleQuantityChange}
                    />
                  </div>
                </>
              ) : modalMode === "configure" ? (
                <div className="rounded-lg border bg-muted/30 p-3.5 text-xs text-muted-foreground">
                  <Package className="mb-1 inline h-3.5 w-3.5" /> All quantities
                  are invoiced. Select how this invoice will be fulfilled.
                </div>
              ) : null}

              {(modalMode === "dispatch" || modalMode === "configure") && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Delivery Mode
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <DeliveryModeOption
                      value="delivery"
                      selected={fulfillmentMode === "delivery"}
                      title="Delivery"
                      description="Delivery charge applies. Invoice goes to Delivery Management."
                      onSelect={setFulfillmentMode}
                    />
                    <DeliveryModeOption
                      value="self_pickup"
                      selected={fulfillmentMode === "self_pickup"}
                      title="Self Pickup"
                      description="No delivery charge. Complete with OTP at handover."
                      onSelect={setFulfillmentMode}
                    />
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-col gap-3 border-t bg-muted/30 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          {postSubmit.kind === "idle" && modalMode !== "pickup" && order ? (
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Invoice Total
              </p>
              <p className="mt-0.5 text-lg font-semibold tabular-nums">
                {formatMoney(
                  modalMode === "configure"
                    ? getLatestPendingInvoice(order)?.grandTotal ?? 0
                    : selectedTotal,
                )}
              </p>
            </div>
          ) : (
            <div />
          )}

          <div className="flex shrink-0 flex-wrap justify-end gap-2">
            {postSubmit.kind === "pickup_complete" || postSubmit.kind === "delivery" ? (
              <Button type="button" size="sm" onClick={onClose}>
                Close
              </Button>
            ) : postSubmit.kind === "self_pickup" ? (
              <>
                <Button type="button" variant="outline" size="sm" onClick={onClose}>
                  Close
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="bg-violet-600 hover:bg-violet-700"
                  disabled={isLoading || otpInput.length !== 4}
                  onClick={() => void handleVerifyOtp()}
                >
                  {isLoading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : null}
                  Verify Pickup
                </Button>
              </>
            ) : (
              <>
                <Button type="button" variant="outline" size="sm" onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="bg-violet-600 hover:bg-violet-700"
                  disabled={
                    isLoading ||
                    !order ||
                    (modalMode === "dispatch" && selectedTotal <= 0)
                  }
                  onClick={() => void handleConfirm()}
                >
                  {isLoading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : null}
                  {primaryLabel}
                </Button>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
