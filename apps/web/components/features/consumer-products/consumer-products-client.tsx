"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  Check,
  ChevronRight,
  Download,
  Loader2,
  Package,
  Pencil,
  Upload,
  X,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
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
import { client, orpc } from "@/utils/orpc";
import {
  ConsumerProductsFilterBar,
  type CategoryOption,
} from "./consumer-products-filter-bar";

function parseIntParam(v: string | null): number | undefined {
  if (!v) return undefined;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : undefined;
}

function formatBdt(n: string) {
  const x = Number.parseFloat(n);
  if (Number.isNaN(x)) return `৳ ${n}`;
  return `৳ ${x.toLocaleString("en-BD", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
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
  label: string;
  sku: string;
  taxonomy: string;
  rows: Row[];
};

export function ConsumerProductsClient() {
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const listInput = useMemo(
    () => ({
      search: searchParams.get("search")?.trim() || undefined,
      typeId: parseIntParam(searchParams.get("type")),
      categoryId: parseIntParam(searchParams.get("category")),
      subCategoryId: parseIntParam(searchParams.get("subcategory")),
      coreProductId: parseIntParam(searchParams.get("core")),
    }),
    [searchParams],
  );

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
    return list.map((c: any) => ({
      id: c.id,
      name: c.name,
      typeId: c.typeId ?? null,
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
        const taxonomy = [item.categoryName, item.subCategoryName, label]
          .filter(Boolean)
          .join(" → ");
        const section: GroupedSection = { label, sku, taxonomy, rows: [] };
        sectionMap.set(mapKey, section);

        if (!byType.has(t)) byType.set(t, []);
        byType.get(t)!.push(section);
      }
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
      const result = await client.product.exportConsumerPricesCSV(listInput);
      if (result.csv) {
        const blob = new Blob([result.csv], {
          type: "text/csv;charset=utf-8",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `consumer-reference-prices-${format(new Date(), "yyyy-MM-dd")}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success("Export complete");
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Export failed");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex flex-col gap-5 p-6">
      {/* ── Header ── */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">
          Consumer price management
        </h1>
        <p className="text-sm text-muted-foreground">
          Manage global reference prices for retail / consumer variants. Sellers
          may override these on their storefront.
        </p>
      </div>

      {/* ── Filters ── */}
      <ConsumerProductsFilterBar types={types} categories={categories} />

      {/* ── Toolbar: stats + actions ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span>
            <strong className="text-foreground tabular-nums">
              {stats?.totalCoreProducts ?? "—"}
            </strong>{" "}
            products
          </span>
          <span className="text-border">|</span>
          <span>
            <strong className="text-foreground tabular-nums">
              {stats?.totalVariants ?? "—"}
            </strong>{" "}
            variants
          </span>
          {stats?.lastUpdated && (
            <>
              <span className="text-border">|</span>
              <span>
                Updated{" "}
                {format(new Date(stats.lastUpdated), "d MMM yyyy")}
              </span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled
            className="gap-1.5"
            title="Bulk upload coming soon"
          >
            <Upload className="h-3.5 w-3.5" />
            Upload (Excel)
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={exporting || items.length === 0}
            onClick={() => void handleExport()}
          >
            {exporting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
            Export CSV
          </Button>
        </div>
      </div>

      {/* ── Error state ── */}
      {isError && (
        <div className="rounded-md border border-destructive/50 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {(error as Error)?.message ?? "Failed to load prices"}
        </div>
      )}

      {/* ── Loading state ── */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : items.length === 0 ? (
        /* ── Empty state ── */
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
          <Package className="h-10 w-10 text-muted-foreground/40" />
          <p className="mt-3 text-sm font-medium">No products found</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Create a product with consumer/retail variants to see pricing here.
          </p>
          <Button asChild size="sm" className="mt-4">
            <Link href={`${ADMIN_BASE}/products/new`}>Add product</Link>
          </Button>
        </div>
      ) : (
        /* ── Main table ── */
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead className="w-[200px]">Brand</TableHead>
                <TableHead>Variant</TableHead>
                <TableHead className="w-[80px]">Unit</TableHead>
                <TableHead className="w-[120px] text-right">
                  Price (৳)
                </TableHead>
                <TableHead className="w-[150px]">Last update</TableHead>
                <TableHead className="w-[90px] text-center">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...grouped.entries()].map(([typeName, sections]) => [
                <TableRow
                  key={`type:${typeName}`}
                  className="bg-muted/60 hover:bg-muted/60"
                >
                  <TableCell
                    colSpan={6}
                    className="py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                  >
                    {typeName}
                  </TableCell>
                </TableRow>,

                ...sections.flatMap((section, sectionIdx) => [
                  <TableRow
                    key={`section:${typeName}:${sectionIdx}`}
                    className="border-t bg-background hover:bg-background"
                  >
                    <TableCell colSpan={6} className="py-2.5 px-4">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-semibold">
                          {section.label}
                        </span>
                        <Badge variant="secondary" className="font-mono text-[10px] px-1.5 py-0">
                          {section.sku}
                        </Badge>
                        <span className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground ml-1">
                          <ChevronRight className="h-3 w-3" />
                          {section.taxonomy}
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>,
                  ...section.rows.map((row) => {
                    const isEditing = editingId === row.variantPriceId;
                    return (
                      <TableRow
                        key={row.variantPriceId}
                        className="group"
                      >
                        <TableCell className="pl-8 font-medium text-sm">
                          {row.brandDisplay}
                        </TableCell>
                        <TableCell className="text-sm">
                          {row.variantName}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {row.variantUnit}
                        </TableCell>
                        <TableCell className="text-right">
                          {isEditing ? (
                            <Input
                              ref={editInputRef}
                              className="ml-auto h-8 w-24 text-right tabular-nums"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onKeyDown={handleEditKeyDown}
                              autoFocus
                            />
                          ) : (
                            <span className="tabular-nums font-medium text-sm">
                              {formatBdt(row.consumerPrice)}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {row.updatedAt
                            ? `Admin (${format(new Date(row.updatedAt), "dd MMM")})`
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
                                disabled={updateMutation.isPending}
                                onClick={confirmEdit}
                                title="Save"
                              >
                                {updateMutation.isPending ? (
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
                                disabled={updateMutation.isPending}
                                onClick={cancelEdit}
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
                              className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() =>
                                startEdit(
                                  row.variantPriceId,
                                  row.consumerPrice,
                                )
                              }
                              title="Edit price"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  }),
                ]),
              ])}
            </TableBody>
          </Table>
        </div>
      )}

      {/* ── Footer rules ── */}
      {items.length > 0 && (
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground border-t pt-4">
          <span>Price is variant-based</span>
          <span>Admin price = reference price</span>
          <span>Seller can override</span>
          <span>All updates are logged</span>
        </div>
      )}
    </div>
  );
}
