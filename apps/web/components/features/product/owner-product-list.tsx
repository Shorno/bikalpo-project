"use client";

import type {
  OwnerProductFilterOption,
  OwnerProductListInput,
  OwnerProductListItem,
} from "@bikalpo-project/api/routers/helpers/owner-product-list";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Loader2,
  Package,
  PackagePlus,
  PackageSearch,
  Printer,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";
import { toast } from "sonner";
import { CatalogFilterPanel } from "@/components/features/product/components/catalog-layout";
import { FilterSelect } from "@/components/features/product/components/product-catalog-table";
import { SetupTableFooter } from "@/components/features/product-setup/setup-table-footer";
import { Button } from "@/components/ui/button";
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
 * The Products page shared by the wholesaler and retailer panels, per the
 * client review: one row per product, no stock (stock lives under Stock),
 * catalog-style filters, and inactive products shown faded.
 */

export type OwnerProductListResponse = {
  items: OwnerProductListItem[];
  pagination: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
  };
  filterOptions: {
    types: OwnerProductFilterOption[];
    categories: OwnerProductFilterOption[];
    subCategories: OwnerProductFilterOption[];
  };
};

type ListQuery = Omit<OwnerProductListInput, "search"> & { search?: string };
type StatusFilter = OwnerProductListInput["status"];
type SortBy = OwnerProductListInput["sortBy"];

const ALL = "all";
const toId = (value: string) => (value === ALL ? undefined : Number(value));
const toValue = (id: number | undefined) => (id == null ? ALL : String(id));

const STATUS_OPTIONS: Array<{ value: StatusFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];

function formatValue(value: number) {
  return `৳${value.toLocaleString("en-BD", { maximumFractionDigits: 0 })}`;
}

function variantText(item: OwnerProductListItem) {
  if (item.variantCount === 1) return item.variantLabel ?? "—";
  if (item.variantCount > 1) return String(item.variantCount);
  return "—";
}

