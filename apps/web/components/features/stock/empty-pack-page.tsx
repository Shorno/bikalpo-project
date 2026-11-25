"use client";

import { useQuery } from "@tanstack/react-query";
import { ChevronDown, Loader2, PackageOpen, PackageSearch } from "lucide-react";
import { Fragment, type ReactNode, useMemo, useState } from "react";
import { CatalogFilterPanel } from "@/components/features/product/components/catalog-layout";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useIsMobile } from "@/hooks/use-mobile";
import { orpc } from "@/utils/orpc";
import {
  ALL,
  type EmptyPackProduct,
  emptyPackProductId,
  filterEmptyPacks,
  type InMarketOrder,
} from "./empty-pack-model";

type Option = { id: number | string; name: string };

function uniqueOptions(items: Array<Option | null>) {
  const options = new Map<number | string, string>();
  for (const item of items) if (item) options.set(item.id, item.name);
  return Array.from(options, ([id, name]) => ({ id, name })).sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { numeric: true }),
  );
}

const option = (id: number | null, name: string | null) =>
  id != null && name ? { id, name } : null;

/**
 * Empty Pack Management (client, 2026-11-25): each returnable-pack
 * product with its sizes, the Total and what is In Market (empties still
 * owed on Exchange sales). Retailer and warehouse share it.
 */
export function EmptyPackPage() {
  const isMobile = useIsMobile();
  const query = useQuery(
    orpc.emptyPackManagement.getSummary.queryOptions({ staleTime: 1000 * 60 }),
  );
  const products = (query.data?.products ?? []) as EmptyPackProduct[];

  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState(ALL);
  const [subCategoryId, setSubCategoryId] = useState(ALL);
  const [variant, setVariant] = useState(ALL);

  const categoryOptions = useMemo(
    () => uniqueOptions(products.map((p) => option(p.categoryId, p.categoryName))),
    [products],
  );
  const subCategoryOptions = useMemo(
    () =>
      uniqueOptions(
        products
          .filter((p) => categoryId === ALL || String(p.categoryId) === categoryId)
          .map((p) => option(p.subCategoryId, p.subCategoryName)),
      ),
    [products, categoryId],
  );
  const variantOptions = useMemo(
    () =>
      uniqueOptions(
        products.flatMap((p) => p.variants.map((v) => ({ id: v.label, name: v.label }))),
      ),
    [products],
  );

  const rows = filterEmptyPacks(products, {
    search,
    categoryId,
    subCategoryId,
    variant,
  });
  const hasFilters =
    search !== "" || categoryId !== ALL || subCategoryId !== ALL || variant !== ALL;

  return (
    <TooltipProvider>
      <div className="@container/catalog min-w-0 space-y-4 md:space-y-5">
        <header className="flex items-center gap-3 rounded-xl border bg-card p-5 shadow-sm max-md:p-4">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-inset ring-primary/15">
            <PackageOpen aria-hidden="true" className="size-5" />
          </span>
          <h1 className="text-lg font-semibold tracking-tight">
            Empty Pack Management
          </h1>
        </header>

        <CatalogFilterPanel
          search={search}
          onSearchChange={setSearch}
          hasFilters={hasFilters}
          onClear={() => {
            setSearch("");
            setCategoryId(ALL);
            setSubCategoryId(ALL);
            setVariant(ALL);
          }}
          searchPlaceholder="Search by product, Product ID or order..."
        >
          <FilterSelect
            compact={isMobile}
            label="Category"
            value={categoryId}
            options={categoryOptions}
            onValueChange={(value) => {
              setCategoryId(value);
              setSubCategoryId(ALL);
            }}
          />
          <FilterSelect
            compact={isMobile}
            label="Sub Category"
            value={subCategoryId}
            options={subCategoryOptions}
            onValueChange={setSubCategoryId}
          />
          <FilterSelect
            compact={isMobile}
            label="Variant"
            value={variant}
            options={variantOptions}
            onValueChange={setVariant}
          />
        </CatalogFilterPanel>

        <section
          aria-labelledby="empty-pack-list"
          className="overflow-hidden rounded-xl border bg-card shadow-sm"
        >
          <h2 id="empty-pack-list" className="border-b px-4 py-3 text-[15px] font-semibold">
            Empty Pack List
          </h2>
          <Table className="min-w-[640px]">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead scope="col" className="w-36">ID</TableHead>
                <TableHead scope="col">Name</TableHead>
                <TableHead scope="col">Variant</TableHead>
                <TableHead scope="col" className="text-right">Total</TableHead>
                <TableHead scope="col" className="w-32 text-right">In Market</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {query.isLoading ? (
                <StatusRow>
                  <span className="inline-flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" />
                    Loading empty packs…
                  </span>
                </StatusRow>
              ) : query.isError ? (
                <StatusRow>
                  <p className="font-medium">Could not load empty packs</p>
                  <p className="text-sm text-muted-foreground">
                    {query.error?.message || "Please try again."}
                  </p>
                  <Button
                    className="mt-3"
                    variant="outline"
                    size="sm"
                    onClick={() => query.refetch()}
                  >
                    Try again
                  </Button>
                </StatusRow>
              ) : rows.length === 0 ? (
                <StatusRow>
                  <PackageSearch className="mx-auto size-8 text-muted-foreground" />
                  <p className="mt-3 font-medium">
                    {products.length === 0 ? "No empty packs yet" : "No product found"}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {products.length === 0
                      ? "Returnable-pack products such as LPG cylinders show here."
                      : "No product matches these filters."}
                  </p>
                </StatusRow>
              ) : (
                rows.map((product) => (
                  <ProductRows key={product.productId} product={product} />
                ))
              )}
            </TableBody>
          </Table>
        </section>
      </div>
    </TooltipProvider>
  );
}

