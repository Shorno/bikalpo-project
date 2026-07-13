"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Copy, Pencil, Plus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { orpc } from "@/utils/orpc";
import type { CartonConfig } from "./types";

type Mode = "create" | "edit" | "clone";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  variantId: number;
  operationalUnit: string;
  configs: CartonConfig[];
};

const emptyDraft = {
  packsPerCarton: "",
  cartonPrice: "",
  cartonCostPrice: "",
  deliveryCostPerCarton: "",
  label: "",
  isDefault: false,
  isActive: true,
};

export function CartonConfigManagerDialog({
  open,
  onOpenChange,
  variantId,
  operationalUnit,
  configs,
}: Props) {
  const qc = useQueryClient();
  const [mode, setMode] = useState<Mode>("create");
  const [selected, setSelected] = useState<CartonConfig | null>(null);
  const [draft, setDraft] = useState(emptyDraft);

  const load = useCallback((nextMode: Mode, config?: CartonConfig) => {
    setMode(nextMode);
    setSelected(config || null);
    setDraft(
      config
        ? {
            packsPerCarton: String(config.packsPerCarton),
            cartonPrice: String(config.cartonPrice),
            cartonCostPrice: String(config.cartonCostPrice || ""),
            deliveryCostPerCarton: String(config.deliveryCostPerCarton || ""),
            label: config.label || "",
            isDefault: nextMode === "clone" ? false : config.isDefault,
            isActive: nextMode === "clone" ? true : config.isActive,
          }
        : emptyDraft,
    );
  }, []);

  useEffect(() => {
    if (open) load("create");
  }, [open, load]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const common = {
        packsPerCarton: Number(draft.packsPerCarton),
        cartonPrice: draft.cartonPrice,
        cartonCostPrice: draft.cartonCostPrice || undefined,
        deliveryCostPerCarton: draft.deliveryCostPerCarton || undefined,
        label: draft.label.trim() || undefined,
        isDefault: draft.isDefault,
      };
      if (mode === "edit" && selected) {
        return (orpc.warehouse as any).updateCartonConfig.call({
          id: selected.id,
          ...common,
          isActive: draft.isActive,
        });
      }
      return (orpc.warehouse as any).createCartonConfig.call({
        variantId,
        ...common,
      });
    },
    onSuccess: async () => {
      toast.success(
        mode === "edit"
          ? "Carton configuration updated"
          : "Carton configuration created",
      );
      await qc.invalidateQueries({ queryKey: ["w", "configs", variantId] });
      load("create");
    },
    onError: (error: any) =>
      toast.error(error.message || "Could not save configuration"),
  });

  const structuralLocked = mode === "edit" && (selected?.usageCount || 0) > 0;
  const valid =
    Number.isInteger(Number(draft.packsPerCarton)) &&
    Number(draft.packsPerCarton) > 0 &&
    draft.cartonPrice !== "" &&
    Number(draft.cartonPrice) >= 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-5 border-b bg-muted/20">
          <DialogTitle>Manage carton configurations</DialogTitle>
          <DialogDescription>
            Define the allowed carton compositions for this product variant.
          </DialogDescription>
        </DialogHeader>

        <div className="grid md:grid-cols-[260px_minmax(0,1fr)] min-h-[430px]">
          <div className="border-r bg-muted/15 p-4 space-y-2">
            <Button
              variant={mode === "create" ? "secondary" : "ghost"}
              className="w-full justify-start gap-2"
              onClick={() => load("create")}
            >
              <Plus size={15} /> New configuration
            </Button>
            <div className="pt-2 space-y-1.5">
              {configs.map((config) => (
                <button
                  type="button"
                  key={config.id}
                  onClick={() => load("edit", config)}
                  className={`w-full rounded-lg border p-3 text-left transition-colors ${selected?.id === config.id && mode === "edit" ? "border-foreground/35 bg-background" : "border-transparent hover:bg-background/70"}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium truncate">
                      {config.label || `${config.packsPerCarton} unit carton`}
                    </span>
                    {!config.isActive && (
                      <span className="text-[10px] uppercase text-muted-foreground">
                        Inactive
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {config.packsPerCarton} × {operationalUnit} · ৳
                    {Number(config.cartonPrice).toLocaleString()}
                  </p>
                </button>
              ))}
              {configs.length === 0 && (
                <p className="px-3 py-6 text-center text-xs text-muted-foreground">
                  No configurations yet
                </p>
              )}
            </div>
          </div>

          <div className="p-6 space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-semibold">
                  {mode === "create"
                    ? "New configuration"
                    : mode === "clone"
                      ? "Clone configuration"
                      : "Edit configuration"}
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {structuralLocked
                    ? "Composition is locked because physical cartons use this configuration."
                    : "Quantity and weight define the carton composition."}
                </p>
              </div>
              {mode === "edit" && selected && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => load("clone", selected)}
                >
                  <Copy size={14} /> Clone
                </Button>
              )}
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="units-per-carton">Units per carton</Label>
                <div className="relative">
                  <Input
                    id="units-per-carton"
                    type="number"
                    min={1}
                    step={1}
                    disabled={structuralLocked}
                    value={draft.packsPerCarton}
                    onChange={(e) =>
                      setDraft({ ...draft, packsPerCarton: e.target.value })
                    }
                    className="pr-20"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                    {operationalUnit}
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="config-label">Display label</Label>
                <Input
                  id="config-label"
                  placeholder="Auto-generated when empty"
                  value={draft.label}
                  onChange={(e) =>
                    setDraft({ ...draft, label: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="config-price">Selling price (৳)</Label>
                <Input
                  id="config-price"
                  type="number"
                  min={0}
                  value={draft.cartonPrice}
                  onChange={(e) =>
                    setDraft({ ...draft, cartonPrice: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="config-cost">Cost price (৳)</Label>
                <Input
                  id="config-cost"
                  type="number"
                  min={0}
                  value={draft.cartonCostPrice}
                  onChange={(e) =>
                    setDraft({ ...draft, cartonCostPrice: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="config-delivery">
                  Delivery cost per carton (৳)
                </Label>
                <Input
                  id="config-delivery"
                  type="number"
                  min={0}
                  value={draft.deliveryCostPerCarton}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      deliveryCostPerCarton: e.target.value,
                    })
                  }
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-5 rounded-lg border bg-muted/20 p-4">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={draft.isDefault}
                  onCheckedChange={(value) =>
                    setDraft({ ...draft, isDefault: value === true })
                  }
                />{" "}
                Default for this variant
              </label>
              {mode === "edit" && (
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={draft.isActive}
                    onCheckedChange={(value) =>
                      setDraft({ ...draft, isActive: value === true })
                    }
                  />{" "}
                  Active
                </label>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="px-6 py-4 border-t bg-muted/15">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button
            disabled={!valid || saveMutation.isPending}
            onClick={() => saveMutation.mutate()}
            className="gap-2"
          >
            {mode === "edit" ? <Pencil size={14} /> : <Plus size={14} />}
            {saveMutation.isPending
              ? "Saving..."
              : mode === "edit"
                ? "Save changes"
                : "Save configuration"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
