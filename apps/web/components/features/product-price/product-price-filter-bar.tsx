"use client";

import { useQuery } from "@tanstack/react-query";
import { Search, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDebounce } from "@/hooks/use-debounce";
import { ADMIN_BASE } from "@/lib/routes";
import { orpc } from "@/utils/orpc";

const ROUTE = `${ADMIN_BASE}/product-price`;

export type CategoryOption = {
  id: number;
  name: string;
  typeId: number | null;
  subCategory: { id: number; name: string }[];
};

interface ProductPriceFilterBarProps {
  types: { id: number; name: string }[];
  categories: CategoryOption[];
}

export function ProductPriceFilterBar({
  types,
  categories,
}: ProductPriceFilterBarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchParamsRef = useRef(searchParams);
  const lastPushedSearchRef = useRef("");
  const isFirstSearchEffect = useRef(true);

  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const [typeId, setTypeId] = useState(searchParams.get("type") ?? "all");
  const [categoryId, setCategoryId] = useState(
    searchParams.get("category") ?? "all",
  );
  const [subCategoryId, setSubCategoryId] = useState(
    searchParams.get("subcategory") ?? "all",
  );
  const [coreProductId, setCoreProductId] = useState(
    searchParams.get("core") ?? "all",
  );

  const debouncedSearch = useDebounce(search, 300);

  const catNum =
    categoryId && categoryId !== "all" ? Number(categoryId) : undefined;
  const subNum =
    subCategoryId && subCategoryId !== "all"
      ? Number(subCategoryId)
      : undefined;

  const { data: coreData, isPending: corePending } = useQuery({
    ...orpc.adminCoreProduct.getAll.queryOptions({
      input: {
        categoryId: catNum,
        subCategoryId: subNum,
        status: "active",
      },
    }),
    enabled: !!catNum,
  });
  const coreProducts = coreData?.coreProducts ?? [];

  useEffect(() => {
    searchParamsRef.current = searchParams;
  }, [searchParams]);

  useEffect(() => {
    const urlSearch = searchParams.get("search") ?? "";
    if (urlSearch !== lastPushedSearchRef.current) {
      setSearch(urlSearch);
      lastPushedSearchRef.current = urlSearch;
    }
    setTypeId(searchParams.get("type") ?? "all");
    setCategoryId(searchParams.get("category") ?? "all");
    setSubCategoryId(searchParams.get("subcategory") ?? "all");
    setCoreProductId(searchParams.get("core") ?? "all");
  }, [searchParams]);

  const pushUrl = useCallback(
    (mutate: (p: URLSearchParams) => void) => {
      const p = new URLSearchParams(searchParamsRef.current.toString());
      p.delete("page"); // any filter/search change returns to the first page
      mutate(p);
      router.push(`${ROUTE}${p.toString() ? `?${p}` : ""}`);
    },
    [router],
  );

  useEffect(() => {
    if (isFirstSearchEffect.current) {
      isFirstSearchEffect.current = false;
      return;
    }
    pushUrl((p) => {
      if (debouncedSearch.trim()) p.set("search", debouncedSearch.trim());
      else p.delete("search");
    });
    lastPushedSearchRef.current = debouncedSearch.trim();
  }, [debouncedSearch, pushUrl]);

  const filteredCategories =
    typeId && typeId !== "all"
      ? categories.filter((c) => c.typeId === Number(typeId))
      : categories;

  const selectedCategory = categories.find((c) => c.id === Number(categoryId));
  const subcategories =
    categoryId && categoryId !== "all"
      ? (selectedCategory?.subCategory ?? [])
      : [];

  const hasActiveFilters =
    typeId !== "all" ||
    categoryId !== "all" ||
    subCategoryId !== "all" ||
    coreProductId !== "all" ||
    !!search.trim();

  const clearAll = () => {
    setSearch("");
    setTypeId("all");
    setCategoryId("all");
    setSubCategoryId("all");
    setCoreProductId("all");
    router.push(ROUTE);
  };

  return (
    <section className="space-y-4 rounded-xl border bg-card p-4 shadow-sm">
      {/* Search */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search product, SKU, brand, variant…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {hasActiveFilters && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="shrink-0 gap-1.5 text-muted-foreground"
            onClick={clearAll}
          >
            <X className="h-4 w-4" />
            Clear
          </Button>
        )}
      </div>

      {/* Cascading selects */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <FilterField label="Type">
          <Select
            value={typeId}
            onValueChange={(v) => {
              setTypeId(v);
              setCategoryId("all");
              setSubCategoryId("all");
              setCoreProductId("all");
              pushUrl((p) => {
                if (v === "all") p.delete("type");
                else p.set("type", v);
                p.delete("category");
                p.delete("subcategory");
                p.delete("core");
              });
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {types.map((t) => (
                <SelectItem key={t.id} value={String(t.id)}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>

        <FilterField label="Category">
          <Select
            value={categoryId}
            onValueChange={(v) => {
              setCategoryId(v);
              setSubCategoryId("all");
              setCoreProductId("all");
              pushUrl((p) => {
                if (v === "all") p.delete("category");
                else p.set("category", v);
                p.delete("subcategory");
                p.delete("core");
              });
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {filteredCategories.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>

        <FilterField label="Sub Category">
          <Select
            value={subCategoryId}
            disabled={categoryId === "all"}
            onValueChange={(v) => {
              setSubCategoryId(v);
              setCoreProductId("all");
              pushUrl((p) => {
                if (v === "all") p.delete("subcategory");
                else p.set("subcategory", v);
                p.delete("core");
              });
            }}
          >
            <SelectTrigger>
              <SelectValue
                placeholder={
                  categoryId === "all" ? "Select category first" : "All sub categories"
                }
              />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sub categories</SelectItem>
              {subcategories.map((sc) => (
                <SelectItem key={sc.id} value={String(sc.id)}>
                  {sc.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>

        <FilterField label="Core Identity">
          <Select
            value={coreProductId}
            disabled={!catNum}
            onValueChange={(v) => {
              setCoreProductId(v);
              pushUrl((p) => {
                if (v === "all") p.delete("core");
                else p.set("core", v);
              });
            }}
          >
            <SelectTrigger>
              <SelectValue
                placeholder={
                  !catNum
                    ? "Select category first"
                    : corePending
                      ? "Loading…"
                      : "All core products"
                }
              />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All core products</SelectItem>
              {coreProducts.map((cp: { id: number; name: string }) => (
                <SelectItem key={cp.id} value={String(cp.id)}>
                  {cp.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>
      </div>
    </section>
  );
}

function FilterField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}
