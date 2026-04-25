"use client";

import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { CreateProductFormState } from "@/app/shop/(management)/dashboard/products/create/page";

type Props = {
  form: CreateProductFormState;
  update: (patch: Partial<CreateProductFormState>) => void;
};

export function StepRules({ form, update }: Props) {
  return (
    <div className="space-y-8">
      {/* Toggles */}
      <div className="space-y-6">
        <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors">
          <div className="space-y-0.5">
            <Label className="text-base">Pack Return</Label>
            <p className="text-sm text-muted-foreground">
              Require customers to return empty packaging (e.g. jars, gas cylinders)
            </p>
          </div>
          <Switch
            checked={form.isReturnablePack}
            onCheckedChange={(checked) => update({ isReturnablePack: checked })}
          />
        </div>

        <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors">
          <div className="space-y-0.5">
            <Label className="text-base">Expiry Tracking</Label>
            <p className="text-sm text-muted-foreground">
              Track expiration dates for inventory items
            </p>
          </div>
          <Switch
            checked={form.expiryEnabled}
            onCheckedChange={(checked) => update({ expiryEnabled: checked })}
          />
        </div>

        <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors">
          <div className="space-y-0.5">
            <Label className="text-base">Damage Control</Label>
            <p className="text-sm text-muted-foreground">
              Enable workflows for handling damaged or returned items
            </p>
          </div>
          <Switch
            checked={form.damageControlEnabled}
            onCheckedChange={(checked) => update({ damageControlEnabled: checked })}
          />
        </div>
      </div>

      {/* Tracking Type */}
      <div className="space-y-4">
        <Label className="text-base">Inventory Tracking Level</Label>
        <RadioGroup
          value={form.trackingType}
          onValueChange={(value) => update({ trackingType: value as any })}
          className="grid grid-cols-1 md:grid-cols-3 gap-4"
        >
          <div className="flex items-center space-x-2 border rounded-lg p-4 cursor-pointer hover:bg-gray-50">
            <RadioGroupItem value="none" id="track-none" />
            <Label htmlFor="track-none" className="cursor-pointer space-y-1">
              <p className="font-medium">Standard</p>
              <p className="text-xs text-muted-foreground">Track by quantity only</p>
            </Label>
          </div>
          <div className="flex items-center space-x-2 border rounded-lg p-4 cursor-pointer hover:bg-gray-50">
            <RadioGroupItem value="batch" id="track-batch" />
            <Label htmlFor="track-batch" className="cursor-pointer space-y-1">
              <p className="font-medium">Batch</p>
              <p className="text-xs text-muted-foreground">Track by production batch</p>
            </Label>
          </div>
          <div className="flex items-center space-x-2 border rounded-lg p-4 cursor-pointer hover:bg-gray-50">
            <RadioGroupItem value="serial" id="track-serial" />
            <Label htmlFor="track-serial" className="cursor-pointer space-y-1">
              <p className="font-medium">Serial Number</p>
              <p className="text-xs text-muted-foreground">Track individual items</p>
            </Label>
          </div>
        </RadioGroup>
      </div>
    </div>
  );
}
