"use client";

import { useQueryState } from "nuqs";
import { PublicMobileFilter } from "@/components/features/products/public-mobile-filter";
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

interface PublicProductsSortProps {
  categories?: Category[];
  subCategories?: SubCategory[];
  brands?: Brand[];
  currentCategorySlug?: string;
}

export function PublicProductsSort({
  categories = [],
  subCategories = [],
  brands = [],
  currentCategorySlug,
}: PublicProductsSortProps) {
  const [sort, setSort] = useQueryState("sort", { shallow: false });

  const handleSortChange = (value: string) => {
    setSort(value === "newest" ? null : value);
  };

  const currentSort = sort || "newest";

  return (
    <div className="flex items-center gap-2 justify-between w-full lg:w-auto">
      {/* Mobile Filter Button */}
      <div className="lg:hidden">
        <PublicMobileFilter
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
          className="text-sm hidden sm:inline text-neutral-600"
        >
          Sort by:
        </Label>
        <Select value={currentSort} onValueChange={handleSortChange}>
          <SelectTrigger id="sort" className="w-35 sm:w-45">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest First</SelectItem>
            <SelectItem value="name-asc">Name: A to Z</SelectItem>
            <SelectItem value="name-desc">Name: Z to A</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
