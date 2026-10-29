"use client";

import { RotateCcw, Search } from "lucide-react";
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

type SetupFilterDefinitions =
  | readonly []
  | readonly [SetupFilterDefinition]
  | readonly [SetupFilterDefinition, SetupFilterDefinition]
  | readonly [SetupFilterDefinition, SetupFilterDefinition, SetupFilterDefinition]
  | readonly [
      SetupFilterDefinition,
      SetupFilterDefinition,
      SetupFilterDefinition,
      SetupFilterDefinition,
    ];

type SetupToolbarProps = {
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  filterDefinitions?: SetupFilterDefinitions;
  onClear?: () => void;
  hasActiveFilters?: boolean;
};

export function SetupToolbar({
  searchValue,
  onSearchChange,
  searchPlaceholder = "Search by name or code",
  filterDefinitions = [],
  onClear,
  hasActiveFilters = false,
}: SetupToolbarProps) {
  const hasFilters = filterDefinitions.length > 0;
  const isMobile = useIsMobile();

  return (
    <section
      aria-label="Setup filters"
      className="rounded-xl border bg-card p-4 shadow-sm max-md:p-3"
    >
      <div className="mb-4 flex items-center gap-2">
        <div className="relative min-w-0 flex-1 md:w-2/3 md:flex-none">
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
        {onClear && hasActiveFilters && (
          <Button
            className="shrink-0 max-md:min-h-11"
            onClick={onClear}
            size="sm"
            type="button"
            variant="ghost"
          >
            <RotateCcw aria-hidden="true" className="size-4" />
            Clear filters
          </Button>
        )}
      </div>
      {hasFilters && (
        <div
          className={`grid gap-3 sm:grid-cols-2 lg:grid-cols-4 max-md:grid-cols-2 ${filterDefinitions.length > 1 && filterDefinitions.length % 2 === 1 ? "max-md:[&>div:last-child]:col-span-2" : ""}`}
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
        </div>
      )}
    </section>
  );
}
