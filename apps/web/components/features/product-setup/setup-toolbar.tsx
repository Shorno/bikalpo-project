"use client";

import { RotateCcw, Search } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useIsMobile } from "@/hooks/use-mobile";

export type SetupFilterDefinition = {
  key: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string; disabled?: boolean }>;
};

type SetupToolbarProps = {
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  filters?: ReactNode;
  filterDefinitions?: SetupFilterDefinition[];
  onClear?: () => void;
  hasActiveFilters?: boolean;
};

export function SetupToolbar({
  searchValue,
  onSearchChange,
  searchPlaceholder = "Search by name or code",
  filters,
  filterDefinitions = [],
  onClear,
  hasActiveFilters = false,
}: SetupToolbarProps) {
  const hasFilters = filterDefinitions.length > 0 || Boolean(filters);
  const isMobile = useIsMobile();

  return (
    <section
      aria-label="Setup filters"
      className="rounded-xl border bg-card p-4 shadow-sm max-md:p-3"
    >
      <div className="relative mb-4 w-full md:w-2/3">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          aria-label={searchPlaceholder}
          className="h-11 pl-10"
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={searchPlaceholder}
          value={searchValue}
        />
      </div>
      {hasFilters && (
        <div
          className={`grid gap-3 sm:grid-cols-2 lg:grid-cols-4 max-md:grid-cols-2 ${filterDefinitions.length > 1 && filterDefinitions.length % 2 === 1 && !filters ? "max-md:[&>div:last-child]:col-span-2" : ""}`}
        >
          {filterDefinitions.map((filter) => (
            <div className="space-y-1.5 max-md:min-w-0" key={filter.key}>
              <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {filter.label}
              </span>
              <Select onValueChange={filter.onChange} value={filter.value}>
                <SelectTrigger
                  aria-label={filter.label}
                  className="w-full max-md:min-w-0 max-md:text-xs max-md:data-[size=default]:h-11 max-md:[&_[data-slot=select-value]]:block max-md:[&_[data-slot=select-value]]:min-w-0 max-md:[&_[data-slot=select-value]]:truncate"
                >
                  <SelectValue placeholder={filter.label} />
                </SelectTrigger>
                <SelectContent
                  position={isMobile ? "popper" : "item-aligned"}
                  align={isMobile ? "start" : "center"}
                  className="max-md:max-w-[calc(100vw-2rem)]"
                >
                  {filter.options.map((option) => (
                    <SelectItem
                      className="max-md:min-h-9 max-md:whitespace-normal max-md:break-words"
                      disabled={option.disabled}
                      key={option.value}
                      value={option.value}
                    >
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
          {filters}
        </div>
      )}
      {onClear && hasActiveFilters && (
        <div className="mt-4 flex justify-end border-t pt-3">
          <Button onClick={onClear} size="sm" type="button" variant="ghost">
            <RotateCcw aria-hidden="true" className="size-4" />
            Clear filters
          </Button>
        </div>
      )}
    </section>
  );
}
