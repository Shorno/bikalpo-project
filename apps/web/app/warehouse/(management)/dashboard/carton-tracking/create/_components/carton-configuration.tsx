import { Boxes, MapPin, Weight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SectionHeader } from "./section-header";
import type { CartonItem } from "./types";

type StorageArea = {
  id: number;
  name: string;
};

type CartonConfigurationProps = {
  items: CartonItem[];
  areas: StorageArea[];
  storageAreaId: string;
  totalWeightKg: string;
  onPackCountChange: (value: number) => void;
  onStorageAreaChange: (value: string) => void;
};

export function CartonConfiguration({
  items,
  areas,
  storageAreaId,
  totalWeightKg,
  onPackCountChange,
  onStorageAreaChange,
}: CartonConfigurationProps) {
  const item = items[0];
  if (!item) return null;

  const overLimit = item.packCount > item.availableStock;

  return (
    <div>
      <SectionHeader
        title="Carton contents"
        description="Enter the quantity for this physical carton. No saved template is required."
      />

      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <Boxes size={15} className="text-foreground/50" />
            <Label htmlFor="units-per-carton">Units per carton</Label>
          </div>
          <div className="relative">
            <Input
              id="units-per-carton"
              type="number"
              min={1}
              max={item.availableStock}
              step={1}
              value={item.packCount || ""}
              onChange={(event) =>
                onPackCountChange(
                  Math.max(0, Math.floor(Number(event.target.value) || 0)),
                )
              }
              placeholder="Enter quantity"
              className={overLimit ? "border-red-500 pr-20" : "pr-20"}
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
              {item.operationalUnit}
            </span>
          </div>
          <p
            className={`mt-1.5 text-xs ${overLimit ? "text-red-600" : "text-muted-foreground"}`}
          >
            {overLimit
              ? `Only ${item.availableStock} units are ready for carton packing.`
              : `${item.availableStock} units ready for packing`}
          </p>
        </div>

        <div>
          <div className="mb-2 flex items-center gap-2">
            <Weight size={15} className="text-foreground/50" />
            <Label>Carton weight</Label>
          </div>
          <div className="flex h-10 items-center rounded-md border bg-muted/30 px-3 text-sm font-semibold tabular-nums text-foreground">
            {totalWeightKg} KG
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">
            Calculated from variant weight × units
          </p>
        </div>

        <div>
          <div className="mb-2 flex items-center gap-2">
            <MapPin size={15} className="text-foreground/50" />
            <Label htmlFor="storage-area">Storage location</Label>
          </div>
          <Select value={storageAreaId} onValueChange={onStorageAreaChange}>
            <SelectTrigger id="storage-area" className="h-10 text-sm">
              <SelectValue placeholder="Optional" />
            </SelectTrigger>
            <SelectContent>
              {areas.map((area) => (
                <SelectItem key={area.id} value={String(area.id)}>
                  {area.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="mt-1.5 text-xs text-muted-foreground">
            Shelf or warehouse area
          </p>
        </div>
      </div>
    </div>
  );
}
