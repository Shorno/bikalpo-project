"use client";

import { ChevronDown, Loader2, PackageSearch } from "lucide-react";
import { Fragment, type ReactNode, useMemo, useState } from "react";
import {
  CatalogFilterPanel,
  CatalogPageHeader,
} from "@/components/features/product/components/catalog-layout";
import { FilterSelect } from "@/components/features/product/components/product-catalog-table";
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
import {
  type ExpiryProduct,
  expiryProductId,
  formatExpiryDate,
  formatQuantities,
  matchesExpirySearch,
} from "./expiry-stock-model";
import { ExpiryRowDetail } from "./expiry-row-detail";
import {
  ExpiryStatusIcon,
  type SaveExpiryAlertDays,
} from "./expiry-status-icon";

const ALL = "all";

type ExpiryStockQuery = {
  data?: {
    products: unknown[];
    alertDayOptions: number[];
    defaultAlertDays: number;
  };
  isLoading: boolean;
  isError: boolean;
  error: { message: string } | null;
  refetch: () => unknown;
};

type Option = { id: number | string; name: string };

function uniqueOptions(items: Array<Option | null>) {
  const options = new Map<number | string, string>();
  for (const item of items) if (item) options.set(item.id, item.name);
  return Array.from(options, ([id, name]) => ({ id, name })).sort((a, b) =>
    a.name.localeCompare(b.name),
  );
}

const option = (id: number | null, name: string | null) =>
  id != null && name ? { id, name } : null;

/**
 * Expired Products (client, 2026-11-24): products holding stock in a batch
 * past, or close to, its expiry date. View opens the batches in place.
 */
export function ExpiryStockPage({
  query,
  onSaveAlertDays,
  damageHref,
}: {
  query: ExpiryStockQuery;
  onSaveAlertDays: SaveExpiryAlertDays;
  /** Create Damage link for the expired batches, or null to hide it. */
  damageHref: (product: ExpiryProduct) => string | null;
}) {
  const isMobile = useIsMobile();
  const { data, isLoading, isError, error, refetch } = query;
  const products = (data?.products ?? []) as ExpiryProduct[];
  const alertDayOptions = data?.alertDayOptions ?? [5, 7, 10, 15, 20, 30];

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState(ALL);
  const [subCategoryFilter, setSubCategoryFilter] = useState(ALL);

  const categoryOptions = useMemo(
    () => uniqueOptions(products.map((p) => option(p.categoryId, p.categoryName))),
    [products],
  );
  const subCategoryOptions = useMemo(
    () =>
      uniqueOptions(
        products
          .filter(
            (p) =>
              categoryFilter === ALL || String(p.categoryId) === categoryFilter,
          )
          .map((p) => option(p.subCategoryId, p.subCategoryName)),
      ),
    [products, categoryFilter],
  );

  const rows = products.filter(
    (product) =>
      (categoryFilter === ALL || String(product.categoryId) === categoryFilter) &&
      (subCategoryFilter === ALL ||
        String(product.subCategoryId) === subCategoryFilter) &&
      matchesExpirySearch(product, search),
  );

  const hasFilters =
    search !== "" || categoryFilter !== ALL || subCategoryFilter !== ALL;
  const clearFilters = () => {
    setSearch("");
    setCategoryFilter(ALL);
    setSubCategoryFilter(ALL);
  };

  const count = (status: ExpiryProduct["status"]) =>
    products.filter((product) => product.status === status).length;

  return (
    <div className="@container/catalog min-w-0 space-y-4 md:space-y-5">
      <CatalogPageHeader
        title="Expired Products"
        description="Stock in batches that are past, or close to, their expiry date."
        stats={[
          { label: "Products", value: products.length },
          { label: "Expired", value: count("expired") },
          { label: "Expiring Soon", value: count("expiring") },
        ]}
      />

      <CatalogFilterPanel
        search={search}
        onSearchChange={setSearch}
        hasFilters={hasFilters}
        onClear={clearFilters}
        searchPlaceholder="Search product, Product ID or batch..."
        gridClassName="grid-cols-2"
      >
        <FilterSelect
          compact={isMobile}
          label="Category"
          value={categoryFilter}
          options={categoryOptions}
          onValueChange={(value) => {
            setCategoryFilter(value);
            setSubCategoryFilter(ALL);
          }}
        />
        <FilterSelect
          compact={isMobile}
          label="Sub Category"
          value={subCategoryFilter}
          options={subCategoryOptions}
          onValueChange={setSubCategoryFilter}
        />
      </CatalogFilterPanel>

      <ExpiryTable
        rows={rows}
        alertDayOptions={alertDayOptions}
        onSaveAlertDays={onSaveAlertDays}
        damageHref={damageHref}
        isMobile={isMobile}
        isLoading={isLoading}
        isError={isError}
        errorMessage={error?.message}
        onRetry={() => refetch()}
        emptyTitle={products.length === 0 ? "Nothing is expiring" : "No product found"}
        emptyDescription={
          products.length === 0
            ? "Products with expiry tracking show here when a batch is past, or close to, its expiry date."
            : "No product matches these filters."
        }
      />
    </div>
  );
}

