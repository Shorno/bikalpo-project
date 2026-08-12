"use client";

import { CheckCircle, Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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
import {
  CylinderHandoffFields,
  type CylinderHandoffLine,
  calculateHandoffBalance,
} from "../cylinder-handoff-fields";

export type DeliveredCylinderHandoff = {
  acceptedReturns: Array<{ orderItemId: number; quantity: number }>;
  handoffBalancePaid: boolean;
  handoffPaymentMethod?: string;
  handoffPaymentReference?: string;
};

interface DeliveredModalProps {
  open: boolean;
  isLoading: boolean;
  otp: string;
  onOtpChange: (value: string) => void;
  onClose: () => void;
  exchangeLines: CylinderHandoffLine[];
  onConfirm: (handoff: DeliveredCylinderHandoff) => void;
}

export function DeliveredModal({
  open,
  isLoading,
  otp,
  onOtpChange,
  onClose,
  onConfirm,
  exchangeLines,
}: DeliveredModalProps) {
  const [acceptedById, setAcceptedById] = useState<Record<number, number>>({});
  const [balancePaid, setBalancePaid] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [paymentReference, setPaymentReference] = useState("");
  useEffect(() => {
    if (!open) return;
    setAcceptedById(
      Object.fromEntries(
        exchangeLines.map((line) => [
          line.orderItemId,
          line.expectedEmptyPackQty,
        ]),
      ),
    );
    setBalancePaid(false);
    setPaymentMethod("cash");
    setPaymentReference("");
  }, [exchangeLines, open]);
  const balance = useMemo(
    () => calculateHandoffBalance(exchangeLines, acceptedById),
    [acceptedById, exchangeLines],
  );
  const canConfirm = otp.length === 4 && (balance === 0 || balancePaid);

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
            Ask the Delivery Recipient for their OTP to complete the delivery.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <Label className="text-center block mb-3 text-muted-foreground">
            Enter the 4-digit code from the Delivery Recipient
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
          <CylinderHandoffFields
            acceptedById={acceptedById}
            balancePaid={balancePaid}
            lines={exchangeLines}
            onAcceptedChange={(orderItemId, quantity) =>
              setAcceptedById((current) => ({
                ...current,
                [orderItemId]: quantity,
              }))
            }
            onBalancePaidChange={setBalancePaid}
            onPaymentMethodChange={setPaymentMethod}
            onPaymentReferenceChange={setPaymentReference}
            paymentMethod={paymentMethod}
            paymentReference={paymentReference}
          />
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            onClick={() =>
              onConfirm({
                acceptedReturns: exchangeLines.map((line) => ({
                  orderItemId: line.orderItemId,
                  quantity: acceptedById[line.orderItemId] ?? 0,
                })),
                handoffBalancePaid: balancePaid,
                handoffPaymentMethod: balance > 0 ? paymentMethod : undefined,
                handoffPaymentReference:
                  balance > 0 && paymentReference
                    ? paymentReference
                    : undefined,
              })
            }
            disabled={isLoading || !canConfirm}
          >
            {isLoading && <Loader2 className="mr-2 size-4 animate-spin" />}
            Complete Delivery
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
