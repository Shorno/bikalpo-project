import { Check, MapPin, Settings2, Weight } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CartonConfigManagerDialog } from "./carton-config-manager-dialog";
import { SectionHeader } from "./section-header";
import type { CartonConfig, CartonItem } from "./types";

type StorageArea = {
  id: number;
  name: string;
};

type CartonConfigurationProps = {
  items: CartonItem[];
  configs: CartonConfig[];
  areas: StorageArea[];
  selectedConfigId: number | null;
  storageAreaId: string;
  totalWeightKg: string;
  onSelectConfig: (configId: number) => void;
  onStorageAreaChange: (value: string) => void;
};

export function CartonConfiguration({
  items,
  configs,
  areas,
  selectedConfigId,
  storageAreaId,
  totalWeightKg,
  onSelectConfig,
  onStorageAreaChange,
}: CartonConfigurationProps) {
  const [managerOpen, setManagerOpen] = useState(false);
  const activeConfigs = configs.filter((config) => config.isActive);
  const item = items[0];

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <SectionHeader
          title="Carton configuration"
          description="Choose the approved template that defines this carton."
        />
        <Button
          variant="outline"
          size="sm"
          className="gap-2 flex-shrink-0"
          onClick={() => setManagerOpen(true)}
        >
          <Settings2 size={14} /> Manage configurations
        </Button>
      </div>

      <div className="space-y-5">
        {activeConfigs.length > 0 ? (
          <div className="space-y-3">
            <Label className="text-sm font-medium text-foreground/80">
              Carton template
            </Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {activeConfigs.map((c) => {
                const sel = selectedConfigId === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    className={`text-left p-4 rounded-lg border transition-colors ${
                      sel
                        ? "border-foreground bg-foreground/[0.03] ring-1 ring-foreground/10"
                        : "border-border hover:border-foreground/25 hover:bg-muted/30"
                    }`}
                    onClick={() => onSelectConfig(c.id)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <div
                          className={`w-4 h-4 rounded-full border flex items-center justify-center flex-shrink-0 mt-0.5 ${
                            sel
                              ? "bg-foreground border-foreground"
                              : "border-foreground/30"
                          }`}
                        >
                          {sel && (
                            <Check size={10} className="text-background" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-sm text-foreground truncate">
                            {c.label || `${c.packsPerCarton} Pack Carton`}
                          </p>
                          <p className="text-sm text-foreground/55 mt-0.5">
                            {c.packsPerCarton} ×{" "}
                            {item?.operationalUnit || "unit"} ·{" "}
                            {c.cartonWeightKg} KG
                          </p>
                        </div>
                      </div>
                      <span className="text-sm font-semibold tabular-nums text-foreground flex-shrink-0">
                        ৳{Number(c.cartonPrice).toLocaleString()}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed bg-amber-50/40 px-5 py-6 text-center dark:bg-amber-950/10">
            <p className="text-sm font-medium">
              This variant has no active carton configuration
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Create one before this physical carton can be submitted.
            </p>
            <Button
              size="sm"
              className="mt-4 gap-2"
              onClick={() => setManagerOpen(true)}
            >
              <Settings2 size={14} /> Create configuration
            </Button>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Weight size={16} className="text-foreground/50" />
              <Label className="text-sm font-medium text-foreground/80">
                Carton weight
              </Label>
              <span className="text-[11px] font-medium text-foreground/45 uppercase tracking-wide">
                Auto
              </span>
            </div>
            <p className="text-2xl font-semibold tabular-nums text-foreground">
              {totalWeightKg} KG
            </p>
            <p className="text-sm text-foreground/55 mt-1.5">
              {items.map((i) => `${i.weightKg}KG × ${i.packCount}`).join(" + ")}{" "}
              = {totalWeightKg} KG
            </p>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-3">
              <MapPin size={16} className="text-foreground/50" />
              <Label
                htmlFor="storage-area"
                className="text-sm font-medium text-foreground/80"
              >
                Storage location
              </Label>
              <span className="text-[11px] font-medium text-foreground/45 uppercase tracking-wide">
                Optional
              </span>
            </div>
            <Select value={storageAreaId} onValueChange={onStorageAreaChange}>
              <SelectTrigger id="storage-area" className="h-10 text-sm">
                <SelectValue placeholder="Select storage area" />
              </SelectTrigger>
              <SelectContent>
                {areas.map((a) => (
                  <SelectItem key={a.id} value={String(a.id)}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {item && (
        <CartonConfigManagerDialog
          open={managerOpen}
          onOpenChange={setManagerOpen}
          variantId={item.variantId}
          operationalUnit={item.operationalUnit}
          configs={configs}
        />
      )}
    </div>
  );
}