function ProductRows({ product }: { product: EmptyPackProduct }) {
  const [open, setOpen] = useState(false);
  const single = product.variants.length === 1 ? product.variants[0]! : null;
  const sizesId = `empty-pack-sizes-${product.productId}`;

  return (
    <Fragment>
      <TableRow
        onClick={
          single
            ? undefined
            : (event) => {
                if (!(event.target as HTMLElement).closest("button")) {
                  setOpen((value) => !value);
                }
              }
        }
        data-state={open ? "selected" : undefined}
        className={single ? undefined : "cursor-pointer"}
      >
        <TableCell className="font-medium tabular-nums">
          {emptyPackProductId(product)}
        </TableCell>
        <TableCell>
          <span className="inline-flex items-center gap-1.5 font-medium">
            {product.name}
            {single ? null : (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-6"
                aria-expanded={open}
                aria-controls={sizesId}
                aria-label={`${open ? "Hide" : "Show"} ${product.name} sizes`}
                onClick={() => setOpen((value) => !value)}
              >
                <ChevronDown
                  aria-hidden="true"
                  className={`size-4 transition-transform ${open ? "rotate-180" : ""}`}
                />
              </Button>
            )}
          </span>
        </TableCell>
        <TableCell className="text-muted-foreground">
          {single ? <span className="text-foreground">{single.label}</span> : "—"}
        </TableCell>
        <TableCell className="text-right font-semibold tabular-nums">
          {product.totalQty.toLocaleString("en-BD")}
        </TableCell>
        <TableCell className="text-right">
          <InMarket quantity={product.inMarketQty} orders={product.inMarketOrders} />
        </TableCell>
      </TableRow>
      {open && !single
        ? product.variants.map((variant, index) => (
            <TableRow
              key={variant.variantId}
              id={index === 0 ? sizesId : undefined}
              className="bg-muted/30 hover:bg-muted/40"
            >
              <TableCell />
              <TableCell />
              <TableCell>{variant.label}</TableCell>
              <TableCell className="text-right tabular-nums">
                {variant.totalQty.toLocaleString("en-BD")}
              </TableCell>
              <TableCell className="text-right">
                <InMarket quantity={variant.inMarketQty} orders={variant.inMarketOrders} />
              </TableCell>
            </TableRow>
          ))
        : null}
    </Fragment>
  );
}

/** The In Market count; hovering it lists the orders still owing empties. */
function InMarket({
  quantity,
  orders,
}: {
  quantity: number;
  orders: InMarketOrder[];
}) {
  const text = quantity.toLocaleString("en-BD");
  if (orders.length === 0) {
    return <span className="tabular-nums text-muted-foreground">{text}</span>;
  }
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="cursor-help font-semibold tabular-nums text-amber-700 underline decoration-dotted underline-offset-4 dark:text-amber-400"
        >
          {text}
        </button>
      </TooltipTrigger>
      <TooltipContent side="left" className="max-w-64">
        <p className="mb-1 font-medium">Order ID</p>
        <ul className="space-y-0.5">
          {orders.map((entry) => (
            <li key={entry.orderNumber} className="flex justify-between gap-4 tabular-nums">
              <span>{entry.orderNumber}</span>
              <span>{entry.quantity}</span>
            </li>
          ))}
        </ul>
      </TooltipContent>
    </Tooltip>
  );
}

function StatusRow({ children }: { children: ReactNode }) {
  return (
    <TableRow>
      <TableCell colSpan={5} className="h-40 whitespace-normal text-center">
        {children}
      </TableCell>
    </TableRow>
  );
}
