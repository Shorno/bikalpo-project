"use client";

import { Eye, Layers3, Loader2, PackageSearch, Plus, Search, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

/**
 * Shared look for the Product Catalog pages (admin, retailer, wholesaler).
 * Each page keeps its own data loading; these components only render.
 */

export function CatalogPageHeader({
  title = "Product Catalog",
  description,
  stats,
}: {
  title?: string;
  description: string;
  stats: Array<{ label: string; value: number }>;
}) {
  return (
    <header className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <div className="flex items-center gap-3.5 p-5 max-md:gap-3 max-md:p-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-inset ring-primary/15 max-md:size-9">
          <Layers3 aria-hidden="true" className="size-5" />
        </span>
        <div className="max-md:min-w-0">
          <h1 className="text-lg font-semibold tracking-tight max-md:text-base">
            {title}
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground max-md:text-xs">
            {description}
          </p>
        </div>
      </div>
      <div className="grid grid-cols-3 divide-x border-t bg-muted/30">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="px-4 py-3.5 text-center max-md:px-2 max-md:py-2.5"
          >
            <p className="text-lg font-semibold leading-none tabular-nums">
              {stat.value.toLocaleString("en-BD")}
            </p>
            <p className="mt-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {stat.label}
            </p>
          </div>
        ))}
      </div>
    </header>
  );
}

/** Search box plus one row of filter dropdowns (one row on mobile too). */
export function CatalogFilterPanel({
  search,
  onSearchChange,
  hasFilters,
  onClear,
  children,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  hasFilters: boolean;
  onClear: () => void;
  /** The Type, Category, and Sub Category FilterSelects. */
  children: ReactNode;
}) {
  return (
    <section
      aria-label="Product filters"
      className="rounded-xl border bg-card p-4 shadow-sm max-md:p-3"
    >
      <div className="mb-4 flex items-center gap-2">
        <div className="relative min-w-0 flex-1 md:w-2/3 md:flex-none">
          <Search
            className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            aria-label="Search products"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search products..."
            className="h-11 pl-10"
          />
        </div>
        {hasFilters && (
          <Button
            className="shrink-0 max-md:min-h-11"
            variant="ghost"
            size="sm"
            type="button"
            onClick={onClear}
          >
            <X aria-hidden="true" className="size-4" />
            Clear filters
          </Button>
        )}
      </div>
      <div className="grid grid-cols-3 gap-3 max-md:gap-2">{children}</div>
    </section>
  );
}

/** Centered request / create buttons between the filters and the table. */
export function CatalogActionBar({ children }: { children: ReactNode }) {
  return (
    <div className="flex justify-center">
      <div className="flex flex-wrap items-center justify-center gap-2">
        {children}
      </div>
    </div>
  );
}

export type CatalogListRow = {
  key: string;
  systemId: string;
  type: string;
  category: string;
  subCategory: string | null;
  name: string;
  /** Product page opened by View, the name link, and a row tap on mobile. */
  href: string;
  /** Optional Add button shown after View. */
  add?: { label: string; href: string; disabled: boolean };
};

