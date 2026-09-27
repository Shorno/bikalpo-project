"use client";

import {
  priceProductDisplayId,
  updateProductReferencePricesSchema,
} from "@bikalpo-project/api/consumer-price";
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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { SetupPageShell } from "@/components/features/product-setup";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ADMIN_BASE } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { orpc } from "@/utils/orpc";
import styles from "./product-price.module.css";
import {
  type CategoryOption,
  ProductPriceFilterBar,
} from "./product-price-filter-bar";
import {
  type PriceDraft,
  type PriceGroup,
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
  const filterKey = JSON.stringify([filterInput, page]);
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
  const groups = useMemo(() => {
    const result = new Map<number, PriceGroup>();
    for (const row of data?.items ?? []) {
      let group = result.get(row.productId);
      if (!group) {
        group = {
          key: String(row.productId),
          productId: row.productId,
          id: priceProductDisplayId(row.productId),
          label: row.productName,
          rows: [],
        };
        result.set(row.productId, group);
      }
      group.rows.push(row);
    }
    return [...result.values()];
  }, [data?.items]);
  const openParam = searchParams.get("open") ?? "";
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(openParam.split(",").filter(Boolean)),
  );
  const [draft, setDraft] = useState<PriceDraft | null>(null);
  const [editError, setEditError] = useState("");
  const dirty = !!draft && JSON.stringify(draft.rows) !== draft.original;
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  useEffect(() => {
    setExpanded(new Set(openParam.split(",").filter(Boolean)));
  }, [openParam]);
  // Navigation through the controls is guarded before changing the result set.
  // biome-ignore lint/correctness/useExhaustiveDependencies: Reset when the actual filter values or page change.
  useEffect(() => {
    setDraft(null);
    setEditError("");
  }, [filterKey]);
  const refreshPrices = () =>
    queryClient.invalidateQueries({ queryKey: orpc.product.key() });
  const updateMutation = useMutation({
    ...orpc.product.updateProductReferencePrices.mutationOptions(),
    onSuccess: async () => {
      dirtyRef.current = false;
      setDraft(null);
      setEditError("");
      toast.success("Product prices saved");
      await refreshPrices();
    },
    onError: (error: Error) =>
      setEditError(
        error.message ||
          "Prices could not be saved. Your changes are still here; try again.",
      ),
  });
  const busy = updateMutation.isPending;
  const beforeNavigate = useCallback(() => {
    if (busy) return false;
    if (
      dirtyRef.current &&
      !window.confirm("Discard your unsaved price changes?")
    )
      return false;
    dirtyRef.current = false;
    setDraft(null);
    setEditError("");
    return true;
  }, [busy]);
  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (dirtyRef.current || busy) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    const linkClick = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      const link =
        event.target instanceof Element
          ? event.target.closest("a[href]")
          : null;
      if (
        link instanceof HTMLAnchorElement &&
        link.target !== "_blank" &&
        link.href !== window.location.href &&
        !link.hasAttribute("download") &&
        !beforeNavigate()
      ) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", linkClick, true);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", linkClick, true);
    };
  }, [beforeNavigate, busy]);
  const changeExpanded = (next: Set<string>) => {
    setExpanded(next);
    const params = new URLSearchParams(searchParams.toString());
    if (next.size) params.set("open", [...next].join(","));
    else params.delete("open");
    router.replace(`${ROUTE}${params.size ? `?${params}` : ""}`, {
      scroll: false,
    });
  };
  const startEdit = (group: PriceGroup) => {
    if (!beforeNavigate()) return;
    const rows = group.rows.map((row) => ({
      variantPriceId: row.variantPriceId,
      consumerPrice: row.consumerPrice,
      exchangePrice: row.exchangePrice ?? "",
    }));
    setDraft({
      productId: group.productId,
      rows,
      original: JSON.stringify(rows),
    });
    changeExpanded(new Set([...expanded, group.key]));
  };
  const saveEdit = () => {
    if (!draft || busy) return;
    for (const value of draft.rows) {
      const row = data?.items.find(
        (item) => item.variantPriceId === value.variantPriceId,
      );
      if (row?.exchangeEnabled && !value.exchangePrice.trim()) {
        setEditError(`Enter an Exchange Price for ${row.variantName}.`);
        return;
      }
    }
    const input = updateProductReferencePricesSchema.safeParse({
      productId: draft.productId,
      rows: draft.rows.map((row) => ({
        ...row,
        exchangePrice: row.exchangePrice.trim() || undefined,
      })),
    });
    if (!input.success) {
      const issue = input.error.issues[0];
      const index =
        typeof issue?.path[1] === "number" ? issue.path[1] : undefined;
      const row =
        index == null
          ? undefined
          : data?.items.find(
              (item) =>
                item.variantPriceId === draft.rows[index]?.variantPriceId,
            );
      setEditError(
        `${row ? `${row.variantName}: ` : ""}${issue?.message ?? "Enter valid prices"}`,
      );
      return;
    }
    setEditError("");
    updateMutation.mutate(input.data);
  };
  const allExpanded =
    groups.length > 0 && groups.every((group) => expanded.has(group.key));
  const navigationUrl = (typeId?: number) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const key of [
      "type",
      "category",
      "subcategory",
      "core",
      "page",
      "open",
    ])
      params.delete(key);
    if (typeId != null) params.set("type", String(typeId));
    return `${ROUTE}${params.size ? `?${params}` : ""}`;
  };
  const goToPage = (next: number) => {
    if (!beforeNavigate()) return;
    const params = new URLSearchParams(searchParams.toString());
    params.delete("open");
    if (next <= 1) params.delete("page");
    else params.set("page", String(next));
    router.push(`${ROUTE}${params.size ? `?${params}` : ""}`, {
      scroll: false,
    });
  };
  return (
    <SetupPageShell className={styles.console}>
      <header className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between max-md:p-4">
          <div className="flex items-center gap-3.5">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-inset ring-primary/15">
              <Tags aria-hidden="true" className="size-5" />
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
      <ProductPriceFilterBar
        types={types}
        categories={categories}
        beforeNavigate={beforeNavigate}
        disabled={busy}
      />
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
            variant="outline"
            size="sm"
            disabled={!groups.length || isLoading || isError || busy}
            title="Expand or collapse all products on this page"
            onClick={() => {
              if (beforeNavigate())
                changeExpanded(
                  allExpanded
                    ? new Set()
                    : new Set(groups.map((group) => group.key)),
                );
            }}
          >
            <ChevronDown
              aria-hidden="true"
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
              className="mt-3"
              onClick={() => void refetch()}
            >
              Try again
            </Button>
          </div>
        ) : isLoading ? (
          <div
            role="status"
            className="flex items-center justify-center gap-2 py-16 text-muted-foreground"
          >
            <Loader2 aria-hidden="true" className="size-5 animate-spin" />
            Loading prices…
          </div>
        ) : !groups.length ? (
          <div className="flex flex-col items-center rounded-xl border border-dashed bg-card px-4 py-16 text-center shadow-sm">
            <Package
              aria-hidden="true"
              className="size-12 text-muted-foreground/30"
            />
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
            draft={draft}
            error={editError}
            saving={busy}
            onToggle={(key) => {
              if (!beforeNavigate()) return;
              const next = new Set(expanded);
              if (next.has(key)) next.delete(key);
              else next.add(key);
              changeExpanded(next);
            }}
            onStartEdit={startEdit}
            onDraftChange={(next) => {
              setDraft(next);
              setEditError("");
            }}
            onSave={saveEdit}
            onCancel={() => {
              if (!busy) {
                dirtyRef.current = false;
                setDraft(null);
                setEditError("");
              }
            }}
          />
        )}
      </section>
      {!isError && data?.pagination && data.pagination.totalPages > 1 && (
        <div className="flex flex-col items-center justify-between gap-3 pt-2 text-sm text-muted-foreground sm:flex-row">
          <p>
            Page {data.pagination.page} of {data.pagination.totalPages} ·{" "}
            {data.pagination.totalGroups.toLocaleString("en-BD")} products
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={busy || data.pagination.page <= 1}
              onClick={() => goToPage(data.pagination.page - 1)}
            >
              <ChevronLeft aria-hidden="true" className="size-4" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={
                busy || data.pagination.page >= data.pagination.totalPages
              }
              onClick={() => goToPage(data.pagination.page + 1)}
            >
              Next
              <ChevronRight aria-hidden="true" className="size-4" />
            </Button>
          </div>
        </div>
      )}
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
      <Icon
        aria-hidden="true"
        className="h-4 w-4 shrink-0 text-muted-foreground max-md:hidden"
      />
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
