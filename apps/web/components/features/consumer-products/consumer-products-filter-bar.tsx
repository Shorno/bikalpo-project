"use client";

import { useQuery } from "@tanstack/react-query";
import { Search, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
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
import { orpc } from "@/utils/orpc";

export type CategoryOption = {
  id: number;
  name: string;
  typeId: number | null;
  subCategory: { id: number; name: string }[];
};

interface ConsumerProductsFilterBarProps {
  types: { id: number; name: string }[];
  categories: CategoryOption[];
}

export function ConsumerProductsFilterBar({
  types,
  categories,
}: ConsumerProductsFilterBarProps) {
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
      mutate(p);
      router.push(
        `${ADMIN_BASE}/consumer-products${p.toString() ? `?${p}` : ""}`,
      );
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
    router.push(`${ADMIN_BASE}/consumer-products`);
  };

  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-card p-3">
      {/* Row 1: search + clear */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            className="h-9 pl-9 text-sm"
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
            className="h-9 gap-1 text-xs text-muted-foreground shrink-0"
            onClick={clearAll}
          >
            <X className="h-3.5 w-3.5" />
            Clear
          </Button>
        )}
      </div>

      {/* Row 2: cascading selects */}
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
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
          <SelectTrigger className="h-9 text-sm">
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
          <SelectTrigger className="h-9 text-sm">
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
          <SelectTrigger className="h-9 text-sm">
            <SelectValue placeholder={categoryId === "all" ? "Sub category" : "All sub categories"} />
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
          <SelectTrigger className="h-9 text-sm">
            <SelectValue
              placeholder={
                !catNum
                  ? "Core identity"
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
      </div>
    </div>
  );
}