export function OwnerProductList({
  queryKey,
  fetchList,
  detailHref,
  addProductHref,
}: {
  /** Distinguishes the wholesaler and retailer caches. */
  queryKey: readonly unknown[];
  fetchList: (input: ListQuery) => Promise<OwnerProductListResponse>;
  detailHref: (productId: number) => string;
  addProductHref: string;
}) {
  const isMobile = useIsMobile();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [typeId, setTypeId] = useState<number>();
  const [categoryId, setCategoryId] = useState<number>();
  const [subCategoryId, setSubCategoryId] = useState<number>();
  const [status, setStatus] = useState<StatusFilter>("all");
  const [sortBy, setSortBy] = useState<SortBy>("name_asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    const timer = window.setTimeout(
      () => setDebouncedSearch(search.trim()),
      300,
    );
    return () => window.clearTimeout(timer);
  }, [search]);

  const input: ListQuery = {
    page,
    pageSize,
    search: debouncedSearch || undefined,
    typeId,
    categoryId,
    subCategoryId,
    status,
    sortBy,
  };
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: [...queryKey, input],
    queryFn: () => fetchList(input),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });

  const items = data?.items ?? [];
  const totalCount = data?.pagination.totalCount ?? 0;
  const options = data?.filterOptions;
  const categories = (options?.categories ?? []).filter(
    (option) => !typeId || option.parentId === typeId,
  );
  const categoryIds = new Set(categories.map((option) => option.id));
  const subCategories = (options?.subCategories ?? []).filter((option) =>
    categoryId
      ? option.parentId === categoryId
      : option.parentId !== null && categoryIds.has(option.parentId),
  );

  const hasFilters = Boolean(
    search || typeId || categoryId || subCategoryId || status !== "all",
  );
  const clearFilters = () => {
    setSearch("");
    setTypeId(undefined);
    setCategoryId(undefined);
    setSubCategoryId(undefined);
    setStatus("all");
    setPage(1);
  };
  const toggleSort = (column: "name" | "value") => {
    setSortBy((current) =>
      column === "name"
        ? current === "name_asc"
          ? "name_desc"
          : "name_asc"
        : current === "value_desc"
          ? "value_asc"
          : "value_desc",
    );
    setPage(1);
  };

  const columnCount = isMobile ? 4 : 5;

  return (
    <div className="space-y-5 max-md:min-w-0 max-md:space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-inset ring-primary/15 max-md:size-9">
            <Package aria-hidden="true" className="size-5" />
          </span>
          <div className="min-w-0">
            <h1 className="text-lg font-semibold tracking-tight">Products</h1>
            <p className="text-sm text-muted-foreground max-md:text-xs">
              {totalCount.toLocaleString("en-BD")}{" "}
              {totalCount === 1 ? "product" : "products"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="max-md:min-h-10"
            onClick={() => toast.info("Label printing is coming soon.")}
          >
            <Printer aria-hidden="true" className="size-4" />
            Print Labels
          </Button>
          <Button asChild size="sm" className="max-md:min-h-10">
            <Link href={addProductHref}>
              <PackagePlus aria-hidden="true" className="size-4" />
              Add Product
            </Link>
          </Button>
        </div>
      </header>

      <CatalogFilterPanel
        search={search}
        onSearchChange={(value) => {
          setSearch(value);
          setPage(1);
        }}
        searchPlaceholder="Search by name or Product ID"
        hasFilters={hasFilters}
        onClear={clearFilters}
        gridClassName="grid-cols-3 lg:grid-cols-4"
      >
        <FilterSelect
          compact={isMobile}
          label="Type"
          value={toValue(typeId)}
          options={options?.types ?? []}
          onValueChange={(value) => {
            setTypeId(toId(value));
            setCategoryId(undefined);
            setSubCategoryId(undefined);
            setPage(1);
          }}
        />
        <FilterSelect
          compact={isMobile}
          label="Category"
          value={toValue(categoryId)}
          options={categories}
          onValueChange={(value) => {
            setCategoryId(toId(value));
            setSubCategoryId(undefined);
            setPage(1);
          }}
        />
        <FilterSelect
          compact={isMobile}
          label="Sub Category"
          value={toValue(subCategoryId)}
          options={subCategories}
          onValueChange={(value) => {
            setSubCategoryId(toId(value));
            setPage(1);
          }}
        />
        <StatusFilterControl
          value={status}
          onChange={(value) => {
            setStatus(value);
            setPage(1);
          }}
        />
      </CatalogFilterPanel>

      <div className="space-y-4">
        <section
          aria-label="Products"
          aria-busy={isFetching}
          className="overflow-hidden rounded-xl border bg-card shadow-sm"
        >
          {/* Fixed columns with truncation, so the table never scrolls sideways. */}
          <Table
            className={cn(
              "table-fixed",
              isMobile && "text-[11px] leading-4 min-[400px]:text-xs",
            )}
          >
            <caption className="sr-only">
              Products. Inactive products are shown faded.
            </caption>
            {isMobile ? (
              <colgroup>
                <col className="w-[26%]" />
                <col className="w-[33%]" />
                <col className="w-[17%]" />
                <col className="w-[24%]" />
              </colgroup>
            ) : (
              <colgroup>
                <col className="w-[17%]" />
                <col className="w-[35%]" />
                <col className="w-[21%]" />
                <col className="w-[12%]" />
                <col className="w-[15%]" />
              </colgroup>
            )}
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <HeaderCell compact={isMobile}>Product ID</HeaderCell>
                <HeaderCell compact={isMobile}>
                  <SortButton
                    label={isMobile ? "Name" : "Product Name"}
                    direction={
                      sortBy === "name_asc"
                        ? "asc"
                        : sortBy === "name_desc"
                          ? "desc"
                          : null
                    }
                    onClick={() => toggleSort("name")}
                  />
                </HeaderCell>
                {isMobile ? null : (
                  <HeaderCell compact={false}>Category</HeaderCell>
                )}
                <HeaderCell compact={isMobile}>Variant</HeaderCell>
                <HeaderCell compact={isMobile} className="text-right">
                  <SortButton
                    label="Value"
                    align="right"
                    direction={
                      sortBy === "value_desc"
                        ? "desc"
                        : sortBy === "value_asc"
                          ? "asc"
                          : null
                    }
                    onClick={() => toggleSort("value")}
                  />
                </HeaderCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <StatusRow colSpan={columnCount}>
                  <span className="inline-flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" />
                    Loading products…
                  </span>
                </StatusRow>
              ) : isError ? (
                <StatusRow colSpan={columnCount}>
                  <div className="space-y-3">
                    <div>
                      <p className="font-medium">Could not load products</p>
                      <p className="text-sm text-muted-foreground">
                        {error?.message || "Please try again."}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => refetch()}
                    >
                      Try again
                    </Button>
                  </div>
                </StatusRow>
              ) : items.length === 0 ? (
                <StatusRow colSpan={columnCount}>
                  <div className="flex flex-col items-center py-6">
                    <PackageSearch className="size-8 text-muted-foreground" />
                    <p className="mt-3 font-medium">No products found</p>
                    <p className="mt-1 max-w-md text-sm text-muted-foreground">
                      {hasFilters
                        ? "No products match these filters."
                        : "Add products from the Product Catalog to see them here."}
                    </p>
                    {hasFilters ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-4"
                        onClick={clearFilters}
                      >
                        Clear filters
                      </Button>
                    ) : null}
                  </div>
                </StatusRow>
              ) : (
                items.map((item) => {
                  const href = detailHref(item.productId);
                  return (
                    <TableRow
                      key={item.productId}
                      onClick={(event) => {
                        if (
                          !(event.target as HTMLElement).closest("a, button")
                        ) {
                          router.push(href);
                        }
                      }}
                      title={item.isActive ? undefined : "Inactive product"}
                      className={cn(
                        "cursor-pointer",
                        !item.isActive &&
                          "bg-muted/30 [&>td]:opacity-55 [&>td]:blur-[0.6px] hover:[&>td]:blur-none",
                      )}
                    >
                      <BodyCell
                        compact={isMobile}
                        className="font-medium tabular-nums"
                      >
                        {item.productCode ?? "—"}
                      </BodyCell>
                      <BodyCell compact={isMobile}>
                        <Link
                          href={href}
                          className="block truncate font-medium underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                          title={item.name}
                        >
                          {item.name}
                          {item.isActive ? null : (
                            <span className="sr-only"> (inactive)</span>
                          )}
                        </Link>
                      </BodyCell>
                      {isMobile ? null : (
                        <BodyCell compact={false}>
                          <span title={item.categoryName}>
                            {item.categoryName}
                          </span>
                        </BodyCell>
                      )}
                      <BodyCell compact={isMobile} className="tabular-nums">
                        {variantText(item)}
                      </BodyCell>
                      <BodyCell
                        compact={isMobile}
                        className="text-right font-medium tabular-nums"
                      >
                        {formatValue(item.value)}
                      </BodyCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </section>

        {!isLoading && !isError ? (
          <SetupTableFooter
            ariaLabel="Products pagination"
            page={data?.pagination.page ?? page}
            pageSize={pageSize}
            total={totalCount}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPage(1);
            }}
          />
        ) : null}
      </div>
    </div>
  );
}

