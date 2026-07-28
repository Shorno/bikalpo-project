"use client";

import { KeyRound, Loader2, Store, Truck } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
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
import {
  useConfigureIncomingOrderFulfillment,
  useCreateIncomingOrderInvoice,
  useVerifyIncomingSelfPickup,
} from "@/hooks/use-shop-owner-api";

type RetailDispatchOrder = {
  id: number;
  status: string;
  invoice?: {
    id: number;
    invoiceNumber: string;
    fulfillmentMode: string | null;
    deliveryStatus: string;
  } | null;
};

export function RetailerDispatchModal({
  order,
  open,
  pickupAvailable,
  pickupLocation,
  onOpenChange,
  onSuccess,
}: {
  order: RetailDispatchOrder | null;
  open: boolean;
  pickupAvailable: boolean;
  pickupLocation: {
    name: string | null;
    address: string;
    phone: string | null;
  } | null;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}) {
  const createInvoice = useCreateIncomingOrderInvoice();
  const configureInvoice = useConfigureIncomingOrderFulfillment();
  const verifyPickup = useVerifyIncomingSelfPickup();
  const [fulfillmentMode, setFulfillmentMode] = useState<
    "delivery" | "self_pickup"
  >("delivery");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"select" | "verify">("select");

  const isPending =
    createInvoice.isPending ||
    configureInvoice.isPending ||
    verifyPickup.isPending;
  const isExistingPickup =
    order?.invoice?.fulfillmentMode === "self_pickup" &&
    order.invoice.deliveryStatus !== "delivered";
  const deliveryLocked =
    order?.invoice?.fulfillmentMode === "internal_delivery" ||
    order?.invoice?.fulfillmentMode === "delivery";
  const isConfigure =
    order?.status === "invoiced" &&
    !!order.invoice &&
    !order.invoice.fulfillmentMode;

  useEffect(() => {
    if (!open || !order) return;
    setFulfillmentMode(
      order.invoice?.fulfillmentMode === "self_pickup"
        ? "self_pickup"
        : "delivery",
    );
    setOtp("");
    setStep(isExistingPickup ? "verify" : "select");
  }, [open, order, isExistingPickup]);

  const handleSubmit = () => {
    if (!order) return;
    if (step === "verify") {
      if (!order.invoice || otp.length !== 4) {
        toast.error("Enter the consumer's 4-digit pickup OTP");
        return;
      }
      verifyPickup.mutate(
        { invoiceId: order.invoice.id, otp },
        {
          onSuccess: () => {
            toast.success("Self pickup completed and payment recorded");
            onSuccess();
            onOpenChange(false);
          },
          onError: (error) => toast.error(error.message),
        },
      );
      return;
    }

    if (fulfillmentMode === "self_pickup" && !pickupAvailable) {
      toast.error("Add a shop address before offering self pickup");
      return;
    }
    if (deliveryLocked) {
      onOpenChange(false);
      return;
    }

    const input = {
      fulfillmentMode,
      ...(isConfigure && order.invoice
        ? { invoiceId: order.invoice.id }
        : { orderId: order.id }),
    };
    const mutation = isConfigure ? configureInvoice : createInvoice;
    mutation.mutate(input as never, {
      onSuccess: (result) => {
        if (fulfillmentMode === "self_pickup") {
          toast.success("Pickup invoice is ready");
          setStep("verify");
        } else {
          toast.success("Full delivery invoice created");
          onSuccess();
          onOpenChange(false);
        }
        return result;
      },
      onError: (error) => toast.error(error.message),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {step === "verify" ? "Complete self pickup" : "Dispatch order"}
          </DialogTitle>
          <DialogDescription>
            {step === "verify"
              ? "Ask the consumer to show the Pickup OTP only after the products are physically handed over."
              : "Create one full invoice and choose how the consumer will receive it."}
          </DialogDescription>
        </DialogHeader>

        {step === "verify" ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
              <div className="flex items-start gap-3">
                <KeyRound className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <p className="font-semibold">Verify Pickup OTP</p>
                  <p className="mt-1 text-amber-900/80">
                    This records the counter payment and marks the consumer
                    order delivered and received.
                  </p>
                </div>
              </div>
            </div>
            <input
              aria-label="Pickup OTP"
              inputMode="numeric"
              maxLength={4}
              value={otp}
              onChange={(event) =>
                setOtp(event.target.value.replace(/\D/g, "").slice(0, 4))
              }
              placeholder="0000"
              className="h-12 w-full rounded-lg border bg-background text-center font-mono text-2xl tracking-[0.4em] outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
            />
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Fulfillment mode
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <ModeOption
                selected={fulfillmentMode === "delivery"}
                title="Delivery"
                description="Send the invoice to Delivery Management."
                icon={Truck}
                onClick={() => setFulfillmentMode("delivery")}
              />
              <ModeOption
                selected={fulfillmentMode === "self_pickup"}
                disabled={!pickupAvailable || deliveryLocked}
                title="Self Pickup"
                description={
                  deliveryLocked
                    ? "This invoice is already committed to delivery."
                    : pickupAvailable
                      ? "No delivery charge. Verify OTP at handover."
                      : "Add a shop address to enable pickup."
                }
                icon={Store}
                onClick={() => setFulfillmentMode("self_pickup")}
              />
            </div>
            {fulfillmentMode === "self_pickup" && pickupLocation && (
              <div className="rounded-lg border bg-muted/30 p-3 text-sm">
                <p className="font-medium">
                  {pickupLocation.name || "Retailer shop"}
                </p>
                <p className="mt-1 text-muted-foreground">
                  {pickupLocation.address}
                </p>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Close
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={isPending || (step === "verify" && otp.length !== 4)}
          >
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {step === "verify"
              ? "Verify Pickup"
              : deliveryLocked
                ? "Close"
                : isConfigure
                  ? fulfillmentMode === "self_pickup"
                    ? "Set Self Pickup"
                    : "Send to Delivery"
                  : fulfillmentMode === "self_pickup"
                    ? "Create Pickup Invoice"
                    : "Create Delivery Invoice"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ModeOption({
  selected,
  disabled,
  title,
  description,
  icon: Icon,
  onClick,
}: {
  selected: boolean;
  disabled?: boolean;
  title: string;
  description: string;
  icon: typeof Truck;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`rounded-lg border p-3 text-left transition-colors ${
        selected
          ? "border-primary bg-primary/5 ring-1 ring-primary/30"
          : "hover:bg-muted/50"
      } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
    >
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4" />
        <span className="font-medium">{title}</span>
        {selected && <Badge className="ml-auto">Selected</Badge>}
      </div>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">
        {description}
      </p>
    </button>
  );
}
