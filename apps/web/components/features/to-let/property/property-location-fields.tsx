"use client";

import { ChevronsUpDown, MapPin } from "lucide-react";
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
import {
  areasForUpazila,
  upazilasForDistrict,
} from "@/constants/property-location-options";
import { cn } from "@/lib/utils";

interface PropertyLocationFieldsProps {
  division: string;
  district: string;
  area: string;
  upazila: string;
  errors: {
    division?: string;
    district?: string;
    area?: string;
    upazila?: string;
  };
  onChange: (
    field: "division" | "district" | "upazila" | "area",
    value: string,
  ) => void;
}

function FieldMessage({ message }: { message?: string }) {
  return message ? (
    <p role="alert" className="text-xs text-red-600">
      {message}
    </p>
  ) : null;
}

export function PropertyLocationFields({
  division,
  district,
  area,
  upazila,
  errors,
  onChange,
}: PropertyLocationFieldsProps) {
  const [areaOpen, setAreaOpen] = useState(false);
  const [upazilaOpen, setUpazilaOpen] = useState(false);
  const [upazilaQuery, setUpazilaQuery] = useState("");
  const [areaQuery, setAreaQuery] = useState("");
  const districts = districtsForDivision(division);
  const upazilaOptions = useMemo(
    () => upazilasForDistrict(division, district),
    [division, district],
  );
  const areaOptions = useMemo(
    () => areasForUpazila(division, district, upazila),
    [division, district, upazila],
  );
  const selectUpazila = (value: string) => {
    if (value !== upazila) {
      onChange("upazila", value);
      onChange("area", "");
    }
    setUpazilaQuery("");
    setAreaQuery("");
    setUpazilaOpen(false);
    setAreaOpen(false);
  };

  const selectDivision = (value: string) => {
    if (value === division) return;
    onChange("division", value);
    onChange("district", "");
    onChange("upazila", "");
    setUpazilaQuery("");
    onChange("area", "");
    setAreaQuery("");
    setUpazilaOpen(false);
    setAreaOpen(false);
  };

  const selectDistrict = (value: string) => {
    if (value === district) return;
    onChange("district", value);
    onChange("upazila", "");
    setUpazilaQuery("");
    onChange("area", "");
    setAreaQuery("");
    setUpazilaOpen(false);
    setAreaOpen(false);
  };

  const selectArea = (value: string) => {
    onChange("area", value.trim());
    setAreaQuery("");
    setAreaOpen(false);
  };

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label htmlFor="property-division">Division *</Label>
        <Select value={division} onValueChange={selectDivision}>
          <SelectTrigger
            id="property-division"
            className="h-10 w-full"
            aria-invalid={Boolean(errors.division)}
          >
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
        <Label htmlFor="property-district">District *</Label>
        <Select
          value={district}
          onValueChange={selectDistrict}
          disabled={!division}
        >
          <SelectTrigger
            id="property-district"
            className="h-10 w-full"
            aria-invalid={Boolean(errors.district)}
          >
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

      <div className="space-y-1.5">
        <Label htmlFor="property-upazila">Upazila / Thana *</Label>
        <Popover open={upazilaOpen} onOpenChange={setUpazilaOpen}>
          <PopoverTrigger asChild>
            <Button
              id="property-upazila"
              type="button"
              variant="outline"
              role="combobox"
              aria-expanded={upazilaOpen}
              aria-invalid={Boolean(errors.upazila)}
              disabled={!district}
              className={cn(
                "w-full justify-between font-normal",
                !upazila && "text-muted-foreground",
              )}
            >
              <span className="truncate">
                {upazila ||
                  (district
                    ? "Select Upazila / Thana"
                    : "Select District first")}
              </span>
              <ChevronsUpDown className="size-4 shrink-0" aria-hidden="true" />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            className="w-[var(--radix-popover-trigger-width)] p-0"
          >
            <Command shouldFilter={false}>
              <CommandInput
                placeholder="Type Upazila / Thana name"
                value={upazilaQuery}
                onValueChange={setUpazilaQuery}
                maxLength={150}
              />
              <CommandList>
                <CommandEmpty>
                  No location listed. Type at least 2 letters to add a name.
                </CommandEmpty>
                <CommandGroup>
                  {upazilaOptions
                    .filter((option) =>
                      option
                        .toLowerCase()
                        .includes(upazilaQuery.trim().toLowerCase()),
                    )
                    .map((option) => (
                      <CommandItem
                        key={option}
                        value={option}
                        onSelect={() => selectUpazila(option)}
                      >
                        {option}
                      </CommandItem>
                    ))}
                  {upazilaQuery.trim().length >= 2 &&
                    !upazilaOptions.some(
                      (option) =>
                        option.toLowerCase() ===
                        upazilaQuery.trim().toLowerCase(),
                    ) && (
                      <CommandItem
                        value={`manual-${upazilaQuery}`}
                        onSelect={() => selectUpazila(upazilaQuery.trim())}
                      >
                        Use &ldquo;{upazilaQuery.trim()}&rdquo; (not listed)
                      </CommandItem>
                    )}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        <FieldMessage message={errors.upazila} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="property-area">Area *</Label>
        <Popover open={areaOpen} onOpenChange={setAreaOpen}>
          <PopoverTrigger asChild>
            <Button
              id="property-area"
              type="button"
              variant="outline"
              role="combobox"
              aria-expanded={areaOpen}
              aria-invalid={Boolean(errors.area)}
              disabled={!upazila}
              className={cn(
                "w-full justify-between font-normal",
                !area && "text-muted-foreground",
              )}
            >
              <span className="flex min-w-0 items-center gap-2">
                <MapPin className="size-4 shrink-0" />
                <span className="truncate">
                  {area ||
                    (upazila ? "Select Area" : "Select Upazila / Thana first")}
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
                placeholder={`Search area in ${upazila}`}
                value={areaQuery}
                onValueChange={setAreaQuery}
                maxLength={150}
              />
              <CommandList>
                <CommandEmpty>
                  No area listed. Type at least 2 letters to add a name.
                </CommandEmpty>
                <CommandGroup heading="Area results">
                  {areaOptions
                    .filter((option) =>
                      option
                        .toLowerCase()
                        .includes(areaQuery.trim().toLowerCase()),
                    )
                    .map((label) => {
                      return (
                        <CommandItem
                          key={label}
                          value={label}
                          onSelect={() => selectArea(label)}
                          data-checked={area === label}
                        >
                          <MapPin className="size-4 text-emerald-600" />
                          <span className="min-w-0">
                            <span className="block truncate font-medium">
                              {label}
                            </span>
                          </span>
                        </CommandItem>
                      );
                    })}
                  {areaQuery.trim().length >= 2 &&
                    !areaOptions.some(
                      (option) =>
                        option.toLowerCase() === areaQuery.trim().toLowerCase(),
                    ) && (
                      <CommandItem
                        value={`manual-${areaQuery}`}
                        onSelect={() => selectArea(areaQuery)}
                      >
                        Use &ldquo;{areaQuery.trim()}&rdquo; (not listed)
                      </CommandItem>
                    )}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        <FieldMessage message={errors.area} />
      </div>
    </div>
  );
}
