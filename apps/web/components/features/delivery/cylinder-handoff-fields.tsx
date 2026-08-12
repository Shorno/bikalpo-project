"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type CylinderHandoffLine = {
  orderItemId: number;
  productName: string;
  expectedEmptyPackQty: number;
  exchangeCreditAmount: number;
};

export function calculateHandoffBalance(
  lines: CylinderHandoffLine[],
  acceptedById: Record<number, number>,
) {
  return lines.reduce(
    (total, line) =>
      total +
      Math.max(
        0,
        line.expectedEmptyPackQty - (acceptedById[line.orderItemId] ?? 0),
      ) *
        line.exchangeCreditAmount,
    0,
  );
}

export function CylinderHandoffFields({
  lines,
  acceptedById,
  onAcceptedChange,
  balancePaid,
  onBalancePaidChange,
  paymentMethod,
  onPaymentMethodChange,
  paymentReference,
  onPaymentReferenceChange,
}: {
  lines: CylinderHandoffLine[];
  acceptedById: Record<number, number>;
  onAcceptedChange: (orderItemId: number, quantity: number) => void;
  balancePaid: boolean;
  onBalancePaidChange: (paid: boolean) => void;
  paymentMethod: string;
  onPaymentMethodChange: (method: string) => void;
  paymentReference: string;
  onPaymentReferenceChange: (reference: string) => void;
}) {
  if (lines.length === 0) return null;
  const balance = calculateHandoffBalance(lines, acceptedById);

  return (
    <div className="space-y-3 rounded-lg border border-emerald-200 bg-emerald-50/60 p-3">
      <div>
        <p className="text-sm font-semibold text-emerald-950">
          Empty cylinder return
        </p>
        <p className="mt-0.5 text-xs leading-5 text-emerald-800">
          Confirm only accepted cylinders of the exact brand and capacity.
        </p>
      </div>
      <div className="space-y-2">
        {lines.map((line) => (
          <div
            className="grid grid-cols-[minmax(0,1fr)_6rem] items-center gap-3 rounded-md border bg-white p-2.5"
            key={line.orderItemId}
          >
            <div>
              <p className="text-xs font-medium text-slate-900">
                {line.productName}
              </p>
              <p className="mt-0.5 text-[11px] text-slate-500">
                Expected {line.expectedEmptyPackQty} · ৳
                {line.exchangeCreditAmount.toLocaleString()} credit each
              </p>
            </div>
            <Input
              aria-label={`Accepted empties for ${line.productName}`}
              className="h-9 text-right"
              max={line.expectedEmptyPackQty}
              min={0}
              onChange={(event) =>
                onAcceptedChange(
                  line.orderItemId,
                  Math.min(
                    line.expectedEmptyPackQty,
                    Math.max(0, Number(event.target.value) || 0),
                  ),
                )
              }
              type="number"
              value={acceptedById[line.orderItemId] ?? 0}
            />
          </div>
        ))}
      </div>
      {balance > 0 && (
        <div className="space-y-3 rounded-md border border-amber-200 bg-amber-50 p-3">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="font-medium text-amber-950">Handoff Balance</span>
            <span className="font-bold text-amber-950">
              ৳{balance.toLocaleString()}
            </span>
          </div>
          <Label className="flex cursor-pointer items-start gap-2 text-xs text-amber-950">
            <Checkbox
              checked={balancePaid}
              onCheckedChange={(checked) =>
                onBalancePaidChange(checked === true)
              }
            />
            Additional amount collected before completion
          </Label>
          {balancePaid && (
            <div className="grid gap-2 sm:grid-cols-2">
              <select
                aria-label="Handoff Balance payment method"
                className="h-9 rounded-md border bg-white px-3 text-xs"
                onChange={(event) => onPaymentMethodChange(event.target.value)}
                value={paymentMethod}
              >
                <option value="cash">Cash</option>
                <option value="digital">Digital</option>
              </select>
              <Input
                aria-label="Handoff Balance payment reference"
                className="h-9 text-xs"
                onChange={(event) =>
                  onPaymentReferenceChange(event.target.value)
                }
                placeholder="Reference (optional)"
                value={paymentReference}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
