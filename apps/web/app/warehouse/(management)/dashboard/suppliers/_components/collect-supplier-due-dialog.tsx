"use client";

import { Banknote } from "lucide-react";
import { useEffect, useState } from "react";
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

const paymentMethodOptions = [
  { value: "cash" as const, label: "Cash" },
  { value: "bank" as const, label: "Bank" },
  { value: "mobile_banking" as const, label: "Mobile" },
];

function formatMoney(value: number) {
  return `৳${value.toLocaleString("en-BD", { maximumFractionDigits: 2 })}`;
}

export function CollectSupplierDueDialog({
  open,
  onOpenChange,
  dueAmount,
  maxAmount,
  invoiceNumber,
  supplierName,
  onCollect,
  isPending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dueAmount: number;
  maxAmount: number;
  invoiceNumber: string;
  supplierName: string;
  onCollect: (data: {
    amount: string;
    paymentMethod: "cash" | "bank" | "mobile_banking";
    referenceNo?: string;
    note?: string;
  }) => void;
  isPending: boolean;
}) {
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<
    "cash" | "bank" | "mobile_banking"
  >("cash");
  const [referenceNo, setReferenceNo] = useState("");
  const [note, setNote] = useState("");

  const collectible = Math.min(dueAmount, maxAmount);

  useEffect(() => {
    if (open) {
      setAmount("");
      setPaymentMethod("cash");
      setReferenceNo("");
      setNote("");
    }
  }, [open]);

  const parsedAmount = Number(amount);
  const isValidAmount =
    amount !== "" &&
    Number.isFinite(parsedAmount) &&
    parsedAmount > 0 &&
    parsedAmount <= collectible;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidAmount) return;
    onCollect({
      amount,
      paymentMethod,
      referenceNo: referenceNo.trim() || undefined,
      note: note.trim() || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Banknote className="h-5 w-5 text-emerald-600" />
            Record Payment
          </DialogTitle>
          <DialogDescription>
            Pay outstanding balance for{" "}
            <span className="font-semibold text-foreground">{invoiceNumber}</span>{" "}
            to <span className="font-semibold text-foreground">{supplierName}</span>
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="rounded-lg border bg-muted/30 px-4 py-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Amount Payable</span>
              <span className="font-mono text-lg font-bold text-red-600">
                {formatMoney(collectible)}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Payment Method</Label>
            <div className="grid grid-cols-3 gap-1.5">
              {paymentMethodOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setPaymentMethod(opt.value)}
                  className={`rounded-md border px-2 py-2 text-xs font-medium transition-all ${
                    paymentMethod === opt.value
                      ? "border-emerald-300 bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                      : "bg-background text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="collect-amount">Amount</Label>
              <button
                type="button"
                onClick={() => setAmount(String(collectible))}
                className="text-[11px] font-medium text-emerald-600 hover:underline"
              >
                Pay full due
              </button>
            </div>
            <Input
              id="collect-amount"
              type="number"
              step="0.01"
              min="0"
              max={collectible}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              required
            />
          </div>

          {paymentMethod !== "cash" && (
            <div className="space-y-2">
              <Label htmlFor="collect-ref">Reference No</Label>
              <Input
                id="collect-ref"
                value={referenceNo}
                onChange={(e) => setReferenceNo(e.target.value)}
                placeholder="Transaction / cheque reference"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="collect-note">Note (optional)</Label>
            <Input
              id="collect-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Internal note"
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!isValidAmount || isPending}>
              {isPending ? "Processing..." : "Record Payment"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
