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
import { useIsMobile } from "@/hooks/use-mobile";
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
  const isMobile = useIsMobile();
  const searchParams = useSearchParams();
  const searchParamsRef = useRef(searchParams);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const typeId = searchParams.get("type") ?? "all";
  const categoryId = searchParams.get("category") ?? "all";
  const subCategoryId = searchParams.get("subcategory") ?? "all";
  const coreProductId = searchParams.get("core") ?? "all";

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
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    setSearch(searchParams.get("search") ?? "");
  }, [searchParams]);
  useEffect(
    () => () => {
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
    },
    [],
  );

  const pushUrl = useCallback(
    (mutate: (params: URLSearchParams) => void) => {
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
      const params = new URLSearchParams(searchParamsRef.current.toString());
      params.delete("page");
      if (search.trim()) params.set("search", search.trim());
      else params.delete("search");
      mutate(params);
      router.push(ROUTE + (params.size ? "?" + params.toString() : ""), {
        scroll: false,
      });
    },
    [router, search],
  );

  const changeSearch = (value: string) => {
    setSearch(value);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      const params = new URLSearchParams(searchParamsRef.current.toString());
      params.delete("page");
      if (value.trim()) params.set("search", value.trim());
      else params.delete("search");
      router.replace(ROUTE + (params.size ? "?" + params.toString() : ""), {
        scroll: false,
      });
    }, 300);
  };

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
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    setSearch("");
    router.push(ROUTE);
  };

  return (
    <section className="space-y-4 rounded-xl border bg-card p-4 shadow-sm max-md:p-3 max-md:[&_input]:h-11 max-md:[&_[data-slot=select-trigger]]:w-full max-md:[&_[data-slot=select-trigger]]:min-w-0 max-md:[&_[data-slot=select-trigger]]:h-11 max-md:[&_[data-slot=select-trigger]]:text-xs max-md:[&_[data-slot=select-value]]:block max-md:[&_[data-slot=select-value]]:min-w-0 max-md:[&_[data-slot=select-value]]:truncate">
      {/* Search */}
      <div className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search Product / Brand / SKU / Barcode"
            aria-label="Search Product / Brand / SKU / Barcode"
            maxLength={200}
            value={search}
            onChange={(e) => changeSearch(e.target.value)}
          />
        </div>
        {
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="shrink-0 gap-1.5 text-muted-foreground"
            onClick={clearAll}
            disabled={!hasActiveFilters}
          >
            <X className="h-4 w-4" />
            Reset Filter
          </Button>
        }
      </div>

      {/* Cascading selects */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 max-md:grid-cols-2">
        <FilterField label="Type">
          <Select
            value={typeId}
            onValueChange={(v) => {
              pushUrl((p) => {
                if (v === "all") p.delete("type");
                else p.set("type", v);
                p.delete("category");
                p.delete("subcategory");
                p.delete("core");
              });
            }}
          >
            <SelectTrigger aria-label="Type">
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent
              position={isMobile ? "popper" : "item-aligned"}
              className="max-md:max-w-[calc(100vw-2rem)] max-md:[&_[data-slot=select-item]]:whitespace-normal"
            >
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
              pushUrl((p) => {
                if (v === "all") p.delete("category");
                else p.set("category", v);
                p.delete("subcategory");
                p.delete("core");
              });
            }}
          >
            <SelectTrigger aria-label="Category">
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent
              position={isMobile ? "popper" : "item-aligned"}
              className="max-md:max-w-[calc(100vw-2rem)] max-md:[&_[data-slot=select-item]]:whitespace-normal"
            >
              <SelectItem value="all">All categories</SelectItem>
              {filteredCategories.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>

        <FilterField label="Sub-Category">
          <Select
            value={subCategoryId}
            disabled={categoryId === "all"}
            onValueChange={(v) => {
              pushUrl((p) => {
                if (v === "all") p.delete("subcategory");
                else p.set("subcategory", v);
                p.delete("core");
              });
            }}
          >
            <SelectTrigger aria-label="Sub-Category">
              <SelectValue
                placeholder={
                  categoryId === "all"
                    ? "Select category first"
                    : "All sub categories"
                }
              />
            </SelectTrigger>
            <SelectContent
              position={isMobile ? "popper" : "item-aligned"}
              className="max-md:max-w-[calc(100vw-2rem)] max-md:[&_[data-slot=select-item]]:whitespace-normal"
            >
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
              pushUrl((p) => {
                if (v === "all") p.delete("core");
                else p.set("core", v);
              });
            }}
          >
            <SelectTrigger aria-label="Core Identity">
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
            <SelectContent
              position={isMobile ? "popper" : "item-aligned"}
              className="max-md:max-w-[calc(100vw-2rem)] max-md:[&_[data-slot=select-item]]:whitespace-normal"
            >
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
    <div className="space-y-1.5 max-md:min-w-0">
      <Label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}
