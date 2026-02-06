"use client";

import { useQueryState } from "nuqs";
import { MobileFilter } from "@/components/features/products/mobile-filter";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Category, SubCategory } from "@/db/schema";
import type { Brand } from "@/db/schema/brand";

interface ProductsSortProps {
  categories?: Category[];
  subCategories?: SubCategory[];
  brands?: Brand[];
  currentCategorySlug?: string;
}

export function ProductsSort({
  categories = [],
  subCategories = [],
  brands = [],
  currentCategorySlug,
}: ProductsSortProps) {
  const [sort, setSort] = useQueryState("sort", { shallow: false });

  const handleSortChange = (value: string) => {
    setSort(value === "newest" ? null : value);
  };

  const currentSort = sort || "newest";

  return (
    <div className="flex items-center gap-2 justify-between w-full lg:w-auto">
      {/* Mobile Filter Button */}
      <div className="lg:hidden">
        <MobileFilter
          categories={categories}
          subCategories={subCategories}
          brands={brands}
          currentCategorySlug={currentCategorySlug}
        />
      </div>

      {/* Sort Dropdown */}
      <div className="flex items-center gap-2">
        <Label
          htmlFor="sort"
          className="text-sm hidden sm:inline text-gray-500 font-medium"
        >
          Sort by:
        </Label>
        <Select value={currentSort} onValueChange={handleSortChange}>
          <SelectTrigger
            id="sort"
            className="w-35 sm:w-45 bg-white/50 border-gray-200 focus:ring-emerald-500"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest First</SelectItem>
            <SelectItem value="price-asc">Price: Low to High</SelectItem>
            <SelectItem value="price-desc">Price: High to Low</SelectItem>
            <SelectItem value="name-asc">Name: A to Z</SelectItem>
            <SelectItem value="name-desc">Name: Z to A</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
