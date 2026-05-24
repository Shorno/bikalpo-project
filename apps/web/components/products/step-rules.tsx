"use client";

import { CheckCircle2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { CreateProductFormState } from "@/app/shop/(management)/dashboard/products/create/page";

type Props = {
  form: CreateProductFormState;
  update: (patch: Partial<CreateProductFormState>) => void;
};

function RuleToggle({
  label,
  description,
  value,
  onChange,
}: {
  label: string;
  description: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="border rounded-xl p-4 space-y-3">
      <div>
        <p className="text-sm font-semibold text-gray-800">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <RadioGroup
        value={value ? "enable" : "disable"}
        onValueChange={(v) => onChange(v === "enable")}
        className="flex gap-4"
      >
        <label className={`flex items-center gap-2 px-4 py-2 rounded-lg border cursor-pointer transition-all text-sm ${
          value ? "border-emerald-400 bg-emerald-50 text-emerald-700 font-medium" : "border-gray-200 hover:bg-gray-50"
        }`}>
          <RadioGroupItem value="enable" className="sr-only" />
          <span className={`w-3 h-3 rounded-full border-2 flex items-center justify-center ${
            value ? "border-emerald-500" : "border-gray-300"
          }`}>
            {value && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
          </span>
          Enable
        </label>
        <label className={`flex items-center gap-2 px-4 py-2 rounded-lg border cursor-pointer transition-all text-sm ${
          !value ? "border-gray-400 bg-gray-50 text-gray-700 font-medium" : "border-gray-200 hover:bg-gray-50"
        }`}>
          <RadioGroupItem value="disable" className="sr-only" />
          <span className={`w-3 h-3 rounded-full border-2 flex items-center justify-center ${
            !value ? "border-gray-500" : "border-gray-300"
          }`}>
            {!value && <span className="w-1.5 h-1.5 rounded-full bg-gray-500" />}
          </span>
          Disable
        </label>
      </RadioGroup>
    </div>
  );
}

export function StepRules({ form, update }: Props) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 pb-2 border-b">
        <span className="text-lg">📦</span>
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-700">Product Rules</h3>
          <p className="text-xs text-muted-foreground">Store-level behavior configuration</p>
        </div>
      </div>

      <div className="space-y-4">
        <RuleToggle
          label="Empty Pack Return"
          description="Require customers to return empty packaging (e.g. jars, gas cylinders)"
          value={form.isReturnablePack}
          onChange={(v) => update({ isReturnablePack: v })}
        />
        <RuleToggle
          label="Stock Tracking"
          description="Enable stock quantity tracking for this product"
          value={form.stockTrackingEnabled}
          onChange={(v) => update({ stockTrackingEnabled: v })}
        />
        <RuleToggle
          label="Expiry Tracking"
          description="Track expiration dates for inventory items"
          value={form.expiryEnabled}
          onChange={(v) => update({ expiryEnabled: v })}
        />
        <RuleToggle
          label="Batch Tracking"
          description="Track inventory by production batch numbers"
          value={form.trackingType === "batch"}
          onChange={(v) => update({ trackingType: v ? "batch" : "none" })}
        />
        <RuleToggle
          label="Damage Entry"
          description="Enable workflows for handling damaged or returned items"
          value={form.damageControlEnabled}
          onChange={(v) => update({ damageControlEnabled: v })}
        />
      </div>

      <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
        <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
        <p className="text-sm text-emerald-700">Store-specific behavior control</p>
      </div>
    </div>
  );
}
