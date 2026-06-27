"use client";

import { Loader2, Truck } from "lucide-react";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

type DeliveryTypeModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCount: number;
  loading?: boolean;
  onConfirmInternal: () => void;
};

export function DeliveryTypeModal({
  open,
  onOpenChange,
  selectedCount,
  loading = false,
  onConfirmInternal,
}: DeliveryTypeModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Choose Delivery Type
          </DialogTitle>
          <DialogDescription>
            {selectedCount} invoice{selectedCount === 1 ? "" : "s"} selected.
            Choose how these orders will be fulfilled.
          </DialogDescription>
        </DialogHeader>

        <RadioGroup value="internal" className="gap-3">
          <div className="flex items-start gap-3 rounded-lg border p-3">
            <RadioGroupItem value="internal" id="delivery-type-internal" />
            <div className="space-y-1">
              <Label htmlFor="delivery-type-internal" className="font-medium">
                Internal Delivery
              </Label>
              <p className="text-sm text-muted-foreground">
                Group invoices for your warehouse delivery team.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-lg border border-dashed bg-muted/40 p-3 opacity-70">
            <RadioGroupItem
              value="third_party"
              id="delivery-type-third-party"
              disabled
            />
            <div className="space-y-1">
              <Label
                htmlFor="delivery-type-third-party"
                className="font-medium text-muted-foreground"
              >
                Third Party Delivery
              </Label>
              <p className="text-sm text-muted-foreground">
                Coming soon — courier handoff and tracking.
              </p>
            </div>
          </div>
        </RadioGroup>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button type="button" onClick={onConfirmInternal} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing…
              </>
            ) : (
              "Continue with Internal"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
