"use client";

import { ArrowLeft, Loader2, PackageSearch } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  formatBreakdown,
  formatQuantity,
  formatVariantStock,
  productIdLabel,
  type RealtimeStockProduct,
} from "@/components/features/stock/realtime-stock-model";
import {
  StockStatusBadge,
  StockStatusIcon,
} from "@/components/features/stock/stock-status-icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  useRealtimeStockProduct,
  useSetProductLowStockLevel,
} from "@/hooks/use-shop-owner-api";

const LIST_HREF = "/dashboard/stock/live";

export default function StockProductPage() {
  const params = useParams<{ productId: string }>();
  const productId = Number(params.productId);
  const { data, isLoading, isError, error, refetch } =
    useRealtimeStockProduct(productId);
  const product = data?.product as RealtimeStockProduct | undefined;

  return (
    <div className="mx-auto min-w-0 max-w-4xl space-y-4 md:space-y-5">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href={LIST_HREF}>
          <ArrowLeft className="size-4" />
          Real-time Stock
        </Link>
      </Button>

      {isLoading ? (
        <Panel>
          <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading stock…
          </span>
        </Panel>
      ) : isError || !product ? (
        <Panel>
          <PackageSearch className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-3 font-medium">Stock not found</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {error?.message || "This product has no stock in your shop."}
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={() => refetch()}
          >
            Try again
          </Button>
        </Panel>
      ) : (
        <>
          <Summary product={product} />
          <LowStockLimit
            product={product}
            defaultLevel={data?.defaultLowStockLevel ?? 5}
          />
          <VariantTable product={product} />
        </>
      )}
    </div>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-card px-4 py-14 text-center shadow-sm">
      {children}
    </div>
  );
}

function Summary({ product }: { product: RealtimeStockProduct }) {
  return (
    <header className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <div className="flex items-start justify-between gap-3 p-5 max-md:p-4">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold tracking-tight max-md:text-base">
            {product.name}
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Product ID{" "}
            <span className="font-medium tabular-nums text-foreground">
              {productIdLabel(product)}
            </span>
            {product.categoryName ? ` · ${product.categoryName}` : ""}
            {product.subCategoryName ? ` · ${product.subCategoryName}` : ""}
          </p>
        </div>
        <StockStatusBadge status={product.status} />
      </div>
      <dl className="grid grid-cols-3 divide-x border-t bg-muted/30">
        <Stat label="Total Stock" value={formatBreakdown(product.breakdown)} />
        <Stat
          label="Empty"
          value={formatQuantity(product.breakdown.empty)}
        />
        <Stat
          label="Sold this month"
          value={formatQuantity(product.soldThisMonth)}
        />
      </dl>
      {product.expired ? (
        <p className="border-t bg-orange-50 px-5 py-2.5 text-sm text-orange-800 dark:bg-orange-950 dark:text-orange-200 max-md:px-4">
          Some of this product was marked expired in the last 30 days. Check
          the shelf before selling.
        </p>
      ) : null}
    </header>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-4 py-3.5 text-center max-md:px-2 max-md:py-2.5">
      <dd className="text-base font-semibold leading-snug tabular-nums max-md:text-sm">
        {value}
      </dd>
      <dt className="mt-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
    </div>
  );
}

function LowStockLimit({
  product,
  defaultLevel,
}: {
  product: RealtimeStockProduct;
  defaultLevel: number;
}) {
  const saved = product.lowStockLevel > 0 ? String(product.lowStockLevel) : "";
  const [value, setValue] = useState(saved);
  useEffect(() => setValue(saved), [saved]);
  const mutation = useSetProductLowStockLevel();

  const trimmed = value.trim();
  const level = trimmed === "" ? 0 : Number(trimmed);
  const invalid = !Number.isInteger(level) || level < 0 || level > 1_000_000;
  const unit =
    product.breakdown.counted[0]?.unit ??
    product.breakdown.loose[0]?.unit ??
    "units";

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (invalid) return;
    mutation.mutate(
      { productId: product.productId, lowStockLevel: level },
      {
        onSuccess: () => toast.success("Low stock limit saved"),
        onError: (err) => toast.error(err.message || "Could not save"),
      },
    );
  };

  return (
    <section
      aria-labelledby="low-stock-heading"
      className="rounded-xl border bg-card p-5 shadow-sm max-md:p-4"
    >
      <h2 id="low-stock-heading" className="font-semibold">
        Low stock limit
      </h2>
      <p className="mt-0.5 text-sm text-muted-foreground">
        When total stock is at or below this, the list shows{" "}
        <StockStatusIcon
          status="low_stock"
          className="inline size-4 align-text-bottom"
        />{" "}
        Low Stock. Leave empty to use {defaultLevel}.
      </p>
      <form
        onSubmit={onSubmit}
        className="mt-4 flex flex-wrap items-end gap-2"
      >
        <div className="space-y-1.5">
          <Label htmlFor="low-stock-level">Limit ({unit})</Label>
          <Input
            id="low-stock-level"
            inputMode="numeric"
            value={value}
            placeholder={String(defaultLevel)}
            onChange={(event) => setValue(event.target.value)}
            aria-invalid={invalid}
            className="h-10 w-36 tabular-nums"
          />
        </div>
        <Button
          type="submit"
          className="h-10"
          disabled={invalid || trimmed === saved || mutation.isPending}
        >
          {mutation.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : null}
          Save
        </Button>
        {invalid ? (
          <p className="w-full text-sm text-destructive">
            Enter a whole number, 0 or more.
          </p>
        ) : null}
      </form>
    </section>
  );
}

function VariantTable({ product }: { product: RealtimeStockProduct }) {
  const brands = new Set(product.variants.map((v) => v.brandName));
  const showBrand = brands.size > 1;

  return (
    <section
      aria-labelledby="variant-stock-heading"
      className="overflow-hidden rounded-xl border bg-card shadow-sm"
    >
      <h2
        id="variant-stock-heading"
        className="border-b px-5 py-3.5 font-semibold max-md:px-4"
      >
        Stock by size
      </h2>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead scope="col" className="pl-5 max-md:pl-4">
              Size
            </TableHead>
            <TableHead scope="col">Stock</TableHead>
            <TableHead scope="col" className="pr-5 text-right max-md:pr-4">
              Sold (this month)
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {product.variants.map((variant) => (
            <TableRow key={variant.variantId}>
              <TableCell className="pl-5 font-medium max-md:pl-4">
                {variant.label}
                {showBrand && variant.brandName ? (
                  <span className="block text-xs font-normal text-muted-foreground">
                    {variant.brandName}
                  </span>
                ) : null}
              </TableCell>
              <TableCell className="tabular-nums">
                {formatVariantStock(variant)}
                {variant.emptyQty > 0 ? (
                  <span className="text-muted-foreground">
                    {" "}
                    ({formatQuantity(variant.emptyQty)} Empty)
                  </span>
                ) : null}
              </TableCell>
              <TableCell className="pr-5 text-right tabular-nums max-md:pr-4">
                {formatQuantity(variant.soldThisMonth)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </section>
  );
}