function ExpiryTable({
  rows,
  alertDayOptions,
  onSaveAlertDays,
  damageHref,
  isMobile,
  isLoading,
  isError,
  errorMessage,
  onRetry,
  emptyTitle,
  emptyDescription,
}: {
  rows: ExpiryProduct[];
  alertDayOptions: number[];
  onSaveAlertDays: SaveExpiryAlertDays;
  damageHref: (product: ExpiryProduct) => string | null;
  isMobile: boolean;
  isLoading: boolean;
  isError: boolean;
  errorMessage?: string;
  onRetry: () => void;
  emptyTitle: string;
  emptyDescription: string;
}) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const toggle = (productId: number) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  const thisYear = new Date().getFullYear();

  return (
    <section
      aria-label="Expired products"
      className="overflow-hidden rounded-xl border bg-card shadow-sm"
    >
      <Table
        className={isMobile ? "table-fixed text-[11px] leading-4" : "min-w-[720px]"}
      >
        <caption className="sr-only">Expired and expiring products</caption>
        {isMobile ? (
          <colgroup>
            <col className="w-[22%]" />
            <col className="w-[30%]" />
            <col className="w-[18%]" />
            <col className="w-[18%]" />
            <col className="w-[12%]" />
          </colgroup>
        ) : null}
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead scope="col" className={isMobile ? "px-2" : "w-36"}>
              Product ID
            </TableHead>
            <TableHead scope="col" className={isMobile ? "px-1" : undefined}>
              Product Name
            </TableHead>
            <TableHead scope="col" className={isMobile ? "px-1" : undefined}>
              {isMobile ? "Qty" : "Expired Qty"}
            </TableHead>
            <TableHead scope="col" className={isMobile ? "px-1" : undefined}>
              {isMobile ? "Expiry" : "Last Expiry"}
            </TableHead>
            <TableHead
              scope="col"
              className={isMobile ? "px-1 text-center" : "w-40 text-right"}
            >
              {isMobile ? <span className="sr-only">Action</span> : "Action"}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <StatusRow>
              <span className="inline-flex items-center gap-2 text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Loading batches…
              </span>
            </StatusRow>
          ) : isError ? (
            <StatusRow>
              <div className="space-y-3">
                <div>
                  <p className="font-medium">Could not load expired products</p>
                  <p className="text-sm text-muted-foreground">
                    {errorMessage || "Please try again."}
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={onRetry}>
                  Try again
                </Button>
              </div>
            </StatusRow>
          ) : rows.length === 0 ? (
            <StatusRow tall>
              <div className="flex flex-col items-center">
                <PackageSearch className="size-8 text-muted-foreground" />
                <p className="mt-3 font-medium">{emptyTitle}</p>
                <p className="mt-1 max-w-md text-sm text-muted-foreground">
                  {emptyDescription}
                </p>
              </div>
            </StatusRow>
          ) : (
            rows.map((product) => {
              const open = expanded.has(product.productId);
              const detailId = `expiry-detail-${product.productId}`;
              return (
                <Fragment key={product.productId}>
                  <TableRow
                    onClick={(event) => {
                      if (
                        !(event.target as HTMLElement).closest(
                          "a, button, input, [role=combobox]",
                        )
                      ) {
                        toggle(product.productId);
                      }
                    }}
                    data-state={open ? "selected" : undefined}
                    className="cursor-pointer"
                  >
                    <TableCell
                      className={
                        isMobile
                          ? "px-2 py-2.5 font-medium tabular-nums"
                          : "font-medium tabular-nums"
                      }
                    >
                      <div className="truncate" title={expiryProductId(product)}>
                        {expiryProductId(product)}
                      </div>
                    </TableCell>
                    <TableCell className={isMobile ? "px-1" : undefined}>
                      <div className="truncate font-medium" title={product.name}>
                        {product.name}
                      </div>
                    </TableCell>
                    <TableCell
                      className={
                        isMobile
                          ? "whitespace-normal break-words px-1 tabular-nums"
                          : "tabular-nums"
                      }
                    >
                      {formatQuantities(product.flaggedQty)}
                    </TableCell>
                    <TableCell
                      className={
                        isMobile ? "px-1 tabular-nums" : "tabular-nums"
                      }
                    >
                      {formatExpiryDate(product.lastExpiry, thisYear)}
                    </TableCell>
                    <TableCell className={isMobile ? "px-1" : undefined}>
                      <div
                        className={
                          isMobile
                            ? "flex items-center justify-center gap-0.5"
                            : "flex items-center justify-end gap-2"
                        }
                      >
                        <ExpiryStatusIcon status={product.status} />
                        <Button
                          type="button"
                          size="sm"
                          variant={isMobile ? "ghost" : "outline"}
                          className={isMobile ? "size-7 p-0" : undefined}
                          aria-expanded={open}
                          aria-controls={detailId}
                          aria-label={
                            isMobile
                              ? `${open ? "Hide" : "View"} ${product.name} batches`
                              : undefined
                          }
                          onClick={() => toggle(product.productId)}
                        >
                          {isMobile ? null : open ? "Hide" : "View"}
                          <ChevronDown
                            aria-hidden="true"
                            className={`size-4 transition-transform ${
                              open ? "rotate-180" : ""
                            }`}
                          />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                  {open ? (
                    <TableRow id={detailId} className="hover:bg-transparent">
                      <TableCell
                        colSpan={5}
                        className="whitespace-normal border-l-2 border-primary/60 bg-muted/30 p-0"
                      >
                        <ExpiryRowDetail
                          product={product}
                          alertDayOptions={alertDayOptions}
                          onSaveAlertDays={onSaveAlertDays}
                          damageHref={damageHref(product)}
                        />
                      </TableCell>
                    </TableRow>
                  ) : null}
                </Fragment>
              );
            })
          )}
        </TableBody>
      </Table>
    </section>
  );
}

function StatusRow({
  tall = false,
  children,
}: {
  tall?: boolean;
  children: ReactNode;
}) {
  return (
    <TableRow>
      <TableCell
        colSpan={5}
        className={`${tall ? "h-52" : "h-36"} whitespace-normal text-center`}
      >
        {children}
      </TableCell>
    </TableRow>
  );
}
