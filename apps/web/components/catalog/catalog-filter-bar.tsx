"use client";

import { Search, X, SlidersHorizontal } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

type FilterOption = { id: number; name: string; slug: string };
type CategoryOption = FilterOption & { typeId: number | null };
type SubCategoryOption = FilterOption & { categoryId: number };

interface CatalogFilterBarProps {
  types: FilterOption[];
  categories: CategoryOption[];
  subCategories: SubCategoryOption[];
  selectedTypeId: number | undefined;
  selectedCategoryId: number | undefined;
  selectedSubCategoryId: number | undefined;
  search: string;
  onTypeChange: (typeId: number | undefined) => void;
  onCategoryChange: (categoryId: number | undefined) => void;
  onSubCategoryChange: (subCategoryId: number | undefined) => void;
  onSearchChange: (search: string) => void;
  totalCount: number;
}

export function CatalogFilterBar({
  types,
  categories,
  subCategories,
  selectedTypeId,
  selectedCategoryId,
  selectedSubCategoryId,
  search,
  onTypeChange,
  onCategoryChange,
  onSubCategoryChange,
  onSearchChange,
  totalCount,
}: CatalogFilterBarProps) {
  // Cascade: filter categories by type, subcategories by category
  const filteredCategories = selectedTypeId
    ? categories.filter((c) => c.typeId === selectedTypeId)
    : categories;

  const filteredSubCategories = selectedCategoryId
    ? subCategories.filter((sc) => sc.categoryId === selectedCategoryId)
    : [];

  const hasFilters = selectedTypeId || selectedCategoryId || selectedSubCategoryId || search;

  const clearAll = () => {
    onTypeChange(undefined);
    onCategoryChange(undefined);
    onSubCategoryChange(undefined);
    onSearchChange("");
  };

  return (
    <div className="space-y-3">
      {/* Search + Filters Row */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search products..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 h-9"
          />
          {search && (
            <button
              onClick={() => onSearchChange("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded-sm hover:bg-gray-100"
            >
              <X className="h-3.5 w-3.5 text-gray-400" />
            </button>
          )}
        </div>

        {/* Type */}
        <Select
          value={selectedTypeId?.toString() ?? "all"}
          onValueChange={(v) => {
            const newType = v === "all" ? undefined : Number(v);
            onTypeChange(newType);
            onCategoryChange(undefined);
            onSubCategoryChange(undefined);
          }}
        >
          <SelectTrigger className="w-full sm:w-[160px] h-9">
            <SlidersHorizontal className="h-3.5 w-3.5 mr-1.5 text-gray-400 shrink-0" />
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {types.map((t) => (
              <SelectItem key={t.id} value={t.id.toString()}>{t.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Category */}
        <Select
          value={selectedCategoryId?.toString() ?? "all"}
          onValueChange={(v) => {
            const newCat = v === "all" ? undefined : Number(v);
            onCategoryChange(newCat);
            onSubCategoryChange(undefined);
          }}
        >
          <SelectTrigger className="w-full sm:w-[160px] h-9">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {filteredCategories.map((c) => (
              <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Sub Category */}
        {filteredSubCategories.length > 0 && (
          <Select
            value={selectedSubCategoryId?.toString() ?? "all"}
            onValueChange={(v) => {
              onSubCategoryChange(v === "all" ? undefined : Number(v));
            }}
          >
            <SelectTrigger className="w-full sm:w-[160px] h-9">
              <SelectValue placeholder="All Sub Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sub Categories</SelectItem>
              {filteredSubCategories.map((sc) => (
                <SelectItem key={sc.id} value={sc.id.toString()}>{sc.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Active Filters + Count */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-gray-500">
            {totalCount} {totalCount === 1 ? "product" : "products"}
          </span>
          {hasFilters && (
            <>
              <span className="text-gray-300">|</span>
              {selectedTypeId && (
                <Badge variant="secondary" className="gap-1 text-xs">
                  {types.find((t) => t.id === selectedTypeId)?.name}
                  <button onClick={() => { onTypeChange(undefined); onCategoryChange(undefined); onSubCategoryChange(undefined); }}>
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              {selectedCategoryId && (
                <Badge variant="secondary" className="gap-1 text-xs">
                  {categories.find((c) => c.id === selectedCategoryId)?.name}
                  <button onClick={() => { onCategoryChange(undefined); onSubCategoryChange(undefined); }}>
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              {selectedSubCategoryId && (
                <Badge variant="secondary" className="gap-1 text-xs">
                  {subCategories.find((sc) => sc.id === selectedSubCategoryId)?.name}
                  <button onClick={() => onSubCategoryChange(undefined)}>
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              {search && (
                <Badge variant="secondary" className="gap-1 text-xs">
                  &quot;{search}&quot;
                  <button onClick={() => onSearchChange("")}>
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              <Button variant="ghost" size="sm" onClick={clearAll} className="h-6 px-2 text-xs text-gray-500">
                Clear all
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