function StatusFilterControl({
  value,
  onChange,
}: {
  value: StatusFilter;
  onChange: (value: StatusFilter) => void;
}) {
  return (
    <fieldset className="min-w-0 space-y-1.5 max-lg:col-span-3 max-lg:max-w-sm max-md:max-w-none">
      <legend className="mb-1.5 block truncate text-[11px] font-medium uppercase tracking-wide text-muted-foreground max-md:text-[10px] max-md:tracking-normal">
        Status
      </legend>
      <div className="grid h-9 grid-cols-3 rounded-md border bg-muted/40 p-0.5 max-md:h-11">
        {STATUS_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
            className={cn(
              "rounded-[5px] text-xs font-medium text-muted-foreground transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
              value === option.value
                ? "bg-background text-foreground shadow-sm"
                : "hover:text-foreground",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function SortButton({
  label,
  direction,
  onClick,
  align = "left",
}: {
  label: string;
  direction: "asc" | "desc" | null;
  onClick: () => void;
  align?: "left" | "right";
}) {
  const Icon =
    direction === "asc"
      ? ArrowUp
      : direction === "desc"
        ? ArrowDown
        : ArrowUpDown;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 rounded-sm font-medium hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        align === "right" && "flex-row-reverse",
      )}
      aria-label={`Sort by ${label}${direction ? `, currently ${direction === "asc" ? "ascending" : "descending"}` : ""}`}
    >
      {label}
      <Icon
        aria-hidden="true"
        className={cn(
          "size-3.5",
          direction ? "text-foreground" : "text-muted-foreground",
        )}
      />
    </button>
  );
}

function HeaderCell({
  compact,
  className,
  children,
}: {
  compact: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <TableHead
      scope="col"
      className={cn(
        compact && "whitespace-nowrap px-1.5 min-[400px]:px-2",
        className,
      )}
    >
      {children}
    </TableHead>
  );
}

function BodyCell({
  compact,
  className,
  children,
}: {
  compact: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <TableCell
      className={cn(
        "truncate",
        compact && "px-1.5 py-3 min-[400px]:px-2",
        className,
      )}
    >
      {children}
    </TableCell>
  );
}

function StatusRow({
  colSpan,
  children,
}: {
  colSpan: number;
  children: ReactNode;
}) {
  return (
    <TableRow className="hover:bg-transparent">
      <TableCell
        colSpan={colSpan}
        className="h-32 whitespace-normal text-center"
      >
        {children}
      </TableCell>
    </TableRow>
  );
}
