"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const SETUP_PAGE_SIZE_OPTIONS = [10, 20, 50] as const;

interface SetupTableFooterProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  /** Change the row limit and reset the owning table to its first page. */
  onPageSizeChange: (pageSize: number) => void;
  pageSizeOptions?: readonly number[];
  disabled?: boolean;
  ariaLabel?: string;
}

export function SetupTableFooter({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = SETUP_PAGE_SIZE_OPTIONS,
  disabled = false,
  ariaLabel = "Table pagination",
}: SetupTableFooterProps) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.max(1, Math.min(page, pageCount));
  const firstRow = total === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const lastRow = Math.min(currentPage * pageSize, total);

  return (
    <nav
      aria-label={ariaLabel}
      className="flex flex-wrap items-center justify-between gap-3 text-sm"
    >
      <p className="font-mono text-xs tabular-nums text-muted-foreground">
        {firstRow}–{lastRow} of {total}
      </p>
      <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
        <Select
          disabled={disabled}
          onValueChange={(value) => onPageSizeChange(Number(value))}
          value={String(pageSize)}
        >
          <SelectTrigger
            aria-label="Rows per page"
            className="h-11 w-28 shadow-none sm:h-9 max-md:w-24 max-md:data-[size=default]:h-11"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="end">
            {pageSizeOptions.map((option) => (
              <SelectItem key={option} value={String(option)}>
                {option} rows
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          aria-label="Previous page"
          className="h-11 md:h-9 max-md:w-11 max-md:p-0"
          disabled={disabled || currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
          type="button"
          variant="outline"
        >
          <ChevronLeft aria-hidden="true" className="size-4 md:hidden" />
          <span className="max-md:hidden">Previous</span>
        </Button>
        <span className="min-w-16 text-center font-mono text-xs tabular-nums text-muted-foreground max-md:min-w-10">
          {currentPage} / {pageCount}
        </span>
        <Button
          aria-label="Next page"
          className="h-11 md:h-9 max-md:w-11 max-md:p-0"
          disabled={disabled || currentPage >= pageCount}
          onClick={() => onPageChange(currentPage + 1)}
          type="button"
          variant="outline"
        >
          <span className="max-md:hidden">Next</span>
          <ChevronRight aria-hidden="true" className="size-4 md:hidden" />
        </Button>
      </div>
    </nav>
  );
}
