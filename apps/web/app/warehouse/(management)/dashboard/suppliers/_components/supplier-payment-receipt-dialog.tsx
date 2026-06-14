"use client";

import { Loader2, Printer, Share2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
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
  buildSupplierPaymentReceiptHtml,
  printHtmlContent,
  sharePurchaseDocument,
} from "./purchase-print";

function formatMoney(value: number) {
  return `৳${value.toLocaleString("en-BD", { maximumFractionDigits: 2 })}`;
}

export function SupplierPaymentReceiptDialog({
  open,
  onOpenChange,
  warehouseLabel,
  supplierName,
  purchaseNumber,
  payment,
  invoiceTotal,
  totalPaidAfter,
  remainingDue,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  warehouseLabel: string;
  supplierName: string;
  purchaseNumber: string;
  payment: {
    amount: number;
    paymentMethod: string;
    referenceNo?: string;
  } | null;
  invoiceTotal: number;
  totalPaidAfter: number;
  remainingDue: number;
}) {
  const [isSharing, setIsSharing] = useState(false);

  if (!payment) return null;

  const methodLabel =
    payment.paymentMethod === "mobile_banking"
      ? "Mobile Banking"
      : payment.paymentMethod === "bank"
        ? "Bank Transfer"
        : "Cash";

  const buildHtml = () =>
    buildSupplierPaymentReceiptHtml({
      warehouseLabel,
      supplierName,
      purchaseNumber,
      amount: payment.amount,
      paymentMethod: payment.paymentMethod,
      referenceNo: payment.referenceNo,
      invoiceTotal,
      totalPaidAfter,
      remainingDue,
    });

  const handlePrint = () => {
    printHtmlContent(buildHtml());
    onOpenChange(false);
  };

  const handleShare = async () => {
    setIsSharing(true);
    try {
      await sharePurchaseDocument(
        buildHtml(),
        `Receipt-${purchaseNumber}.png`,
        `Payment Receipt - ${purchaseNumber}`,
        `Payment of ${formatMoney(payment.amount)} recorded for ${purchaseNumber}.`,
      );
    } catch (error: unknown) {
      if ((error as { name?: string })?.name === "AbortError") return;
      toast.error("Failed to share receipt");
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Printer className="h-5 w-5" />
            Payment Receipt
          </DialogTitle>
          <DialogDescription>
            Payment recorded for{" "}
            <span className="font-semibold text-foreground">{purchaseNumber}</span>.
            Print or share the receipt.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 rounded-lg border bg-muted/30 p-4 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Amount Paid</span>
            <span className="font-bold text-emerald-600">
              {formatMoney(payment.amount)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Method</span>
            <span className="font-medium">{methodLabel}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Remaining Due</span>
            <span className="font-semibold text-orange-600">
              {formatMoney(remainingDue)}
            </span>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleShare}
            disabled={isSharing}
            className="gap-2"
          >
            {isSharing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Share2 className="h-4 w-4" />
            )}
            Share
          </Button>
          <Button type="button" onClick={handlePrint} className="gap-2">
            <Printer className="h-4 w-4" />
            Print
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
