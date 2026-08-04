"use client";

import {
  AlertTriangle,
  ArrowLeft,
  Box,
  CheckCircle2,
  CircleOff,
  Edit3,
  PackagePlus,
  Settings2,
  SlidersHorizontal,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RichTextContent } from "@/components/ui/rich-text-content";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useShopProductDetail } from "@/hooks/use-shop-products-api";

type ProductDetail = NonNullable<
  ReturnType<typeof useShopProductDetail>["data"]
>;
type ProductVariant = ProductDetail["variants"][number];
type QuantityGroup = ProductDetail["summary"]["quantityGroups"][number];
type ProductStatus = ProductDetail["summary"]["aggregateStatus"];

const numberFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 2,
});
const currencyFormatter = new Intl.NumberFormat("en-BD", {
  style: "currency",
  currency: "BDT",
  maximumFractionDigits: 2,
});

function formatNumber(value: number) {
  return numberFormatter.format(value);
}

function formatUnit(unit: string, quantity: number) {
  const label = unit.toLowerCase();
  if (
    quantity === 1 ||
    ["kg", "g", "gram", "l", "ml"].includes(label) ||
    label.endsWith("s")
  ) {
    return label;
  }
  return label.endsWith("x") ? `${label}es` : `${label}s`;
}

function formatQuantity(quantity: number, unit: string | null) {
  const resolvedUnit = unit ?? "unit";
  return `${formatNumber(quantity)} ${formatUnit(resolvedUnit, quantity)}`;
}

function ProductStatusBadge({ status }: { status: ProductStatus }) {
  const content = {
    in_stock: {
      label: "In stock",
      icon: CheckCircle2,
      className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    },
    attention: {
      label: "Needs attention",
      icon: AlertTriangle,
      className: "border-amber-200 bg-amber-50 text-amber-800",
    },
    out_of_stock: {
      label: "Out of stock",
      icon: CircleOff,
      className: "border-red-200 bg-red-50 text-red-700",
    },
    setup_required: {
      label: "Setup required",
      icon: Settings2,
      className: "border-slate-300 bg-slate-100 text-slate-700",
    },
  }[status];
  const Icon = content.icon;

  return (
    <Badge variant="outline" className={`gap-1.5 ${content.className}`}>
      <Icon className="size-3" aria-hidden="true" />
      {content.label}
    </Badge>
  );
}

function VariantStatusBadge({ status }: { status: ProductVariant["status"] }) {
  const value = {
    in_stock: {
      label: "In stock",
      className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    },
    low_stock: {
      label: "Low stock",
      className: "border-amber-200 bg-amber-50 text-amber-800",
    },
    out_of_stock: {
      label: "Out of stock",
      className: "border-red-200 bg-red-50 text-red-700",
    },
  }[status];
  return (
    <Badge variant="outline" className={value.className}>
      {value.label}
    </Badge>
  );
}