/** The catalog table: full columns on desktop, compact fixed columns on mobile. */
export function CatalogListTable({
  rows,
  isLoading,
  isError,
  errorMessage,
  onRetry,
  emptyDescription,
}: {
  rows: CatalogListRow[];
  isLoading: boolean;
  isError: boolean;
  errorMessage?: string;
  onRetry: () => void;
  emptyDescription: string;
}) {
  const router = useRouter();
  const isMobile = useIsMobile();
  const hasAdd = rows.some((row) => row.add);
  const columnCount = isMobile ? (hasAdd ? 5 : 4) : 6;

  return (
    <section
      aria-label="Products"
      className="@container/catalog overflow-hidden rounded-xl border bg-card shadow-sm"
    >
      <Table
        className={
          isMobile
            ? "table-fixed text-[11px] leading-4 @xs/catalog:text-xs"
            : "min-w-[760px]"
        }
      >
        <caption className="sr-only">Product catalog</caption>
        {isMobile ? (
          <colgroup>
            <col className={hasAdd ? "w-[21%]" : "w-[21%] @xs/catalog:w-[26%]"} />
            <col className={hasAdd ? "w-[19%]" : "w-[24%] @xs/catalog:w-[22%]"} />
            <col className={hasAdd ? "w-[24%]" : "w-[29%] @xs/catalog:w-[26%]"} />
            <col className={hasAdd ? "w-[24%]" : "w-[26%]"} />
            {hasAdd ? <col className="w-[12%]" /> : null}
          </colgroup>
        ) : null}
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {[
              "System ID",
              "Type",
              "Category",
              ...(isMobile ? [] : ["Sub Category"]),
              "Product Name",
            ].map((label) => (
              <TableHead
                key={label}
                scope="col"
                className={
                  isMobile
                    ? "whitespace-normal break-words px-1 @sm/catalog:px-2"
                    : label === "System ID"
                      ? "w-36"
                      : undefined
                }
              >
                {label}
              </TableHead>
            ))}
            {isMobile ? (
              hasAdd ? (
                <TableHead scope="col" className="px-1">
                  <span className="sr-only">Add</span>
                </TableHead>
              ) : null
            ) : (
              <TableHead scope="col" className="text-right">
                Action
              </TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <StatusRow colSpan={columnCount}>
              <span className="inline-flex items-center gap-2 text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Loading catalog…
              </span>
            </StatusRow>
          ) : isError ? (
            <StatusRow colSpan={columnCount}>
              <div className="space-y-3">
                <div>
                  <p className="font-medium">Could not load products</p>
                  <p className="text-sm text-muted-foreground">
                    {errorMessage || "Please retry the catalog request."}
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={onRetry}>
                  Try again
                </Button>
              </div>
            </StatusRow>
          ) : rows.length === 0 ? (
            <StatusRow colSpan={columnCount} tall>
              <div className="flex flex-col items-center">
                <PackageSearch className="size-8 text-muted-foreground" />
                <p className="mt-3 font-medium">No products found</p>
                <p className="mt-1 max-w-md text-sm text-muted-foreground">
                  {emptyDescription}
                </p>
              </div>
            </StatusRow>
          ) : (
            rows.map((row) => (
              <TableRow
                key={row.key}
                onClick={(event) => {
                  if (
                    isMobile &&
                    !(event.target as HTMLElement).closest("a, button")
                  ) {
                    router.push(row.href);
                  }
                }}
                className="max-md:cursor-pointer"
              >
                {isMobile ? (
                  <>
                    <MobileCell className="font-medium" title={row.systemId}>
                      {row.systemId}
                    </MobileCell>
                    <MobileCell title={row.type}>{row.type}</MobileCell>
                    <MobileCell title={row.category}>{row.category}</MobileCell>
                    <MobileCell title={row.name}>
                      <Link
                        href={row.href}
                        className="block min-h-7 truncate rounded-sm font-medium text-primary underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                      >
                        {row.name}
                      </Link>
                    </MobileCell>
                    {hasAdd ? (
                      <TableCell className="px-1 py-2 text-right align-middle">
                        {row.add ? <AddButton add={row.add} compact /> : null}
                      </TableCell>
                    ) : null}
                  </>
                ) : (
                  <>
                    <TableCell className="font-medium">{row.systemId}</TableCell>
                    <TableCell>{row.type}</TableCell>
                    <TableCell>{row.category}</TableCell>
                    <TableCell>
                      {row.subCategory ?? (
                        <span className="text-muted-foreground">None</span>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1.5">
                        <Button size="sm" variant="outline" asChild>
                          <Link href={row.href}>
                            <Eye className="size-4" />
                            View
                          </Link>
                        </Button>
                        {row.add ? <AddButton add={row.add} /> : null}
                      </div>
                    </TableCell>
                  </>
                )}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </section>
  );
}

function AddButton({
  add,
  compact = false,
}: {
  add: NonNullable<CatalogListRow["add"]>;
  compact?: boolean;
}) {
  const label = add.disabled ? add.label : "Add";
  const content = (
    <>
      <Plus aria-hidden="true" className="size-4" />
      {compact ? <span className="sr-only">{label}</span> : label}
    </>
  );
  const className = compact ? "size-9 p-0" : undefined;

  if (add.disabled) {
    return (
      <Button size="sm" disabled className={className} title={label}>
        {content}
      </Button>
    );
  }
  return (
    <Button size="sm" asChild className={className} title={label}>
      <Link href={add.href}>{content}</Link>
    </Button>
  );
}

function MobileCell({
  children,
  className,
  title,
}: {
  children: ReactNode;
  className?: string;
  title: string;
}) {
  return (
    <TableCell
      className={cn("px-1 py-2 align-middle @sm/catalog:px-2", className)}
    >
      <div className="truncate" title={title}>
        {children}
      </div>
    </TableCell>
  );
}

function StatusRow({
  colSpan,
  tall = false,
  children,
}: {
  colSpan: number;
  tall?: boolean;
  children: ReactNode;
}) {
  return (
    <TableRow>
      <TableCell
        colSpan={colSpan}
        className={`${tall ? "h-52" : "h-36"} text-center max-md:whitespace-normal max-md:break-words`}
      >
        {children}
      </TableCell>
    </TableRow>
  );
}
