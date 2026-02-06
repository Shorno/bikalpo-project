"use client";

import { CheckCircle, Loader2 } from "lucide-react";
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
import { Label } from "@/components/ui/label";

interface DeliveredModalProps {
  open: boolean;
  isLoading: boolean;
  otp: string;
  onOtpChange: (value: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeliveredModal({
  open,
  isLoading,
  otp,
  onOtpChange,
  onClose,
  onConfirm,
}: DeliveredModalProps) {
  const canConfirm = otp.length === 4;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-center sm:text-center">
          <div className="mx-auto mb-4">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-primary" />
            </div>
          </div>
          <DialogTitle>Confirm Delivery</DialogTitle>
          <DialogDescription>
            Ask the customer for their OTP to complete the delivery.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <Label className="text-center block mb-3 text-muted-foreground">
            Enter the 4-digit code from customer
          </Label>
          <Input
            placeholder="0000"
            value={otp}
            onChange={(e) =>
              onOtpChange(e.target.value.replace(/\D/g, "").slice(0, 4))
            }
            maxLength={4}
            inputMode="numeric"
            autoFocus
            className="text-center text-3xl tracking-[0.5em] font-mono font-bold h-16 border-2"
          />
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={isLoading || !canConfirm}>
            {isLoading && <Loader2 className="mr-2 size-4 animate-spin" />}
            Complete Delivery
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
