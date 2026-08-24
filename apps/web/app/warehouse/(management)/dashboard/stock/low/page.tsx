"use client";

import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowDownRight,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  Eye,
  Package,
  PackageOpen,
  Pencil,
  Search,
  ShoppingCart,
  Store,
  TriangleAlert,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { Fragment, useDeferredValue, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { orpc } from "@/utils/orpc";

const WH = "/warehouse/dashboard";
const THRESHOLD_OPTIONS = [10, 20, 30, 50];

type StockVariant = {
  productId: number;
  variantId: number;
  productName: string;
  brandName: string | null;
  sku: string | null;
  localSku: string | null;
  canonicalLabel: string | null;
  displayAlias: string | null;
  movementKind: "direct" | "loose" | "container" | null;
  inventoryUnit: string | null;
  available: number;
  reserved: number;
  onHand: number;
  referenceMeasurement?: {
    unit: "kg" | "liter";
    perInventoryUnit: number;
    available: number;
  };
  configurationState: "valid" | "needs_admin_variant_setup";
};

type LowStockProduct = {
  key: string;
  target: { kind: "core" | "product"; id: number };
  name: string;
  sku: string;
  image: string | null;
  productIds: number[];
  variantIds: number[];
  variants: StockVariant[];
  lowVariantCount: number;
  criticalVariantCount: number;
  orderCountLast30Days: number;
};

type LowStockData = {
  threshold: number;
  summary: { products: number; variants: number; critical: number };
  items: LowStockProduct[];
};

function formatNumber(value: number) {
  return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function formatUnit(unit: string | null, quantity = 2) {
  const normalized = String(unit || "unit").trim();
  if (!normalized) return "Unit";
  const lower = normalized.toLowerCase();
  if (["kg", "g", "l", "ml", "liter", "litre"].includes(lower)) {
    return normalized.toUpperCase();
  }
  if (quantity === 1) return normalized.replace(/s$/i, "");
  return normalized.endsWith("s") ? normalized : `${normalized}s`;
}

function getVariantName(variant: StockVariant) {
  return (
    variant.displayAlias ||
    variant.canonicalLabel ||
    variant.localSku ||
    variant.sku ||
    `Variant ${variant.variantId}`
  );
}

function getStockSegments(variants: StockVariant[]) {
  const totals = new Map<string, { quantity: number; unit: string }>();
  for (const variant of variants) {
    const unit = variant.inventoryUnit || "Unit";
    const key = unit.toLowerCase();
    const current = totals.get(key) ?? { quantity: 0, unit };
    current.quantity += variant.available;
    totals.set(key, current);
  }
  return Array.from(totals.values())
    .filter((item) => item.quantity !== 0)
    .sort((a, b) => b.quantity - a.quantity);
}

function CurrentStock({ variants }: { variants: StockVariant[] }) {
  const segments = getStockSegments(variants);
  if (segments.length === 0) {
    return <span className="font-semibold text-red-600">0 Units</span>;
  }
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
      {segments.map((segment, index) => (
        <span key={segment.unit} className="inline-flex items-center gap-2">
          {index > 0 && <span className="text-slate-300">+</span>}
          <span className="font-semibold tabular-nums text-slate-800">
            {formatNumber(segment.quantity)}{" "}
            {formatUnit(segment.unit, segment.quantity)}
          </span>
        </span>
      ))}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  note,
  tone,
}: {
  label: string;
  value: number;
  note: string;
  tone: "amber" | "red" | "slate";
}) {
  const styles = {
    amber: "border-amber-200 bg-amber-50 text-amber-950",
    red: "border-red-200 bg-red-50 text-red-950",
    slate: "border-slate-200 bg-white text-slate-950",
  };
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border p-4",
        styles[tone],
      )}
    >
      <div className="absolute -right-5 -top-5 h-16 w-16 rounded-full border border-current opacity-[0.08]" />
      <p className="text-[11px] font-bold uppercase tracking-[0.15em] opacity-60">
        {label}
      </p>
      <p className="mt-2 text-3xl font-black tabular-nums tracking-tight">
        {value}
      </p>
      <p className="mt-1 text-xs opacity-65">{note}</p>
    </div>
  );
}

