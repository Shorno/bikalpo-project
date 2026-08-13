"use client";

import { ChevronsUpDown, Loader2, MapPin } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  bangladeshDivisions,
  districtsForDivision,
} from "@/constants/bangladesh-locations";
import { useBarikoiAutocomplete } from "@/hooks/use-barikoi-autocomplete";
import { cn } from "@/lib/utils";

interface PropertyLocationFieldsProps {
  division: string;
  district: string;
  area: string;
  errors: {
    division?: string;
    district?: string;
    area?: string;
  };
  onChange: (field: "division" | "district" | "area", value: string) => void;
}

function FieldMessage({ message }: { message?: string }) {
  return message ? (
    <p role="alert" className="text-xs text-red-600">
      {message}
    </p>
  ) : null;
}

function areaName(place: { area: string; city: string; address: string }) {
  return place.area || place.city || place.address;
}

export function PropertyLocationFields({
  division,
  district,
  area,
  errors,
  onChange,
}: PropertyLocationFieldsProps) {
  const [areaOpen, setAreaOpen] = useState(false);
  const [areaQuery, setAreaQuery] = useState("");
  const { suggestions, isLoading, search, clearSuggestions } =
    useBarikoiAutocomplete();
  const districts = districtsForDivision(division);

  const areaOptions = useMemo(() => {
    const seen = new Set<string>();
    return suggestions.filter((place) => {
      const label = areaName(place).trim();
      if (!label || seen.has(label.toLowerCase())) return false;
      seen.add(label.toLowerCase());
      return true;
    });
  }, [suggestions]);

  const selectDivision = (value: string) => {
    onChange("division", value);
    onChange("district", "");
    onChange("area", "");
    setAreaQuery("");
    clearSuggestions();
  };

  const selectDistrict = (value: string) => {
    onChange("district", value);
    onChange("area", "");
    setAreaQuery("");
    clearSuggestions();
  };

  const selectArea = (value: string) => {
    onChange("area", value.trim());
    setAreaQuery("");
    clearSuggestions();
    setAreaOpen(false);
  };

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label>Division *</Label>
        <Select value={division} onValueChange={selectDivision}>
          <SelectTrigger aria-invalid={Boolean(errors.division)}>
            <SelectValue placeholder="Select Division" />
          </SelectTrigger>
          <SelectContent>
            {bangladeshDivisions.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <FieldMessage message={errors.division} />
      </div>

      <div className="space-y-1.5">
        <Label>District *</Label>
        <Select
          value={district}
          onValueChange={selectDistrict}
          disabled={!division}
        >
          <SelectTrigger aria-invalid={Boolean(errors.district)}>
            <SelectValue
              placeholder={
                division ? "Select District" : "Select Division first"
              }
            />
          </SelectTrigger>
          <SelectContent>
            {districts.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <FieldMessage message={errors.district} />
      </div>

      <div className="space-y-1.5 sm:col-span-2">
        <Label>Area / Upazila *</Label>
        <Popover open={areaOpen} onOpenChange={setAreaOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              role="combobox"
              aria-expanded={areaOpen}
              aria-invalid={Boolean(errors.area)}
              disabled={!district}
              className={cn(
                "w-full justify-between font-normal",
                !area && "text-muted-foreground",
              )}
            >
              <span className="flex min-w-0 items-center gap-2">
                <MapPin className="size-4 shrink-0" />
                <span className="truncate">
                  {area || (district ? "Select Area" : "Select District first")}
                </span>
              </span>
              <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            className="w-[var(--radix-popover-trigger-width)] p-0"
          >
            <Command shouldFilter={false}>
              <CommandInput
                placeholder={`Search area in ${district}`}
                value={areaQuery}
                onValueChange={(value) => {
                  setAreaQuery(value);
                  search(value, district);
                }}
              />
              <CommandList>
                {isLoading ? (
                  <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" /> Searching
                    areas...
                  </div>
                ) : null}
                {!isLoading && areaQuery.trim().length < 2 ? (
                  <CommandEmpty>Type at least 2 letters.</CommandEmpty>
                ) : null}
                {!isLoading && areaQuery.trim().length >= 2 ? (
                  <CommandGroup heading="Area results">
                    {areaOptions.map((place) => {
                      const label = areaName(place);
                      return (
                        <CommandItem
                          key={place.id}
                          value={`${place.id}-${label}`}
                          onSelect={() => selectArea(label)}
                          data-checked={area === label}
                        >
                          <MapPin className="size-4 text-emerald-600" />
                          <span className="min-w-0">
                            <span className="block truncate font-medium">
                              {label}
                            </span>
                            <span className="block truncate text-xs text-muted-foreground">
                              {place.address}
                            </span>
                          </span>
                        </CommandItem>
                      );
                    })}
                    <CommandItem
                      value={`manual-${areaQuery}`}
                      onSelect={() => selectArea(areaQuery)}
                    >
                      Use &ldquo;{areaQuery.trim()}&rdquo;
                    </CommandItem>
                  </CommandGroup>
                ) : null}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        <FieldMessage message={errors.area} />
      </div>
    </div>
  );
}
