"use client";

import { updateConsumerReferencePriceSchema } from "@bikalpo-project/api/consumer-price";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  Boxes,
  CalendarClock,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Layers3,
  Loader2,
  Package,
  Tags,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { SetupPageShell } from "@/components/features/product-setup";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ADMIN_BASE } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { orpc } from "@/utils/orpc";
import { ProductPriceBulkActions } from "./product-price-bulk-actions";
import {
  type CategoryOption,
  ProductPriceFilterBar,
} from "./product-price-filter-bar";
import {
  type PriceDraft,
  type PriceGroup,
  type PriceRow,
  ProductPriceTable,
} from "./product-price-table";

const PAGE_SIZE = 15;
const ROUTE = `${ADMIN_BASE}/product-price`;

function parseIntParam(value: string | null) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : undefined;
}

export function ProductPriceClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const filterInput = useMemo(
    () => ({
      search: searchParams.get("search")?.trim() || undefined,
      typeId: parseIntParam(searchParams.get("type")),
      categoryId: parseIntParam(searchParams.get("category")),
      subCategoryId: parseIntParam(searchParams.get("subcategory")),
      coreProductId: parseIntParam(searchParams.get("core")),
    }),
    [searchParams],
  );
  const page = parseIntParam(searchParams.get("page")) ?? 1;
  const { data: typesData } = useQuery(
    orpc.adminProductType.getAll.queryOptions({ input: {} }),
  );
  const types =
    typesData?.types?.map((type) => ({ id: type.id, name: type.name })) ?? [];
  const { data: categoriesRaw = [] } = useQuery(
    orpc.category.getAll.queryOptions(),
  );
  const categories: CategoryOption[] = categoriesRaw.map((category) => ({
    id: category.id,
    name: category.name,
    typeId: category.typeId ?? null,
    subCategory:
      category.subCategory?.map((sub) => ({ id: sub.id, name: sub.name })) ??
      [],
  }));
  const { data, isLoading, isError, error, refetch } = useQuery(
    orpc.product.listConsumerReferencePrices.queryOptions({
      input: { ...filterInput, page, limit: PAGE_SIZE },
    }),
  );
  const stats = data?.stats;
  const pagination = data?.pagination;
  const groups = useMemo(() => {
    const result = new Map<number, PriceGroup>();
    for (const row of data?.items ?? []) {
      let group = result.get(row.productId);
      if (!group) {
        group = {
          key: `p:${row.productId}`,
          id: `PRD-${String(row.productId).padStart(6, "0")}`,
          label: row.productName,
          rows: [],
        };
        result.set(row.productId, group);
      }
      group.rows.push(row);
    }
    return [...result.values()];
  }, [data?.items]);

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [draft, setDraft] = useState<PriceDraft | null>(null);
  const [editError, setEditError] = useState("");
  const [importing, setImporting] = useState(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: Navigation discards the editor for the previous result set.
  useEffect(() => {
    setDraft(null);
    setEditError("");
  }, [filterInput, page]);
  const refreshPrices = () =>
    queryClient.invalidateQueries({ queryKey: orpc.product.key() });
  const updateMutation = useMutation({
    ...orpc.product.updateConsumerReferencePrice.mutationOptions(),
    onSuccess: async () => {
      setDraft(null);
      setEditError("");
      toast.success("Reference price saved");
      await refreshPrices();
    },
    onError: (error: Error) =>
      setEditError(error.message || "The price could not be saved. Try again."),
  });
  const busy = updateMutation.isPending || importing;
  const startEdit = (row: PriceRow) => {
    if (busy) return;
    setDraft({
      id: row.variantPriceId,
      consumerPrice: row.consumerPrice,
      exchangePrice: row.exchangePrice ?? "",
    });
    setEditError("");
  };
  const saveEdit = () => {
    if (!draft || busy) return;
    const row = data?.items.find((item) => item.variantPriceId === draft.id);
    if (!row) return;
    if (row.exchangeEnabled && !draft.exchangePrice.trim()) {
      setEditError("Enter an Exchange Price for this cylinder");
      return;
    }
    const input = updateConsumerReferencePriceSchema.safeParse({
      variantPriceId: draft.id,
      consumerPrice: draft.consumerPrice.trim(),
      exchangePrice:
        row.isCylinderPricing && draft.exchangePrice.trim()
          ? draft.exchangePrice.trim()
          : undefined,
    });
    if (!input.success) {
      setEditError(input.error.issues[0]?.message ?? "Enter a valid price");
      return;
    }
    setEditError("");
    updateMutation.mutate(input.data);
  };
  const toggle = (key: string) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const allExpanded =
    groups.length > 0 && groups.every((group) => expanded.has(group.key));
  const navigationUrl = (typeId?: number) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const key of ["type", "category", "subcategory", "core", "page"])
      params.delete(key);
    if (typeId != null) params.set("type", String(typeId));
    return `${ROUTE}${params.size ? `?${params}` : ""}`;
  };
  const goToPage = (next: number) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next <= 1) params.delete("page");
    else params.set("page", String(next));
    router.push(`${ROUTE}${params.size ? `?${params}` : ""}`, {
      scroll: false,
    });
  };

  return (
    <SetupPageShell>
      <header className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between max-md:p-4">
          <div className="flex items-center gap-3.5">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-inset ring-primary/15">
              <Tags className="size-5" />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg font-semibold tracking-tight">
                  Consumer Price Management
                </h1>
                <Badge variant="secondary" className="font-normal">
                  Global Reference Price
                </Badge>
              </div>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Admin control · Global reference prices for all products.
              </p>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-3 divide-x border-t bg-muted/30">
          <Insight icon={Boxes} label="Products" value={stats?.totalProducts} />
          <Insight
            icon={Layers3}
            label="Variants"
            value={stats?.totalVariants}
          />
          <Insight
            icon={CalendarClock}
            label="Last Updated"
            text={
              stats?.lastUpdated
                ? format(new Date(stats.lastUpdated), "d MMM yyyy")
                : "—"
            }
          />
        </div>
      </header>

      <ProductPriceFilterBar types={types} categories={categories} />
      <section className="space-y-2" aria-label="Category navigation">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Category Navigation
        </h2>
        <nav
          className="flex gap-1 overflow-x-auto rounded-xl border bg-card p-1.5 shadow-sm"
          aria-label="Price categories"
        >
          {[{ id: undefined, name: "All Products" }, ...types].map((type) => (
            <Link
              key={type.id ?? "all"}
              href={navigationUrl(type.id)}
              scroll={false}
              aria-current={filterInput.typeId === type.id ? "page" : undefined}
              className={cn(
                "shrink-0 rounded-lg px-4 py-2 text-sm font-medium transition-colors max-md:min-h-11 max-md:px-3 max-md:py-3 max-md:text-xs",
                filterInput.typeId === type.id
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {type.name}
            </Link>
          ))}
        </nav>
      </section>

      <section className="space-y-3" aria-labelledby="price-list-title">
        <div className="flex items-center justify-between gap-3">
          <h2 id="price-list-title" className="text-sm font-semibold">
            Product Price List
          </h2>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!groups.length || isLoading || isError}
            onClick={() =>
              setExpanded(
                allExpanded
                  ? new Set()
                  : new Set(groups.map((group) => group.key)),
              )
            }
          >
            <ChevronDown
              className={cn("size-4", allExpanded && "rotate-180")}
            />
            {allExpanded ? "Collapse All" : "Expand All"}
          </Button>
        </div>
        {isError ? (
          <div
            role="alert"
            className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive"
          >
            <p>{error.message || "Failed to load prices"}</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => void refetch()}
            >
              Try again
            </Button>
          </div>
        ) : isLoading ? (
          <div
            role="status"
            className="flex items-center justify-center gap-2 py-20 text-muted-foreground"
          >
            <Loader2 className="size-5 animate-spin" /> Loading prices…
          </div>
        ) : !groups.length ? (
          <div className="flex flex-col items-center rounded-xl border border-dashed bg-card px-4 py-16 text-center shadow-sm">
            <Package className="size-12 text-muted-foreground/30" />
            <p className="mt-3 text-sm font-semibold">No products found</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Adjust your filters or create a product with variants to manage
              reference prices.
            </p>
            <Button asChild size="sm" className="mt-4">
              <Link href={`${ADMIN_BASE}/products/new`}>Add Product</Link>
            </Button>
          </div>
        ) : (
          <ProductPriceTable
            groups={groups}
            expanded={expanded}
            onToggle={toggle}
            draft={draft}
            error={editError}
            saving={busy}
            onStartEdit={startEdit}
            onDraftChange={(next) => {
              setDraft(next);
              setEditError("");
            }}
            onSave={saveEdit}
            onCancel={() => {
              if (!busy) {
                setDraft(null);
                setEditError("");
              }
            }}
          />
        )}
        {!isError && pagination && pagination.totalPages > 1 && (
          <div className="flex flex-col items-center justify-between gap-3 pt-2 text-sm sm:flex-row">
            <p className="text-muted-foreground">
              Page {pagination.page} of {pagination.totalPages} ·{" "}
              {pagination.totalGroups.toLocaleString("en-BD")} products
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pagination.page <= 1}
                onClick={() => goToPage(pagination.page - 1)}
              >
                <ChevronLeft className="size-4" /> Previous
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => goToPage(pagination.page + 1)}
              >
                Next <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        )}
      </section>
      <ProductPriceBulkActions
        filters={filterInput}
        disabled={busy}
        canExport={!!stats?.totalVariants && !isError}
        onImportingChange={setImporting}
        onImported={async () => {
          setDraft(null);
          await refreshPrices();
        }}
      />
    </SetupPageShell>
  );
}

function Insight({
  icon: Icon,
  label,
  value,
  text,
}: {
  icon: typeof Boxes;
  label: string;
  value?: number;
  text?: string;
}) {
  return (
    <div className="flex items-center justify-center gap-3 px-4 py-3.5 max-md:min-w-0 max-md:flex-col max-md:gap-2 max-md:px-1">
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground max-md:hidden" />
      <div className="max-md:min-w-0 max-md:w-full max-md:text-center">
        <p className="text-lg font-semibold leading-none tabular-nums max-md:truncate max-md:text-sm">
          {text ?? (value != null ? value.toLocaleString("en-BD") : "—")}
        </p>
        <p className="mt-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground max-md:text-[10px]">
          {label}
        </p>
      </div>
    </div>
  );
}
