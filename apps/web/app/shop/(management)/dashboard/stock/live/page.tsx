"use client";

import { Eye, Loader2, PackagePlus, PackageSearch, ShoppingCart } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ReactNode, useMemo, useState } from "react";
import {
  CatalogActionBar,
  CatalogFilterPanel,
  CatalogPageHeader,
} from "@/components/features/product/components/catalog-layout";
import { FilterSelect } from "@/components/features/product/components/product-catalog-table";
import {
  formatBreakdown,
  matchesStockSearch,
  productIdLabel,
  type RealtimeStockProduct,
  STOCK_STATUS_LABELS,
  type StockStatus,
} from "@/components/features/stock/realtime-stock-model";
import { StockStatusIcon } from "@/components/features/stock/stock-status-icon";
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
import { useRealtimeStock } from "@/hooks/use-shop-owner-api";

const ALL = "all";
const STATUS_OPTIONS = (Object.keys(STOCK_STATUS_LABELS) as StockStatus[]).map(
  (status) => ({ id: status, name: STOCK_STATUS_LABELS[status] }),
);

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

/** "Expired" lists every product with expired stock, whatever else it is. */
function matchesStatus(product: RealtimeStockProduct, status: string) {
  if (status === ALL) return true;
  if (status === "expired") return product.expired;
  return product.status === status;
}

export default function StockLivePage() {
  const isMobile = useIsMobile();
  const { data, isLoading, isError, error, refetch } = useRealtimeStock();
  const products = (data?.products ?? []) as RealtimeStockProduct[];

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState(ALL);
  const [categoryFilter, setCategoryFilter] = useState(ALL);
  const [subCategoryFilter, setSubCategoryFilter] = useState(ALL);
  const [statusFilter, setStatusFilter] = useState(ALL);

  const inType = (product: RealtimeStockProduct) =>
    typeFilter === ALL || String(product.typeId) === typeFilter;
  const inCategory = (product: RealtimeStockProduct) =>
    categoryFilter === ALL || String(product.categoryId) === categoryFilter;

  const typeOptions = useMemo(
    () => uniqueOptions(products.map((p) => option(p.typeId, p.typeName))),
    [products],
  );
  const categoryOptions = useMemo(
    () =>
      uniqueOptions(
        products
          .filter(inType)
          .map((p) => option(p.categoryId, p.categoryName)),
      ),
    // biome-ignore lint/correctness/useExhaustiveDependencies: inType reads typeFilter
    [products, typeFilter],
  );
  const subCategoryOptions = useMemo(
    () =>
      uniqueOptions(
        products
          .filter((p) => inType(p) && inCategory(p))
          .map((p) => option(p.subCategoryId, p.subCategoryName)),
      ),
    // biome-ignore lint/correctness/useExhaustiveDependencies: filters read state
    [products, typeFilter, categoryFilter],
  );

  const rows = products.filter(
    (product) =>
      inType(product) &&
      inCategory(product) &&
      (subCategoryFilter === ALL ||
        String(product.subCategoryId) === subCategoryFilter) &&
      matchesStatus(product, statusFilter) &&
      matchesStockSearch(product, search),
  );

  const hasFilters =
    search !== "" ||
    [typeFilter, categoryFilter, subCategoryFilter, statusFilter].some(
      (value) => value !== ALL,
    );
  const clearFilters = () => {
    setSearch("");
    setTypeFilter(ALL);
    setCategoryFilter(ALL);
    setSubCategoryFilter(ALL);
    setStatusFilter(ALL);
  };

  const count = (status: StockStatus) =>
    products.filter((product) => product.status === status).length;

  return (
    <div className="@container/catalog min-w-0 space-y-4 md:space-y-5">
      <CatalogPageHeader
        title="Real-time Stock"
        description="Current stock of every product you hold, with empties and status."
        stats={[
          { label: "Products", value: products.length },
          { label: "Low Stock", value: count("low_stock") },
          { label: "Out of Stock", value: count("out_of_stock") },
        ]}
      />

      <CatalogFilterPanel
        search={search}
        onSearchChange={setSearch}
        hasFilters={hasFilters}
        onClear={clearFilters}
        searchPlaceholder="Search name, Product ID or scan code..."
        gridClassName="grid-cols-2 md:grid-cols-4"
      >
        <FilterSelect
          compact={isMobile}
          label="Type"
          value={typeFilter}
          options={typeOptions}
          onValueChange={(value) => {
            setTypeFilter(value);
            setCategoryFilter(ALL);
            setSubCategoryFilter(ALL);
          }}
        />
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
        <FilterSelect
          compact={isMobile}
          label="Status"
          value={statusFilter}
          options={STATUS_OPTIONS}
          onValueChange={setStatusFilter}
        />
      </CatalogFilterPanel>

      <CatalogActionBar>
        <Button asChild size="sm" className="max-md:min-h-11">
          <Link href="/dashboard/stock/add">
            <PackagePlus className="size-4" />
            Add Stock
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm" className="max-md:min-h-11">
          <Link href="/dashboard/orders">
            <ShoppingCart className="size-4" />
            Purchase
          </Link>
        </Button>
      </CatalogActionBar>

      <StockTable
        rows={rows}
        isMobile={isMobile}
        isLoading={isLoading}
        isError={isError}
        errorMessage={error?.message}
        onRetry={() => refetch()}
        emptyDescription={
          products.length === 0
            ? "Add stock to see your products here."
            : "No product matches these filters."
        }
      />
    </div>
  );
}

