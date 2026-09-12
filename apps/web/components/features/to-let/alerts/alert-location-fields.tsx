"use client";

import { ChevronsUpDown } from "lucide-react";
import { useState } from "react";
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
  bangladeshDivisions,
  districtsForDivision,
} from "@/constants/bangladesh-locations";
import {
  areasForUpazila,
  upazilasForDistrict,
} from "@/constants/property-location-options";
import type {
  AlertLocationField,
  AlertLocationSelection,
} from "@/lib/to-let-alert-location";

export const alertSelectClassName =
  "h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50";

interface AlertLocationFieldsProps {
  value: AlertLocationSelection;
  onChange: (field: AlertLocationField, value: string) => void;
}

export function AlertLocationFields({
  value,
  onChange,
}: AlertLocationFieldsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="min-w-0 space-y-2">
        <Label htmlFor="alert-division">Division *</Label>
        <select
          id="alert-division"
          className={alertSelectClassName}
          value={value.division}
          onChange={(event) => onChange("division", event.target.value)}
        >
          <option value="">Any division</option>
          {bangladeshDivisions.map((division) => (
            <option key={division}>{division}</option>
          ))}
        </select>
      </div>
      <div className="min-w-0 space-y-2">
        <Label htmlFor="alert-district">District *</Label>
        <select
          id="alert-district"
          className={alertSelectClassName}
          value={value.district}
          disabled={!value.division}
          onChange={(event) => onChange("district", event.target.value)}
        >
          <option value="">
            {value.division ? "Any district" : "Select Division first"}
          </option>
          {districtsForDivision(value.division).map((district) => (
            <option key={district}>{district}</option>
          ))}
        </select>
      </div>
      <LocationCombobox
        key={`upazila-${value.division}-${value.district}`}
        id="alert-upazila"
        label="Upazila / Thana *"
        value={value.upazila}
        options={upazilasForDistrict(value.division, value.district)}
        disabled={!value.district}
        emptyLabel="Any Upazila / Thana"
        disabledLabel="Select District first"
        onChange={(upazila) => onChange("upazila", upazila)}
      />
      <LocationCombobox
        key={`area-${value.division}-${value.district}-${value.upazila}`}
        id="alert-area"
        label="Area *"
        value={value.area}
        options={areasForUpazila(value.division, value.district, value.upazila)}
        disabled={!value.upazila}
        emptyLabel="Any area"
        disabledLabel="Select Upazila / Thana first"
        onChange={(area) => onChange("area", area)}
      />
    </div>
  );
}

function LocationCombobox({
  id,
  label,
  value,
  options,
  disabled,
  emptyLabel,
  disabledLabel,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  options: string[];
  disabled: boolean;
  emptyLabel: string;
  disabledLabel: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const choose = (selected: string) => {
    onChange(selected);
    setQuery("");
    setOpen(false);
  };
  const search = query.trim();
  const matches = options.filter((option) =>
    option.toLowerCase().includes(search.toLowerCase()),
  );
  const canAdd =
    search.length >= 2 &&
    !options.some((option) => option.toLowerCase() === search.toLowerCase());

  return (
    <div className="min-w-0 space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className="h-10 w-full min-w-0 justify-between font-normal"
          >
            <span className="truncate">
              {value || (disabled ? disabledLabel : emptyLabel)}
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
              placeholder="Search or enter a location"
              value={query}
              onValueChange={setQuery}
              maxLength={100}
            />
            <CommandList>
              <CommandEmpty>
                No location listed. Enter at least 2 characters to add it.
              </CommandEmpty>
              <CommandGroup>
                <CommandItem
                  value="__any_location__"
                  onSelect={() => choose("")}
                >
                  {emptyLabel}
                </CommandItem>
                {matches.map((option) => (
                  <CommandItem
                    key={option}
                    value={option}
                    onSelect={() => choose(option)}
                  >
                    {option}
                  </CommandItem>
                ))}
                {canAdd && (
                  <CommandItem
                    value={`custom-${search}`}
                    onSelect={() => choose(search)}
                  >
                    Use &ldquo;{search}&rdquo; (not listed)
                  </CommandItem>
                )}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
