"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import {
  markInvoiceDelivered,
  markInvoiceFailed,
} from "@/actions/delivery/deliveryman-actions";
import { DELIVERY_BASE } from "@/lib/routes";
import { DeliveredModal } from "./delivered-modal";
import { FailedModal } from "./failed-modal";
import { InvoicesList } from "./invoices-list";
import { StartDeliveryCard } from "./start-delivery-card";
import type { ActionType, DeliveryExecutionProps } from "./types";

export function DeliveryExecution({ group }: DeliveryExecutionProps) {
  const router = useRouter();
  const queryClient = useQueryClient();

  // Modal state
  const [deliveredInvoiceId, setDeliveredInvoiceId] = React.useState<
    number | null
  >(null);
  const [failedInvoiceId, setFailedInvoiceId] = React.useState<number | null>(
    null,
  );
  const [otp, setOtp] = React.useState("");
  const [failReason, setFailReason] = React.useState("");

  // Invalidate queries and refresh
  const refreshData = React.useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["delivery-group", group.id] });
    window.location.reload();
  }, [queryClient, group.id]);

  // Reset modal state
  const closeDeliveredModal = React.useCallback(() => {
    setDeliveredInvoiceId(null);
    setOtp("");
  }, []);

  const closeFailedModal = React.useCallback(() => {
    setFailedInvoiceId(null);
    setFailReason("");
  }, []);

  // Mark delivered mutation
  const deliveredMutation = useMutation({
    mutationFn: (params: { invoiceId: number; otp: string }) =>
      markInvoiceDelivered({
        deliveryInvoiceId: params.invoiceId,
        deliveryOtp: params.otp,
      }),
    onSuccess: (result) => {
      if (result.success) {
        toast.success("Invoice marked as delivered");
        closeDeliveredModal();
        refreshData();
      } else {
        toast.error(result.error || "Failed to mark delivered");
      }
    },
    onError: () => {
      toast.error("Something went wrong");
    },
  });

  // Mark failed mutation
  const failedMutation = useMutation({
    mutationFn: (params: { invoiceId: number; reason: string }) =>
      markInvoiceFailed({
        deliveryInvoiceId: params.invoiceId,
        failedReason: params.reason,
      }),
    onSuccess: (result) => {
      if (result.success) {
        toast.success("Invoice marked as failed");
        closeFailedModal();
        refreshData();
      } else {
        toast.error(result.error || "Failed to update status");
      }
    },
    onError: () => {
      toast.error("Something went wrong");
    },
  });

  // Handle action button click
  const handleAction = React.useCallback(
    (invoiceId: number, type: ActionType) => {
      if (type === "delivered") {
        setDeliveredInvoiceId(invoiceId);
      } else if (type === "failed") {
        setFailedInvoiceId(invoiceId);
      } else if (type === "return") {
        // Navigate to return processing page with the invoice ID
        router.push(`${DELIVERY_BASE}/returns/process/${invoiceId}`);
      }
    },
    [router],
  );

  // Handle delivered confirm
  const handleDeliveredConfirm = React.useCallback(() => {
    if (!deliveredInvoiceId) return;
    deliveredMutation.mutate({ invoiceId: deliveredInvoiceId, otp });
  }, [deliveredInvoiceId, otp, deliveredMutation]);

  // Handle failed confirm
  const handleFailedConfirm = React.useCallback(() => {
    if (!failedInvoiceId) return;
    if (!failReason.trim()) {
      toast.error("Please provide a reason for failure");
      return;
    }
    failedMutation.mutate({ invoiceId: failedInvoiceId, reason: failReason });
  }, [failedInvoiceId, failReason, failedMutation]);

  // Determine if actions can be taken (only when delivery has started)
  const canTakeAction = group.status === "out_for_delivery";
  const showStartCard = group.status === "assigned";

  return (
    <div className="space-y-6">
      {/* Show Start Delivery card at top when not started */}
      {showStartCard && (
        <StartDeliveryCard groupId={group.id} onSuccess={refreshData} />
      )}

      <DeliveredModal
        open={!!deliveredInvoiceId}
        isLoading={deliveredMutation.isPending}
        otp={otp}
        onOtpChange={setOtp}
        onClose={closeDeliveredModal}
        onConfirm={handleDeliveredConfirm}
      />

      <FailedModal
        open={!!failedInvoiceId}
        isLoading={failedMutation.isPending}
        reason={failReason}
        onReasonChange={setFailReason}
        onClose={closeFailedModal}
        onConfirm={handleFailedConfirm}
      />

      {/* Always show invoices list - view-only when not started */}
      <InvoicesList
        invoices={group.invoices}
        canTakeAction={canTakeAction}
        onAction={handleAction}
      />
    </div>
  );
}