export default function ShopProductDetailPage() {
  const params = useParams();
  const productId = Number(params.productId);
  const { data, isLoading, isError, refetch } = useShopProductDetail(
    Number.isNaN(productId) ? null : productId,
  );

  if (isLoading) return <DetailSkeleton />;

  if (isError || !data) {
    return (
      <main className="space-y-5">
        <BackButton />
        <section className="rounded-lg border bg-background px-6 py-14 text-center">
          <CircleOff
            className="mx-auto size-8 text-red-600"
            aria-hidden="true"
          />
          <h1 className="mt-3 text-base font-semibold">
            Product could not be loaded
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            It may not belong to this retailer or is no longer active.
          </p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => void refetch()}
          >
            Retry
          </Button>
        </section>
      </main>
    );
  }

  const { product, summary, variants } = data;

  return (
    <main className="space-y-5 pb-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <BackButton />
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/dashboard/stock-adjustment/create">
              <SlidersHorizontal className="size-4" aria-hidden="true" />
              Adjust stock
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/dashboard/stock/add">
              <PackagePlus className="size-4" aria-hidden="true" />
              Add stock
            </Link>
          </Button>
          {product.isRetailerOwned && (
            <Button size="sm" asChild>
              <Link href={`/dashboard/products/${product.id}/edit`}>
                <Edit3 className="size-4" aria-hidden="true" />
                Edit product
              </Link>
            </Button>
          )}
        </div>
      </div>

      <header className="rounded-lg border bg-background p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted/30 sm:size-24">
            {product.image ? (
              <Image
                src={product.image}
                alt=""
                width={96}
                height={96}
                className="size-full object-cover"
              />
            ) : (
              <Box
                className="size-7 text-muted-foreground"
                aria-hidden="true"
              />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                  {product.brand.name} ·{" "}
                  {product.category?.name ?? "Uncategorized"}
                </p>
                <h1 className="mt-1 text-xl font-semibold tracking-tight sm:text-2xl">
                  {product.name}
                </h1>
              </div>
              <ProductStatusBadge status={summary.aggregateStatus} />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span>
                {summary.variantCount} active variant
                {summary.variantCount === 1 ? "" : "s"}
              </span>
              {product.productTypeName && (
                <span>{product.productTypeName}</span>
              )}
              {product.coreProduct?.sku && (
                <span className="font-mono tabular-nums">
                  {product.coreProduct.sku}
                </span>
              )}
            </div>
            {product.description && (
              <RichTextContent
                content={product.description}
                className="mt-3 max-w-3xl"
              />
            )}
          </div>
        </div>
      </header>

      {summary.configurationIssueCount > 0 && (
        <section
          className="flex items-start gap-3 rounded-lg border border-slate-300 bg-slate-50 p-4"
          aria-label="Variant setup notice"
        >
          <Settings2
            className="mt-0.5 size-4 shrink-0 text-slate-700"
            aria-hidden="true"
          />
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Admin variant setup required
            </h2>
            <p className="mt-0.5 text-sm text-slate-600">
              {summary.configurationIssueCount} active variant
              {summary.configurationIssueCount === 1 ? " is" : "s are"} missing
              a valid Admin definition. Existing stock is retained and shown
              without a guessed unit.
            </p>
          </div>
        </section>
      )}

      <section
        className="overflow-hidden rounded-lg border bg-background"
        aria-labelledby="stock-balance-heading"
      >
        <div className="border-b px-4 py-3 sm:px-5">
          <h2 id="stock-balance-heading" className="text-sm font-semibold">
            Stock balance
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Compatible units are grouped. Different inventory units are never
            added together.
          </p>
        </div>
        {summary.quantityGroups.length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted-foreground">
            No unit-safe totals are available until the variant setup is
            complete.
          </p>
        ) : (
          <div className="divide-y">
            {summary.quantityGroups.map((group) => (
              <QuantityBalanceRow
                key={`${group.family}:${group.inventoryUnit}:${group.referenceMeasurement?.unit ?? "none"}`}
                group={group}
              />
            ))}
          </div>
        )}
      </section>

      <section
        className="overflow-hidden rounded-lg border bg-background"
        aria-labelledby="variant-stock-heading"
      >
        <div className="border-b px-4 py-3 sm:px-5">
          <h2 id="variant-stock-heading" className="text-sm font-semibold">
            Exact variants
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Canonical labels, prices, thresholds, and operational quantities.
          </p>
        </div>
        <div className="hidden overflow-x-auto md:block">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead>Variant / SKU</TableHead>
                <TableHead className="text-right">Available</TableHead>
                <TableHead className="text-right">Reserved</TableHead>
                <TableHead className="text-right">On hand</TableHead>
                <TableHead className="text-right">Retail price</TableHead>
                <TableHead>Empty return</TableHead>
                <TableHead>Threshold</TableHead>
                <TableHead className="text-right">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {variants.map((variant) => (
                <VariantRow key={variant.variantId} variant={variant} />
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="divide-y md:hidden">
          {variants.map((variant) => (
            <VariantMobileRow key={variant.variantId} variant={variant} />
          ))}
        </div>
      </section>

      <section
        className="overflow-hidden rounded-lg border bg-background"
        aria-labelledby="settings-heading"
      >
        <div className="border-b px-4 py-3 sm:px-5">
          <h2 id="settings-heading" className="text-sm font-semibold">
            Product settings
          </h2>
        </div>
        <dl className="grid sm:grid-cols-2 lg:grid-cols-4 lg:divide-x">
          <SettingItem
            label="Empty return config"
            value={`${variants.filter((variant) => variant.exchangeEnabled).length} variant${variants.filter((variant) => variant.exchangeEnabled).length === 1 ? "" : "s"} enabled`}
          />
          <SettingItem
            label="Expiry tracking"
            value={product.expiryEnabled ? "Enabled" : "Disabled"}
          />
          <SettingItem
            label="Damage control"
            value={product.damageControlEnabled ? "Enabled" : "Disabled"}
          />
          <SettingItem
            label="Tracking"
            value={
              product.trackingType === "none" ? "None" : product.trackingType
            }
          />
        </dl>
      </section>
    </main>
  );
}

function BackButton() {
  return (
    <Button
      variant="ghost"
      size="sm"
      asChild
      className="w-fit text-muted-foreground"
    >
      <Link href="/dashboard/products">
        <ArrowLeft className="size-4" aria-hidden="true" />
        Back to products
      </Link>
    </Button>
  );
}

function QuantityBalanceRow({ group }: { group: QuantityGroup }) {
  return (
    <div className="grid gap-4 px-4 py-4 sm:grid-cols-[minmax(160px,1.2fr)_repeat(3,minmax(110px,1fr))] sm:px-5">
      <div>
        <p className="text-sm font-medium">{group.familyLabel}</p>
        <p className="text-xs text-muted-foreground">
          Operational unit: {group.inventoryUnit.toLowerCase()}
        </p>
      </div>
      <BalanceMetric
        label="Available"
        value={group.available}
        unit={group.inventoryUnit}
      />
      <BalanceMetric
        label="Reserved"
        value={group.reserved}
        unit={group.inventoryUnit}
      />
      <BalanceMetric
        label="On hand"
        value={group.onHand}
        unit={group.inventoryUnit}
      />
      {group.referenceMeasurement && (
        <p className="text-xs text-muted-foreground sm:col-start-2 sm:col-span-3">
          Reference: {formatNumber(group.referenceMeasurement.available)}{" "}
          {group.referenceMeasurement.unit} available,{" "}
          {formatNumber(group.referenceMeasurement.onHand)}{" "}
          {group.referenceMeasurement.unit} on hand
        </p>
      )}
    </div>
  );
}

function BalanceMetric({
  label,
  value,
  unit,
}: {
  label: string;
  value: number;
  unit: string;
}) {
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 font-mono text-sm font-semibold tabular-nums">
        {formatQuantity(value, unit)}
      </p>
    </div>
  );
}

function VariantRow({ variant }: { variant: ProductVariant }) {
  const invalid = variant.configurationState === "needs_admin_variant_setup";
  return (
    <TableRow>
      <TableCell>
        <p className="text-sm font-medium">
          {variant.canonicalLabel ?? "Admin setup required"}
        </p>
        {variant.displayAlias &&
          variant.displayAlias !== variant.canonicalLabel && (
            <p className="text-xs text-muted-foreground">
              Alias: {variant.displayAlias}
            </p>
          )}
        <p className="font-mono text-[11px] tabular-nums text-muted-foreground">
          {variant.sku ?? "No SKU"}
        </p>
      </TableCell>
      {invalid ? (
        <>
          <UnlabelledQuantityCell value={variant.available} />
          <UnlabelledQuantityCell value={variant.reserved} muted />
          <UnlabelledQuantityCell value={variant.onHand} />
          <TableCell className="text-right font-mono text-sm tabular-nums">
            {variant.retailPrice === null
              ? "Not set"
              : currencyFormatter.format(variant.retailPrice)}
          </TableCell>
          <ExchangeCell variant={variant} />
          <TableCell className="text-xs text-muted-foreground">
            Admin setup required
          </TableCell>
        </>
      ) : (
        <>
          <QuantityCell
            value={variant.available}
            unit={variant.inventoryUnit}
          />
          <QuantityCell
            value={variant.reserved}
            unit={variant.inventoryUnit}
            muted
          />
          <QuantityCell value={variant.onHand} unit={variant.inventoryUnit} />
          <TableCell className="text-right font-mono text-sm tabular-nums">
            {variant.retailPrice === null
              ? "Not set"
              : currencyFormatter.format(variant.retailPrice)}
          </TableCell>
          <ExchangeCell variant={variant} />
          <TableCell>
            <p className="text-xs text-muted-foreground">
              {variant.reorderLevel === null
                ? "Not configured"
                : formatQuantity(variant.reorderLevel, variant.inventoryUnit)}
            </p>
            {variant.thresholdSource && (
              <p className="text-[11px] capitalize text-muted-foreground">
                {variant.thresholdSource} level
              </p>
            )}
          </TableCell>
        </>
      )}
      <TableCell className="text-right">
        {invalid ? (
          <Badge
            variant="outline"
            className="border-slate-300 bg-slate-100 text-slate-700"
          >
            Setup required
          </Badge>
        ) : (
          <VariantStatusBadge status={variant.status} />
        )}
      </TableCell>
    </TableRow>
  );
}

function ExchangeCell({ variant }: { variant: ProductVariant }) {
  return (
    <TableCell>
      {variant.exchangeEnabled ? (
        <div>
          <Badge
            variant="outline"
            className="border-emerald-200 bg-emerald-50 text-emerald-700"
          >
            Exchange + New
          </Badge>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {currencyFormatter.format(variant.exchangeCreditAmount)} credit
          </p>
        </div>
      ) : (
        <span className="text-xs text-muted-foreground">New only</span>
      )}
    </TableCell>
  );
}

function QuantityCell({
  value,
  unit,
  muted = false,
}: {
  value: number;
  unit: string | null;
  muted?: boolean;
}) {
  return (
    <TableCell
      className={`text-right font-mono text-sm tabular-nums ${muted ? "text-muted-foreground" : ""}`}
    >
      {formatQuantity(value, unit)}
    </TableCell>
  );
}

function UnlabelledQuantityCell({
  value,
  muted = false,
}: {
  value: number;
  muted?: boolean;
}) {
  return (
    <TableCell
      className={`text-right font-mono text-sm tabular-nums ${muted ? "text-muted-foreground" : ""}`}
    >
      {formatNumber(value)} <span className="text-[10px]">unlabelled</span>
    </TableCell>
  );
}

function VariantMobileRow({ variant }: { variant: ProductVariant }) {
  const invalid = variant.configurationState === "needs_admin_variant_setup";
  return (
    <article className="space-y-4 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium">
            {variant.canonicalLabel ?? "Admin setup required"}
          </h3>
          <p className="font-mono text-[11px] tabular-nums text-muted-foreground">
            {variant.sku ?? "No SKU"}
          </p>
        </div>
        {invalid ? (
          <Badge
            variant="outline"
            className="border-slate-300 bg-slate-100 text-slate-700"
          >
            Setup required
          </Badge>
        ) : (
          <VariantStatusBadge status={variant.status} />
        )}
      </div>
      {invalid ? (
        <dl className="grid grid-cols-3 gap-3 rounded-md bg-muted/30 p-3">
          <MobileMetric
            label="Available"
            value={`${formatNumber(variant.available)} unlabelled`}
          />
          <MobileMetric
            label="Reserved"
            value={`${formatNumber(variant.reserved)} unlabelled`}
          />
          <MobileMetric
            label="On hand"
            value={`${formatNumber(variant.onHand)} unlabelled`}
          />
        </dl>
      ) : (
        <>
          <dl className="grid grid-cols-3 gap-3 rounded-md bg-muted/30 p-3">
            <MobileMetric
              label="Available"
              value={formatQuantity(variant.available, variant.inventoryUnit)}
            />
            <MobileMetric
              label="Reserved"
              value={formatQuantity(variant.reserved, variant.inventoryUnit)}
            />
            <MobileMetric
              label="On hand"
              value={formatQuantity(variant.onHand, variant.inventoryUnit)}
            />
          </dl>
          <dl className="grid grid-cols-2 gap-3 text-xs">
            <MobileMetric
              label="Retail price"
              value={
                variant.retailPrice === null
                  ? "Not set"
                  : currencyFormatter.format(variant.retailPrice)
              }
            />
            <MobileMetric
              label="Reorder level"
              value={
                variant.reorderLevel === null
                  ? "Not configured"
                  : formatQuantity(variant.reorderLevel, variant.inventoryUnit)
              }
            />
            <MobileMetric
              label="Cylinder sale"
              value={
                variant.exchangeEnabled
                  ? `Exchange + New · ${currencyFormatter.format(variant.exchangeCreditAmount)} credit`
                  : "New only"
              }
            />
          </dl>
        </>
      )}
    </article>
  );
}

function MobileMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 font-mono text-xs font-medium tabular-nums">
        {value}
      </dd>
    </div>
  );
}

function SettingItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b px-4 py-3 last:border-b-0 sm:px-5 lg:border-b-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium capitalize">{value}</dd>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <main className="space-y-5">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-36" />
        <Skeleton className="h-8 w-64" />
      </div>
      <div className="flex gap-4 rounded-lg border p-5">
        <Skeleton className="size-24 rounded-lg" />
        <div className="flex-1 space-y-3">
          <Skeleton className="h-3 w-44" />
          <Skeleton className="h-7 w-72" />
          <Skeleton className="h-4 w-56" />
        </div>
      </div>
      <div className="overflow-hidden rounded-lg border">
        <div className="border-b p-4">
          <Skeleton className="h-4 w-36" />
        </div>
        {Array.from({ length: 2 }).map((_, index) => (
          <div
            key={index}
            className="grid grid-cols-4 gap-5 border-b p-5 last:border-b-0"
          >
            {Array.from({ length: 4 }).map((__, metricIndex) => (
              <Skeleton key={metricIndex} className="h-8 w-full" />
            ))}
          </div>
        ))}
      </div>
      <div className="overflow-hidden rounded-lg border">
        <div className="border-b p-4">
          <Skeleton className="h-4 w-32" />
        </div>
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="flex gap-4 border-b p-4 last:border-b-0">
            <Skeleton className="h-8 flex-1" />
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-8 w-24" />
          </div>
        ))}
      </div>
    </main>
  );
}
