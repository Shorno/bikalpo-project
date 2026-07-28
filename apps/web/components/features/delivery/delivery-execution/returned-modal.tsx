"use client";

import { Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

interface ReturnedModalProps {
  open: boolean;
  isLoading: boolean;
  reason: string;
  onReasonChange: (value: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}

const RETURN_REASONS = [
  { value: "customer_refused", label: "Delivery Recipient Refused" },
  { value: "wrong_address", label: "Wrong Address" },
  { value: "damaged_goods", label: "Damaged Goods" },
  {
    value: "customer_not_available",
    label: "Delivery Recipient Not Available",
  },
  { value: "payment_issue", label: "Payment Issue" },
  { value: "order_cancelled", label: "Order Cancelled" },
  { value: "other", label: "Other" },
];

export function ReturnedModal({
  open,
  isLoading,
  reason,
  onReasonChange,
  onClose,
  onConfirm,
}: ReturnedModalProps) {
  const canConfirm = reason.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-center sm:text-center">
          <div className="mx-auto mb-4">
            <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center">
              <RotateCcw className="w-6 h-6 text-amber-600" />
            </div>
          </div>
          <DialogTitle>Return Invoice</DialogTitle>
          <DialogDescription>
            Mark this invoice as returned. The goods will be returned to the
            warehouse.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          <div>
            <Label className="mb-2 block">Return Reason</Label>
            <Select
              value={
                RETURN_REASONS.find((r) => r.label === reason)?.value ||
                (reason ? "other" : "")
              }
              onValueChange={(val) => {
                const found = RETURN_REASONS.find((r) => r.value === val);
                if (found && found.value !== "other") {
                  onReasonChange(found.label);
                } else {
                  onReasonChange("");
                }
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a reason..." />
              </SelectTrigger>
              <SelectContent>
                {RETURN_REASONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="mb-2 block">Additional Details</Label>
            <Textarea
              placeholder="Provide more details about the return..."
              value={reason}
              onChange={(e) => onReasonChange(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            className="bg-amber-600 hover:bg-amber-700 text-white"
            onClick={onConfirm}
            disabled={isLoading || !canConfirm}
          >
            {isLoading && <Loader2 className="mr-2 size-4 animate-spin" />}
            Mark as Returned
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