function StockTable({
  rows,
  isMobile,
  isLoading,
  isError,
  errorMessage,
  onRetry,
  emptyDescription,
}: {
  rows: RealtimeStockProduct[];
  isMobile: boolean;
  isLoading: boolean;
  isError: boolean;
  errorMessage?: string;
  onRetry: () => void;
  emptyDescription: string;
}) {
  const router = useRouter();
  const href = (product: RealtimeStockProduct) =>
    `/dashboard/stock/live/${product.productId}`;

  return (
    <section
      aria-label="Stock"
      className="overflow-hidden rounded-xl border bg-card shadow-sm"
    >
      <Table
        className={
          isMobile ? "table-fixed text-[11px] leading-4" : "min-w-[720px]"
        }
      >
        <caption className="sr-only">Real-time stock</caption>
        {isMobile ? (
          <colgroup>
            <col className="w-[24%]" />
            <col className="w-[34%]" />
            <col className="w-[30%]" />
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
              {isMobile ? "Stock" : "Stock Breakdown"}
            </TableHead>
            <TableHead
              scope="col"
              className={isMobile ? "px-1 text-center" : "w-40 text-right"}
            >
              {isMobile ? <span className="sr-only">Status</span> : "Action"}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <StatusRow>
              <span className="inline-flex items-center gap-2 text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Loading stock…
              </span>
            </StatusRow>
          ) : isError ? (
            <StatusRow>
              <div className="space-y-3">
                <div>
                  <p className="font-medium">Could not load stock</p>
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
                <p className="mt-3 font-medium">No stock found</p>
                <p className="mt-1 max-w-md text-sm text-muted-foreground">
                  {emptyDescription}
                </p>
              </div>
            </StatusRow>
          ) : (
            rows.map((product) => {
              const breakdown = formatBreakdown(product.breakdown);
              return (
                <TableRow
                  key={product.productId}
                  onClick={(event) => {
                    if (
                      isMobile &&
                      !(event.target as HTMLElement).closest("a, button")
                    ) {
                      router.push(href(product));
                    }
                  }}
                  className="max-md:cursor-pointer"
                >
                  <TableCell
                    className={
                      isMobile
                        ? "px-2 py-2.5 font-medium tabular-nums"
                        : "font-medium tabular-nums"
                    }
                  >
                    <div className="truncate" title={productIdLabel(product)}>
                      {productIdLabel(product)}
                    </div>
                  </TableCell>
                  <TableCell className={isMobile ? "px-1" : "font-medium"}>
                    {isMobile ? (
                      <Link
                        href={href(product)}
                        title={product.name}
                        className="block truncate font-medium text-primary underline-offset-2 hover:underline"
                      >
                        {product.name}
                      </Link>
                    ) : (
                      product.name
                    )}
                  </TableCell>
                  <TableCell
                    className={
                      isMobile
                        ? "whitespace-normal break-words px-1 tabular-nums"
                        : "tabular-nums"
                    }
                  >
                    {breakdown}
                  </TableCell>
                  <TableCell className={isMobile ? "px-1" : undefined}>
                    <div
                      className={
                        isMobile
                          ? "flex justify-center"
                          : "flex items-center justify-end gap-2"
                      }
                    >
                      <StockStatusIcon status={product.status} />
                      {isMobile ? null : (
                        <Button size="sm" variant="outline" asChild>
                          <Link href={href(product)}>
                            <Eye className="size-4" />
                            View
                          </Link>
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
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
        colSpan={4}
        className={`${tall ? "h-52" : "h-36"} whitespace-normal text-center`}
      >
        {children}
      </TableCell>
    </TableRow>
  );
}
