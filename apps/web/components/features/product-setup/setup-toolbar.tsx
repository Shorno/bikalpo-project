"use client";

import { Filter, RotateCcw, Search } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type SetupFilterDefinition = {
  key: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string; disabled?: boolean }>;
  widthClassName?: string;
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
  const [filtersOpen, setFiltersOpen] = useState(false);
  const renderedFilters = (
    <>
      {filterDefinitions.map((filter) => (
        <Select
          key={filter.key}
          onValueChange={filter.onChange}
          value={filter.value}
        >
          <SelectTrigger
            aria-label={filter.label}
            className={cn(
              "h-11 w-full shadow-none md:h-10 md:w-40",
              filter.widthClassName,
            )}
          >
            <SelectValue placeholder={filter.label} />
          </SelectTrigger>
          <SelectContent>
            {filter.options.map((option) => (
              <SelectItem
                disabled={option.disabled}
                key={option.value}
                value={option.value}
              >
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ))}
      {filters}
    </>
  );
  const hasFilters = filterDefinitions.length > 0 || Boolean(filters);

  return (
    <Collapsible onOpenChange={setFiltersOpen} open={filtersOpen}>
      <div className="rounded-lg border bg-card">
        <div className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1 sm:max-w-sm">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              aria-label={searchPlaceholder}
              className="h-11 pl-9 shadow-none sm:h-10"
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder={searchPlaceholder}
              value={searchValue}
            />
          </div>
          {hasFilters && (
            <>
              <div className="hidden flex-1 flex-wrap items-center gap-2 md:flex">
                {renderedFilters}
              </div>
              <CollapsibleTrigger asChild>
                <Button
                  aria-expanded={filtersOpen}
                  className="h-11 justify-center md:hidden"
                  variant="outline"
                >
                  <Filter aria-hidden="true" className="size-4" />
                  Filters
                </Button>
              </CollapsibleTrigger>
            </>
          )}
          {onClear && hasActiveFilters && (
            <Button
              className="h-11 shrink-0 sm:h-10"
              onClick={onClear}
              type="button"
              variant="ghost"
            >
              <RotateCcw aria-hidden="true" className="size-4" />
              Clear
            </Button>
          )}
        </div>
        {hasFilters && (
          <CollapsibleContent className="border-t md:hidden">
            <div className="grid gap-2 p-3 sm:grid-cols-2">
              {renderedFilters}
            </div>
          </CollapsibleContent>
        )}
      </div>
    </Collapsible>
  );
}
