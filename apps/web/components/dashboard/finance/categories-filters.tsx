"use client";

import type { AccountType } from "@/components/dashboard/finance/chart-of-accounts-data";
import { ACCOUNT_TYPES } from "@/components/dashboard/finance/chart-of-accounts-data";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type AccountTypeFilter = AccountType | "ALL";

type CategoriesFiltersProps = {
  accountType: AccountTypeFilter;
  filteredCount: number;
  searchTerm: string;
  onAccountTypeChange: (value: AccountTypeFilter) => void;
  onSearchTermChange: (value: string) => void;
};

export function CategoriesFilters({
  accountType,
  filteredCount,
  searchTerm,
  onAccountTypeChange,
  onSearchTermChange,
}: CategoriesFiltersProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="grid gap-3 sm:grid-cols-[minmax(220px,320px)_180px]">
        <Input
          aria-label="Filter by name or number"
          placeholder="Filter by name or number"
          value={searchTerm}
          onChange={(event) => onSearchTermChange(event.target.value)}
        />
        <Select
          value={accountType}
          onValueChange={(value) =>
            onAccountTypeChange(value as AccountTypeFilter)
          }
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="All" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All</SelectItem>
            {ACCOUNT_TYPES.map((type) => (
              <SelectItem key={type} value={type}>
                {type}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <span className="text-muted-foreground text-sm">
        Showing {filteredCount} results
      </span>
    </div>
  );
}
