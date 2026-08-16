"use client";

import {
  BadgePercent,
  Banknote,
  Check,
  Clock3,
  Store,
  Truck,
  WalletCards,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export type CheckoutInvoiceContact = {
  name: string;
  phone: string;
  email: string;
};

export function DeliveryModeSelector({
  value,
  onChange,
  allowSelfPickup,
  allowCourier,
}: {
  value: "self_pickup" | "courier";
  onChange: (value: "self_pickup" | "courier") => void;
  allowSelfPickup: boolean;
  allowCourier: boolean;
}) {
  const options = [
    {
      value: "self_pickup" as const,
      label: "Self pickup",
      description: "Collect from the seller",
      icon: Store,
      enabled: allowSelfPickup,
    },
    {
      value: "courier" as const,
      label: "Courier",
      description: "Deliver to your address",
      icon: Truck,
      enabled: allowCourier,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="Delivery method">
      {options.map((option) => {
        const Icon = option.icon;
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={!option.enabled}
            onClick={() => onChange(option.value)}
            className={cn(
              "flex min-h-20 items-start gap-3 rounded-lg border px-3 py-3 text-left transition-colors",
              selected
                ? "border-emerald-600 bg-emerald-50 text-emerald-950"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
              !option.enabled && "cursor-not-allowed opacity-45",
            )}
          >
            <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span className="min-w-0">
              <span className="block text-sm font-semibold">{option.label}</span>
              <span className="mt-0.5 block text-xs leading-4 text-slate-500">
                {option.description}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function PromotionCodeControl({
  value,
  appliedCode,
  error,
  isApplying,
  onChange,
  onApply,
  onClear,
}: {
  value: string;
  appliedCode?: string | null;
  error?: string | null;
  isApplying?: boolean;
  onChange: (value: string) => void;
  onApply: () => void;
  onClear: () => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor="promotion-code">Promotion code</Label>
      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <BadgePercent
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          />
          <Input
            id="promotion-code"
            value={value}
            onChange={(event) => onChange(event.target.value.toUpperCase())}
            placeholder="Enter code"
            className="pl-9 uppercase"
            disabled={Boolean(appliedCode)}
          />
        </div>
        {appliedCode ? (
          <Button type="button" variant="outline" onClick={onClear} aria-label="Remove promotion">
            <X aria-hidden="true" />
            Remove
          </Button>
        ) : (
          <Button type="button" variant="outline" onClick={onApply} disabled={!value.trim() || isApplying}>
            {isApplying ? <Clock3 className="animate-spin" aria-hidden="true" /> : <Check aria-hidden="true" />}
            Apply
          </Button>
        )}
      </div>
      {appliedCode ? (
        <p className="text-xs font-medium text-emerald-700">{appliedCode} applied</p>
      ) : error ? (
        <p className="text-xs font-medium text-red-600">{error}</p>
      ) : null}
    </div>
  );
}

export function InvoiceContactFields({
  value,
  onChange,
}: {
  value: CheckoutInvoiceContact;
  onChange: (value: CheckoutInvoiceContact) => void;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2">
        <Label htmlFor="invoice-name">Invoice name</Label>
        <Input
          id="invoice-name"
          value={value.name}
          onChange={(event) => onChange({ ...value, name: event.target.value })}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="invoice-phone">Invoice phone</Label>
        <Input
          id="invoice-phone"
          type="tel"
          value={value.phone}
          onChange={(event) => onChange({ ...value, phone: event.target.value })}
          required
        />
      </div>
      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="invoice-email">Invoice email</Label>
        <Input
          id="invoice-email"
          type="email"
          value={value.email}
          onChange={(event) => onChange({ ...value, email: event.target.value })}
          placeholder="Optional"
        />
      </div>
    </div>
  );
}

export function PaymentPlanSelector({
  value,
  onChange,
  allowPartial,
  partialAmount,
  onPartialAmountChange,
  grandTotal,
}: {
  value: "pay_now" | "partial" | "pay_later";
  onChange: (value: "pay_now" | "partial" | "pay_later") => void;
  allowPartial: boolean;
  partialAmount: string;
  onPartialAmountChange: (value: string) => void;
  grandTotal: number;
}) {
  const options = [
    { value: "pay_now" as const, label: "Pay now", icon: WalletCards },
    ...(allowPartial
      ? [{ value: "partial" as const, label: "Partial", icon: Banknote }]
      : []),
    { value: "pay_later" as const, label: "Pay later", icon: Clock3 },
  ];

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Payment plan">
        {options.map((option) => {
          const Icon = option.icon;
          const selected = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(option.value)}
              className={cn(
                "flex h-11 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-semibold",
                selected
                  ? "border-emerald-600 bg-emerald-50 text-emerald-800"
                  : "border-slate-200 text-slate-700 hover:bg-slate-50",
              )}
            >
              <Icon className="size-4" aria-hidden="true" />
              {option.label}
            </button>
          );
        })}
      </div>
      {value === "partial" && (
        <div className="space-y-2">
          <Label htmlFor="partial-payment">Deposit amount</Label>
          <Input
            id="partial-payment"
            type="number"
            min="0.01"
            max={Math.max(0, grandTotal - 0.01)}
            step="0.01"
            value={partialAmount}
            onChange={(event) => onPartialAmountChange(event.target.value)}
            required
          />
        </div>
      )}
    </div>
  );
}