function ProductDetail({
  product,
  defaultThreshold,
  variantThresholds,
  onThresholdChange,
}: {
  product: LowStockProduct;
  defaultThreshold: number;
  variantThresholds: Record<number, number>;
  onThresholdChange: (variantId: number, value: number) => void;
}) {
  const looseVariants = product.variants.filter(
    (variant) => variant.movementKind === "loose",
  );
  const packVariants = product.variants.filter(
    (variant) => variant.movementKind !== "loose",
  );
  const targetHref = `${WH}/stock/${product.target.kind}-${product.target.id}`;

  const variantTable = (variants: StockVariant[], emptyText: string) => {
    if (variants.length === 0) {
      return (
        <div className="border-t border-dashed border-slate-200 px-5 py-7 text-center text-sm text-slate-400">
          {emptyText}
        </div>
      );
    }
    return (
      <Table>
        <TableHeader>
          <TableRow className="border-slate-200 bg-slate-50/80 hover:bg-slate-50/80">
            <TableHead className="h-10 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Brand
            </TableHead>
            <TableHead className="h-10 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Variant
            </TableHead>
            <TableHead className="h-10 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Stock
            </TableHead>
            <TableHead className="h-10 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Low stock alert
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {variants.map((variant) => {
            const threshold =
              variantThresholds[variant.variantId] ?? defaultThreshold;
            const critical = variant.available <= threshold * 0.5;
            return (
              <TableRow key={variant.variantId} className="border-slate-100">
                <TableCell className="font-semibold text-slate-700">
                  {variant.brandName || "Unbranded"}
                </TableCell>
                <TableCell>
                  <div className="font-medium text-slate-800">
                    {getVariantName(variant)}
                  </div>
                  {variant.configurationState ===
                    "needs_admin_variant_setup" && (
                    <div className="mt-0.5 text-[11px] text-red-500">
                      Admin variant setup needed
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  <span
                    className={cn(
                      "font-bold tabular-nums",
                      critical ? "text-red-600" : "text-amber-700",
                    )}
                  >
                    {variant.available > 0 ? "+" : ""}
                    {formatNumber(variant.available)}{" "}
                    {formatUnit(variant.inventoryUnit, variant.available)}
                  </span>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Pencil
                      className="h-3.5 w-3.5 text-slate-400"
                      aria-hidden="true"
                    />
                    <Select
                      value={String(threshold)}
                      onValueChange={(value) =>
                        onThresholdChange(variant.variantId, Number(value))
                      }
                    >
                      <SelectTrigger className="h-8 w-[116px] bg-white text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {THRESHOLD_OPTIONS.map((value) => (
                          <SelectItem key={value} value={String(value)}>
                            {value} {formatUnit(variant.inventoryUnit, value)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    );
  };

  return (
    <div className="border-t border-amber-200 bg-[linear-gradient(180deg,#fffbeb_0%,#ffffff_26%)] px-4 py-5 sm:px-6">
      <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-amber-700">
            Variant details
          </p>
          <h3 className="mt-1 text-xl font-black tracking-tight text-slate-950">
            {product.name}{" "}
            <span className="font-semibold text-slate-400">
              ({product.sku})
            </span>
          </h3>
        </div>
        <Button variant="outline" size="sm" asChild className="bg-white">
          <Link href={targetHref}>
            <Eye className="mr-2 h-4 w-4" />
            Open full stock record
          </Link>
        </Button>
      </div>

      <div>
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">
            Product information
          </p>
          <dl className="mt-4 grid gap-x-8 gap-y-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs text-slate-400">Product ID</dt>
              <dd className="mt-1 font-bold text-slate-800">
                PRD-{product.target.id.toString().padStart(6, "0")}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-400">Product name</dt>
              <dd className="mt-1 font-bold text-slate-800">{product.name}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-400">
                Total orders (last 30 days)
              </dt>
              <dd className="mt-1 font-bold tabular-nums text-slate-800">
                {product.orderCountLast30Days}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-400">Current stock</dt>
              <dd className="mt-1">
                <CurrentStock variants={product.variants} />
              </dd>
            </div>
          </dl>
        </section>
      </div>

      <section className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-slate-200 px-5 py-3.5">
          <Package className="h-4 w-4 text-amber-600" />
          <h4 className="text-xs font-black uppercase tracking-[0.14em] text-slate-700">
            Variant stock · pack level
          </h4>
        </div>
        {variantTable(
          packVariants,
          "No pack-level variants found for this product.",
        )}
      </section>

      <section className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-slate-200 px-5 py-3.5">
          <PackageOpen className="h-4 w-4 text-amber-600" />
          <h4 className="text-xs font-black uppercase tracking-[0.14em] text-slate-700">
            Loose / ready stock
          </h4>
        </div>
        {variantTable(
          looseVariants,
          "No loose or ready-stock variants found for this product.",
        )}
      </section>

      <section className="mt-4 rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
        <p className="mb-3 text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">
          Action
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            asChild
            className="border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
          >
            <Link
              href={`${WH}/stock-adjustment/create?type=damage&product=${product.target.id}`}
            >
              <Wrench className="mr-2 h-4 w-4" />
              Create Damage
            </Link>
          </Button>
          <Button
            size="sm"
            asChild
            className="bg-slate-950 text-white hover:bg-slate-800"
          >
            <Link href={`${WH}/quick-purchase?product=${product.target.id}`}>
              <ShoppingCart className="mr-2 h-4 w-4" />
              Purchase
            </Link>
          </Button>
        </div>
      </section>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="space-y-4" aria-busy="true">
      <div className="grid gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((item) => (
          <div
            key={item}
            className="h-28 animate-pulse rounded-xl border border-slate-200 bg-slate-100"
          />
        ))}
      </div>
      <div className="h-96 animate-pulse rounded-xl border border-slate-200 bg-slate-100" />
    </div>
  );
}

export default function WarehouseLowStockPage() {
  const { data: session } = authClient.useSession();
  const warehouseName =
    (session?.user as { warehouseName?: string } | undefined)?.warehouseName ??
    "My Warehouse";
  const [threshold, setThreshold] = useState(10);
  const [search, setSearch] = useState("");
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [variantThresholds, setVariantThresholds] = useState<
    Record<number, number>
  >({});
  const deferredSearch = useDeferredValue(search.trim());

  const { data, isLoading, isError, refetch } = useQuery<LowStockData>({
    queryKey: [
      "stockOverview",
      "lowStock",
      "warehouse",
      threshold,
      deferredSearch,
    ],
    queryFn: () =>
      (orpc.stockOverview as any).getLowStockProducts.call({
        ownerType: "warehouse",
        threshold,
        search: deferredSearch || undefined,
      }),
    staleTime: 30_000,
  });

  const today = useMemo(
    () =>
      new Intl.DateTimeFormat("en-GB", {
        weekday: "long",
        day: "2-digit",
        month: "long",
        year: "numeric",
      }).format(new Date()),
    [],
  );

  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-5">
      <header className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 px-5 py-6 text-white shadow-lg sm:px-7">
        <div className="absolute inset-y-0 right-0 w-1/3 bg-[linear-gradient(135deg,transparent_0%,rgba(245,158,11,0.14)_100%)]" />
        <div className="absolute -right-8 -top-16 h-44 w-44 rounded-full border border-amber-400/20" />
        <div className="relative flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div>
            <div className="mb-3 flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.2em] text-amber-400">
              <TriangleAlert className="h-4 w-4" />
              Stock control alert desk
            </div>
            <h1 className="text-2xl font-black tracking-tight sm:text-3xl">
              Low Stock Products
            </h1>
            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-300">
              <span className="inline-flex items-center gap-2">
                <Store className="h-4 w-4 text-amber-400" />
                <strong className="text-white">Store:</strong> {warehouseName}
              </span>
              <span className="inline-flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-amber-400" />
                <strong className="text-white">Today:</strong> {today}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.06] p-2 pl-3 backdrop-blur-sm">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Alert threshold
              </p>
              <p className="text-xs text-slate-300">Applied to every variant</p>
            </div>
            <Select
              value={String(threshold)}
              onValueChange={(value) => {
                setThreshold(Number(value));
                setExpandedKey(null);
              }}
            >
              <SelectTrigger className="h-10 w-[112px] border-amber-400/30 bg-slate-900 font-bold text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {THRESHOLD_OPTIONS.map((value) => (
                  <SelectItem key={value} value={String(value)}>
                    {value} units
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </header>

      {isLoading ? (
        <LoadingState />
      ) : isError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-6 py-10 text-center">
          <CircleAlert className="mx-auto h-10 w-10 text-red-400" />
          <h2 className="mt-3 font-bold text-red-900">
            Low-stock data could not be loaded
          </h2>
          <p className="mt-1 text-sm text-red-600">
            Please retry the inventory scan.
          </p>
          <Button className="mt-4" variant="outline" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <SummaryCard
              label="Low products"
              value={data?.summary.products ?? 0}
              note={`At or below ${threshold} units`}
              tone="amber"
            />
            <SummaryCard
              label="Affected variants"
              value={data?.summary.variants ?? 0}
              note="Exact variants needing attention"
              tone="slate"
            />
            <SummaryCard
              label="Critical variants"
              value={data?.summary.critical ?? 0}
              note={`At or below ${threshold / 2} units`}
              tone="red"
            />
          </div>

          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col justify-between gap-4 border-b border-slate-200 px-4 py-4 sm:flex-row sm:items-center sm:px-5">
              <div>
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <h2 className="text-sm font-black uppercase tracking-[0.13em] text-slate-800">
                    Low stock list · core identity
                  </h2>
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  Select View to inspect pack and loose stock levels.
                </p>
              </div>
              <div className="relative w-full sm:w-80">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search SKU, product, brand or variant…"
                  className="pl-9"
                />
              </div>
            </div>

            {(data?.items.length ?? 0) === 0 ? (
              <div className="flex flex-col items-center px-5 py-16 text-center">
                <div className="rounded-full bg-emerald-50 p-4">
                  <CheckCircle2 className="h-9 w-9 text-emerald-500" />
                </div>
                <h3 className="mt-4 text-lg font-bold text-slate-900">
                  No low-stock products found
                </h3>
                <p className="mt-1 max-w-md text-sm text-slate-500">
                  All matching variants are above the selected {threshold}-unit
                  threshold.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50 hover:bg-slate-50">
                      <TableHead className="w-12" />
                      <TableHead className="min-w-[150px] text-[11px] font-black uppercase tracking-wider text-slate-500">
                        SKU
                      </TableHead>
                      <TableHead className="min-w-[230px] text-[11px] font-black uppercase tracking-wider text-slate-500">
                        Product name
                      </TableHead>
                      <TableHead className="min-w-[260px] text-[11px] font-black uppercase tracking-wider text-slate-500">
                        Current stock
                      </TableHead>
                      <TableHead className="w-36 text-right text-[11px] font-black uppercase tracking-wider text-slate-500">
                        Action
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data?.items.map((product) => {
                      const expanded = expandedKey === product.key;
                      const critical = product.criticalVariantCount > 0;
                      return (
                        <Fragment key={product.key}>
                          <TableRow
                            key={product.key}
                            className={cn(
                              "group border-slate-100 transition-colors",
                              expanded
                                ? "bg-amber-50/70"
                                : "hover:bg-slate-50/70",
                            )}
                          >
                            <TableCell>
                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedKey(expanded ? null : product.key)
                                }
                                className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-white hover:text-slate-900"
                                aria-label={
                                  expanded
                                    ? `Collapse ${product.name}`
                                    : `Expand ${product.name}`
                                }
                              >
                                {expanded ? (
                                  <ChevronDown className="h-4 w-4" />
                                ) : (
                                  <ChevronRight className="h-4 w-4" />
                                )}
                              </button>
                            </TableCell>
                            <TableCell>
                              <span className="font-mono text-xs font-bold tracking-wide text-slate-600">
                                {product.sku}
                              </span>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <div
                                  className={cn(
                                    "grid h-9 w-9 shrink-0 place-items-center rounded-lg border",
                                    critical
                                      ? "border-red-200 bg-red-50 text-red-500"
                                      : "border-amber-200 bg-amber-50 text-amber-600",
                                  )}
                                >
                                  <Package className="h-4 w-4" />
                                </div>
                                <div>
                                  <div className="font-bold text-slate-900">
                                    {product.name}
                                  </div>
                                  <div className="mt-0.5 flex items-center gap-2 text-[11px] text-slate-400">
                                    <span>
                                      {product.lowVariantCount} low variant
                                      {product.lowVariantCount === 1 ? "" : "s"}
                                    </span>
                                    {critical && (
                                      <Badge
                                        variant="outline"
                                        className="h-5 border-red-200 bg-red-50 px-1.5 text-[9px] font-bold text-red-600"
                                      >
                                        Critical
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <CurrentStock variants={product.variants} />
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  setExpandedKey(expanded ? null : product.key)
                                }
                                className={cn(
                                  "gap-2",
                                  critical
                                    ? "border-red-200 text-red-700 hover:bg-red-50"
                                    : "border-amber-200 text-amber-700 hover:bg-amber-50",
                                )}
                              >
                                {critical ? (
                                  <CircleAlert className="h-4 w-4" />
                                ) : (
                                  <ArrowDownRight className="h-4 w-4" />
                                )}
                                View
                              </Button>
                            </TableCell>
                          </TableRow>
                          {expanded && (
                            <TableRow
                              key={`${product.key}-detail`}
                              className="hover:bg-white"
                            >
                              <TableCell colSpan={5} className="p-0">
                                <ProductDetail
                                  product={product}
                                  defaultThreshold={threshold}
                                  variantThresholds={variantThresholds}
                                  onThresholdChange={(variantId, value) =>
                                    setVariantThresholds((current) => ({
                                      ...current,
                                      [variantId]: value,
                                    }))
                                  }
                                />
                              </TableCell>
                            </TableRow>
                          )}
                        </Fragment>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
            <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-5 py-3 text-xs text-slate-500">
              <span>
                {data?.items.length ?? 0} product
                {data?.items.length === 1 ? "" : "s"} require attention
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Pencil className="h-3 w-3" />
                Variant alerts can be adjusted in the detail view
              </span>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
