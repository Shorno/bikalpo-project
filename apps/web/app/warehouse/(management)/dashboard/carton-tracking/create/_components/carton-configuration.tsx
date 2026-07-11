import { Check, MapPin, Weight } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SectionHeader } from "./section-header";
import type { CartonItem } from "./types";

type CartonConfig = {
  id: number;
  label?: string | null;
  packsPerCarton: number;
  cartonWeightKg: string | number;
  cartonPrice: string | number;
  deliveryCostPerCarton?: string | number | null;
};

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
  onSelectConfig: (configId: number | null, cartonPrice?: string | number) => void;
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
  return (
    <div>
      <SectionHeader
        title="Carton configuration"
        description="Set template, weight, and where this carton will be stored."
      />

      <div className="space-y-5">
        {configs.length > 0 && (
          <div className="space-y-3">
            <Label className="text-sm font-medium text-foreground/80">Carton template</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {configs.map((c) => {
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
                    onClick={() => onSelectConfig(sel ? null : c.id, sel ? undefined : c.cartonPrice)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <div
                          className={`w-4 h-4 rounded-full border flex items-center justify-center flex-shrink-0 mt-0.5 ${
                            sel ? "bg-foreground border-foreground" : "border-foreground/30"
                          }`}
                        >
                          {sel && <Check size={10} className="text-background" />}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-sm text-foreground truncate">
                            {c.label || `${c.packsPerCarton} Pack Carton`}
                          </p>
                          <p className="text-sm text-foreground/55 mt-0.5">
                            {c.packsPerCarton} pcs · {c.cartonWeightKg} KG
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
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Weight size={16} className="text-foreground/50" />
              <Label className="text-sm font-medium text-foreground/80">Carton weight</Label>
              <span className="text-[11px] font-medium text-foreground/45 uppercase tracking-wide">
                Auto
              </span>
            </div>
            <p className="text-2xl font-semibold tabular-nums text-foreground">{totalWeightKg} KG</p>
            <p className="text-sm text-foreground/55 mt-1.5">
              {items.map((i) => `${i.weightKg}KG × ${i.packCount}`).join(" + ")} = {totalWeightKg} KG
            </p>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-3">
              <MapPin size={16} className="text-foreground/50" />
              <Label htmlFor="storage-area" className="text-sm font-medium text-foreground/80">
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
    </div>
  );
}
