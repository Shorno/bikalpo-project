"use client";

import { useQueryState } from "nuqs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { searchParamsParsers } from "@/lib/search-params";

interface Category {
  id: number;
  name: string;
  slug: string;
}

interface FiltersProps {
  categories: Category[];
}

export function Filters({ categories }: FiltersProps) {
  // ─────────────────────────────────────────────────────────────────
  // URL State via nuqs - No useState, No useSearchParams
  // ─────────────────────────────────────────────────────────────────

  // Category filter (slug string) - Server supported
  const [category, setCategory] = useQueryState(
    "category",
    searchParamsParsers.category,
  );

  // Price filters (numbers) - Server supported
  const [minPrice, setMinPrice] = useQueryState(
    "minPrice",
    searchParamsParsers.minPrice,
  );
  const [maxPrice, setMaxPrice] = useQueryState(
    "maxPrice",
    searchParamsParsers.maxPrice,
  );

  // Sort filter - Server supported
  const [sort, setSort] = useQueryState("sort", searchParamsParsers.sort);

  // ─────────────────────────────────────────────────────────────────
  // Brand filter - UI-ready, backend pending
  // Updates URL but does NOT affect server results
  // Will be connected when brands table is added
  // ─────────────────────────────────────────────────────────────────
  const [brand, setBrand] = useQueryState("brand", searchParamsParsers.brand);

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-gray-900">Filters</h2>

      {/* ─────────────────────────────────────────────────────────── */}
      {/* Category Filter - Server Supported                         */}
      {/* ─────────────────────────────────────────────────────────── */}
      <fieldset className="space-y-2">
        <Label htmlFor="category-select">Category</Label>
        <Select
          value={category ?? "all"}
          onValueChange={(val) => setCategory(val === "all" ? null : val)}
        >
          <SelectTrigger id="category-select" aria-label="Select category">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat.id} value={cat.slug}>
                {cat.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </fieldset>

      {/* ─────────────────────────────────────────────────────────── */}
      {/* Brand Filter - UI-ready, backend pending                   */}
      {/* Updates URL only, server ignores this filter               */}
      {/* ─────────────────────────────────────────────────────────── */}
      <fieldset className="space-y-2">
        <Label htmlFor="brand-select">
          Brand
          <span className="ml-2 text-xs text-gray-400">(coming soon)</span>
        </Label>
        <Select
          value={brand ?? "all"}
          onValueChange={(val) => setBrand(val === "all" ? null : val)}
        >
          <SelectTrigger id="brand-select" aria-label="Select brand">
            <SelectValue placeholder="All Brands" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Brands</SelectItem>
            {/* Brands will be populated when brands table is added */}
          </SelectContent>
        </Select>
      </fieldset>

      {/* ─────────────────────────────────────────────────────────── */}
      {/* Price Range - Server Supported                             */}
      {/* ─────────────────────────────────────────────────────────── */}
      <fieldset className="space-y-3">
        <Label>Price Range</Label>
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <Label htmlFor="min-price" className="sr-only">
              Minimum Price
            </Label>
            <Input
              id="min-price"
              type="number"
              min={0}
              step="0.01"
              placeholder="Min"
              aria-label="Minimum price"
              value={minPrice ?? ""}
              onChange={(e) =>
                setMinPrice(e.target.value ? parseFloat(e.target.value) : null)
              }
            />
          </div>
          <span className="text-gray-400" aria-hidden="true">
            —
          </span>
          <div className="flex-1">
            <Label htmlFor="max-price" className="sr-only">
              Maximum Price
            </Label>
            <Input
              id="max-price"
              type="number"
              min={0}
              step="0.01"
              placeholder="Max"
              aria-label="Maximum price"
              value={maxPrice ?? ""}
              onChange={(e) =>
                setMaxPrice(e.target.value ? parseFloat(e.target.value) : null)
              }
            />
          </div>
        </div>
      </fieldset>

      {/* ─────────────────────────────────────────────────────────── */}
      {/* Sort By - Server Supported                                 */}
      {/* ─────────────────────────────────────────────────────────── */}
      <fieldset className="space-y-2">
        <Label htmlFor="sort-select">Sort By</Label>
        <Select
          value={sort ?? "newest"}
          onValueChange={(val) => setSort(val === "newest" ? null : val)}
        >
          <SelectTrigger id="sort-select" aria-label="Sort products by">
            <SelectValue placeholder="Newest" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest</SelectItem>
            <SelectItem value="price_asc">Price: Low to High</SelectItem>
            <SelectItem value="price_desc">Price: High to Low</SelectItem>
            <SelectItem value="name_asc">Name: A to Z</SelectItem>
            <SelectItem value="name_desc">Name: Z to A</SelectItem>
          </SelectContent>
        </Select>
      </fieldset>
    </div>
  );
}
