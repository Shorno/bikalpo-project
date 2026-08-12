"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  Boxes,
  CalendarClock,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  Layers3,
  Loader2,
  Package,
  Pencil,
  Tags,
  Upload,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { SetupPageShell } from "@/components/features/product-setup";
import { Badge } from "@/components/ui/badge";
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
import { ADMIN_BASE } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { client, orpc } from "@/utils/orpc";
import {
  type CategoryOption,
  ProductPriceFilterBar,
} from "./product-price-filter-bar";

const PAGE_SIZE = 15;
const ROUTE = `${ADMIN_BASE}/product-price`;

function parseIntParam(v: string | null): number | undefined {
  if (!v) return undefined;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : undefined;
}

function formatBdt(n: string) {
  const x = Number.parseFloat(n);
  if (Number.isNaN(x)) return `৳ ${n}`;
  return `৳ ${x.toLocaleString("en-BD", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

type Row = {
  variantPriceId: number;
  consumerPrice: string;
  updatedAt: Date | string | null;
  brandDisplay: string;
  variantName: string;
  variantUnit: string;
  typeName: string;
  categoryName: string;
  subCategoryName: string;
  coreLine: string;
  coreProductId: number | null;
  coreProductName: string | null;
  coreProductSku: string | null;
  productId: number;
  productName: string;
  productSku: string | null;
};

type GroupedSection = {
  key: string;
  label: string;
  sku: string;
  rows: Row[];
};

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
  const listInput = useMemo(
    () => ({ ...filterInput, page, limit: PAGE_SIZE }),
    [filterInput, page],
  );

  const goToPage = (next: number) => {
    const p = new URLSearchParams(searchParams.toString());
    if (next <= 1) p.delete("page");
    else p.set("page", String(next));
    router.push(`${ROUTE}${p.toString() ? `?${p}` : ""}`);
  };

  const { data: typesData } = useQuery(
    orpc.adminProductType.getAll.queryOptions({ input: {} }),
  );
  const types =
    typesData?.types?.map((t) => ({ id: t.id, name: t.name })) ?? [];

  const { data: categoriesRaw = [] } = useQuery(
    orpc.category.getAll.queryOptions(),
  );
  const categories: CategoryOption[] = useMemo(() => {
    const list = Array.isArray(categoriesRaw) ? categoriesRaw : [];
    // biome-ignore lint/suspicious/noExplicitAny: category payload is loosely typed at the boundary
    return list.map((c: any) => ({
      id: c.id,
      name: c.name,
      typeId: c.typeId ?? null,
      // biome-ignore lint/suspicious/noExplicitAny: sub category payload is loosely typed
      subCategory: (c.subCategory ?? []).map((sc: any) => ({
        id: sc.id,
        name: sc.name,
      })),
    }));
  }, [categoriesRaw]);

  const { data, isLoading, isError, error } = useQuery({
    ...orpc.product.listConsumerReferencePrices.queryOptions({
      input: listInput,
    }),
  });

  const items = (data?.items ?? []) as Row[];
  const stats = data?.stats;
  const pagination = data?.pagination;
  const totalCore = stats?.totalCoreProducts ?? 0;

  const grouped = useMemo(() => {
    const byType = new Map<string, GroupedSection[]>();
    const sectionMap = new Map<string, GroupedSection>();

    for (const item of items) {
      const t = item.typeName || "Uncategorized";
      const gk =
        item.coreProductId != null
          ? `c:${item.coreProductId}`
          : `p:${item.productId}`;
      const mapKey = `${t}::${gk}`;

      if (!sectionMap.has(mapKey)) {
        const label = item.coreProductName ?? item.productName;
        const sku = item.coreProductSku ?? item.productSku ?? "—";
        const section: GroupedSection = { key: mapKey, label, sku, rows: [] };
        sectionMap.set(mapKey, section);

        if (!byType.has(t)) byType.set(t, []);
        // biome-ignore lint/style/noNonNullAssertion: key just set above
        byType.get(t)!.push(section);
      }
      // biome-ignore lint/style/noNonNullAssertion: section created above
      sectionMap.get(mapKey)!.rows.push(item);
    }
    return byType;
  }, [items]);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);

  const updateMutation = useMutation({
    ...orpc.product.updateConsumerReferencePrice.mutationOptions(),
    onSuccess: () => {
      toast.success("Reference price updated");
      setEditingId(null);
      void queryClient.invalidateQueries({
        queryKey: orpc.product.listConsumerReferencePrices.key(),
      });
    },
    onError: (e: Error) => toast.error(e.message || "Update failed"),
  });

  const startEdit = (id: number, currentPrice: string) => {
    setEditingId(id);
    setEditValue(currentPrice);
    setTimeout(() => editInputRef.current?.focus(), 0);
  };

  const confirmEdit = () => {
    if (editingId == null || !editValue.trim()) return;
    updateMutation.mutate({
      variantPriceId: editingId,
      consumerPrice: editValue.trim(),
    });
  };

  const cancelEdit = () => setEditingId(null);

  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") confirmEdit();
    if (e.key === "Escape") cancelEdit();
  };

  const [exporting, setExporting] = useState(false);
  const handleExport = async () => {
    setExporting(true);
    try {
      const result = await client.product.exportConsumerPricesCSV(filterInput);
      if (result.csv) {
        const blob = new Blob([result.csv], {
          type: "text/csv;charset=utf-8",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `product-prices-${format(new Date(), "yyyy-MM-dd")}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success("Export complete");
      }
      // biome-ignore lint/suspicious/noExplicitAny: surface any error message to the user
    } catch (e: any) {
      toast.error(e?.message ?? "Export failed");
    } finally {
      setExporting(false);
    }
  };

  return (
    <SetupPageShell>
      {/* ── Header ── */}
      <header className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3.5">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-inset ring-primary/15">
              <Tags className="h-5 w-5" />
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
                Reference prices for all consumer/retail variants. Sellers may
                override these on their storefront.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled
              title="Bulk upload coming soon"
            >
              <Upload className="h-4 w-4" />
              Upload (Excel)
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={exporting || items.length === 0}
              onClick={() => void handleExport()}
            >
              {exporting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              Export CSV
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-3 divide-x border-t bg-muted/30">
          <Insight
            icon={Boxes}
            label="Core Products"
            value={stats?.totalCoreProducts}
          />
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

      {/* ── Filters ── */}
      <ProductPriceFilterBar types={types} categories={categories} />

      {/* ── Error ── */}
      {isError && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {(error as Error)?.message ?? "Failed to load prices"}
        </div>
      )}

      {/* ── Content ── */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : totalCore === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-card py-16 text-center shadow-sm">
          <Package className="h-12 w-12 text-muted-foreground/30" />
          <p className="mt-3 text-sm font-semibold">No products found</p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Create a product with consumer/retail variants, or adjust your
            filters, to see reference pricing here.
          </p>
          <Button asChild size="sm" className="mt-4">
            <Link href={`${ADMIN_BASE}/products/new`}>Add Product First</Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {[...grouped.entries()].map(([typeName, sections]) => (
            <section key={typeName} className="space-y-3">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  {typeName}
                </h2>
                <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                  {sections.length}
                </span>
              </div>

              <div className="space-y-4">
                {sections.map((section) => (
                  <CoreProductCard
                    key={section.key}
                    section={section}
                    editingId={editingId}
                    editValue={editValue}
                    editInputRef={editInputRef}
                    isSaving={updateMutation.isPending}
                    onEditValueChange={setEditValue}
                    onStartEdit={startEdit}
                    onConfirmEdit={confirmEdit}
                    onCancelEdit={cancelEdit}
                    onEditKeyDown={handleEditKeyDown}
                  />
                ))}
              </div>
            </section>
          ))}

          {pagination && pagination.totalPages > 1 ? (
            <div className="flex flex-col items-center justify-between gap-3 border-t pt-4 text-sm sm:flex-row">
              <span className="text-muted-foreground">
                Page{" "}
                <span className="font-medium text-foreground">
                  {pagination.page}
                </span>{" "}
                of {pagination.totalPages} ·{" "}
                {pagination.totalGroups.toLocaleString("en-BD")} core products
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page <= 1}
                  onClick={() => goToPage(pagination.page - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => goToPage(pagination.page + 1)}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : null}
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
    <div className="flex items-center justify-center gap-3 px-4 py-3.5">
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      <div>
        <p className="text-lg font-semibold leading-none tabular-nums">
          {text ?? (value != null ? value.toLocaleString("en-BD") : "—")}
        </p>
        <p className="mt-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
      </div>
    </div>
  );
}

function CoreProductCard({
  section,
  editingId,
  editValue,
  editInputRef,
  isSaving,
  onEditValueChange,
  onStartEdit,
  onConfirmEdit,
  onCancelEdit,
  onEditKeyDown,
}: {
  section: GroupedSection;
  editingId: number | null;
  editValue: string;
  editInputRef: React.RefObject<HTMLInputElement | null>;
  isSaving: boolean;
  onEditValueChange: (v: string) => void;
  onStartEdit: (id: number, price: string) => void;
  onConfirmEdit: () => void;
  onCancelEdit: () => void;
  onEditKeyDown: (e: React.KeyboardEvent) => void;
}) {
  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <div className="flex flex-wrap items-center gap-2 border-b bg-muted/30 px-4 py-3">
        <span className="text-sm font-semibold">{section.label}</span>
        <Badge
          variant="secondary"
          className="px-1.5 py-0 font-mono text-[10px]"
        >
          SKU {section.sku}
        </Badge>
      </div>

      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-[200px]">Brand</TableHead>
            <TableHead>Variant</TableHead>
            <TableHead className="w-[80px]">Unit</TableHead>
            <TableHead className="w-[140px] text-right">Price</TableHead>
            <TableHead className="w-[130px]">Last Update</TableHead>
            <TableHead className="w-[80px] text-center">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {section.rows.map((row) => {
            const isEditing = editingId === row.variantPriceId;
            return (
              <TableRow key={row.variantPriceId}>
                <TableCell className="font-medium">
                  {row.brandDisplay}
                </TableCell>
                <TableCell>{row.variantName}</TableCell>
                <TableCell className="text-muted-foreground">
                  {row.variantUnit}
                </TableCell>
                <TableCell className="text-right">
                  {isEditing ? (
                    <Input
                      ref={editInputRef}
                      className="ml-auto h-8 w-28 text-right tabular-nums"
                      value={editValue}
                      onChange={(e) => onEditValueChange(e.target.value)}
                      onKeyDown={onEditKeyDown}
                      autoFocus
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() =>
                        onStartEdit(row.variantPriceId, row.consumerPrice)
                      }
                      className="ml-auto rounded-md px-2 py-1 font-semibold tabular-nums transition-colors hover:bg-primary/10 hover:text-primary"
                      title="Click to edit price"
                    >
                      {formatBdt(row.consumerPrice)}
                    </button>
                  )}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {row.updatedAt
                    ? `Admin · ${format(new Date(row.updatedAt), "dd MMM")}`
                    : "—"}
                </TableCell>
                <TableCell className="text-center">
                  {isEditing ? (
                    <span className="inline-flex items-center gap-0.5">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        disabled={isSaving}
                        onClick={onConfirmEdit}
                        title="Save"
                      >
                        {isSaving ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Check className="h-3.5 w-3.5 text-emerald-600" />
                        )}
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        disabled={isSaving}
                        onClick={onCancelEdit}
                        title="Cancel"
                      >
                        <X className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                    </span>
                  ) : (
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className={cn(
                        "h-7 w-7 text-muted-foreground hover:text-foreground",
                      )}
                      onClick={() =>
                        onStartEdit(row.variantPriceId, row.consumerPrice)
                      }
                      title="Edit price"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

