"use client";

import { FileDown, FileSpreadsheet, Loader2, Plus, Search } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { exportStockCSV } from "@/actions/product/export-stock-csv";
import { exportStockPDF } from "@/actions/product/export-stock-pdf";
import type {
  StockSort,
  StockStatusFilter,
} from "@/actions/product/get-products-for-stock";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDebounce } from "@/hooks/use-debounce";
import { ADMIN_BASE } from "@/lib/routes";

type Category = { id: number; name: string };

interface StockFilterBarProps {
  categories: Category[];
}

const STOCK_OPTIONS: { value: StockStatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "in", label: "In Stock" },
  { value: "out", label: "Out of Stock" },
  { value: "low", label: "Low Stock" },
];

const SORT_OPTIONS: { value: StockSort; label: string }[] = [
  { value: "newest", label: "Newest → Oldest" },
  { value: "oldest", label: "Oldest → Newest" },
  { value: "popular", label: "Popular Products" },
];

export function StockFilterBar({ categories }: StockFilterBarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const [categoryId, setCategoryId] = useState(
    searchParams.get("category") ?? "all",
  );
  const [stockStatus, setStockStatus] = useState<StockStatusFilter>(
    (searchParams.get("status") as StockStatusFilter) ?? "all",
  );
  const [sort, setSort] = useState<StockSort>(
    (searchParams.get("sort") as StockSort) ?? "newest",
  );
  const [exporting, setExporting] = useState<"csv" | "pdf" | null>(null);
  const lastPushedSearchRef = useRef<string>("");
  const searchParamsRef = useRef(searchParams);

  const isFirstSearchEffect = useRef(true);
  const debouncedSearch = useDebounce(search, 300);

  // Keep ref in sync
  useEffect(() => {
    searchParamsRef.current = searchParams;
  }, [searchParams]);

  useEffect(() => {
    const urlSearch = searchParams.get("search") ?? "";
    if (urlSearch !== lastPushedSearchRef.current) {
      setSearch(urlSearch);
      lastPushedSearchRef.current = urlSearch;
    }
    setCategoryId(searchParams.get("category") ?? "all");
    setStockStatus((searchParams.get("status") as StockStatusFilter) ?? "all");
    setSort((searchParams.get("sort") as StockSort) ?? "newest");
  }, [searchParams]);

  useEffect(() => {
    if (isFirstSearchEffect.current) {
      isFirstSearchEffect.current = false;
      return;
    }
    const p = new URLSearchParams(searchParamsRef.current.toString());
    p.set("page", "1");
    if (debouncedSearch.trim()) p.set("search", debouncedSearch.trim());
    else p.delete("search");
    lastPushedSearchRef.current = debouncedSearch.trim();
    router.push(`${ADMIN_BASE}/stock${p.toString() ? `?${p}` : ""}`);
  }, [debouncedSearch, router]);

  const apply = () => {
    const p = new URLSearchParams();
    if (search.trim()) p.set("search", search.trim());
    if (categoryId && categoryId !== "all") p.set("category", categoryId);
    if (stockStatus && stockStatus !== "all") p.set("status", stockStatus);
    if (sort && sort !== "newest") p.set("sort", sort);
    p.set("page", "1");
    router.push(`${ADMIN_BASE}/stock${p.toString() ? `?${p}` : ""}`);
  };

  const handleExportCSV = async () => {
    setExporting("csv");
    try {
      const s = searchParams.get("search")?.trim();
      const c = searchParams.get("category");
      const st = searchParams.get("status") as StockStatusFilter | null;
      const so = searchParams.get("sort") as StockSort | null;
      const result = await exportStockCSV({
        search: s || undefined,
        categoryId: c && c !== "all" ? c : undefined,
        stockStatus: st && st !== "all" ? st : undefined,
        sort: so && so !== "newest" ? so : undefined,
      });
      if (result.success && result.csv) {
        const blob = new Blob([result.csv], {
          type: "text/csv;charset=utf-8;",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `stock-inventory-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success("CSV exported");
      } else {
        toast.error(result.success === false ? result.error : "Export failed");
      }
    } catch {
      toast.error("Export failed");
    } finally {
      setExporting(null);
    }
  };

  const handleExportPDF = async () => {
    setExporting("pdf");
    try {
      const s = searchParams.get("search")?.trim();
      const c = searchParams.get("category");
      const st = searchParams.get("status") as StockStatusFilter | null;
      const so = searchParams.get("sort") as StockSort | null;
      const result = await exportStockPDF({
        search: s || undefined,
        categoryId: c && c !== "all" ? c : undefined,
        stockStatus: st && st !== "all" ? st : undefined,
        sort: so && so !== "newest" ? so : undefined,
      });
      if (result.success && result.pdfBase64) {
        const bin = atob(result.pdfBase64);
        const arr = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
        const blob = new Blob([arr], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `stock-inventory-${new Date().toISOString().slice(0, 10)}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success("PDF exported");
      } else {
        toast.error(result.success === false ? result.error : "Export failed");
      }
    } catch {
      toast.error("Export failed");
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="w-full sm:w-64">
        <label htmlFor="stock-search" className="text-muted-foreground text-xs">
          Search
        </label>
        <div className="relative mt-1">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="stock-search"
            placeholder="Product, SKU, Category"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && apply()}
            className="pl-8"
          />
        </div>
      </div>
      <div className="w-40">
        <label
          htmlFor="stock-category"
          className="text-muted-foreground text-xs"
        >
          Category
        </label>
        <Select value={categoryId} onValueChange={setCategoryId}>
          <SelectTrigger id="stock-category" className="mt-1">
            <SelectValue placeholder="All" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={String(c.id)}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="w-36">
        <label htmlFor="stock-status" className="text-muted-foreground text-xs">
          Stock
        </label>
        <Select
          value={stockStatus}
          onValueChange={(v) => setStockStatus(v as StockStatusFilter)}
        >
          <SelectTrigger id="stock-status" className="mt-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STOCK_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="w-44">
        <label htmlFor="stock-sort" className="text-muted-foreground text-xs">
          Sort
        </label>
        <Select value={sort} onValueChange={(v) => setSort(v as StockSort)}>
          <SelectTrigger id="stock-sort" className="mt-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button onClick={apply}>Apply Filters</Button>
      <Button variant="outline" asChild>
        <Link href={`${ADMIN_BASE}/products/new`}>
          <Plus className="mr-2 size-4" />
          Add New Product
        </Link>
      </Button>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleExportCSV}
          disabled={exporting !== null}
        >
          {exporting === "csv" ? (
            <Loader2 className="mr-2 size-4 animate-spin" />
          ) : (
            <FileSpreadsheet className="mr-2 size-4" />
          )}
          Export CSV
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleExportPDF}
          disabled={exporting !== null}
        >
          {exporting === "pdf" ? (
            <Loader2 className="mr-2 size-4 animate-spin" />
          ) : (
            <FileDown className="mr-2 size-4" />
          )}
          Export PDF
        </Button>
      </div>
    </div>
  );
}
