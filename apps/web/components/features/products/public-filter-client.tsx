"use client";

import { Filter, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { parseAsString, useQueryStates } from "nuqs";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { Category, SubCategory } from "@/db/schema";
import type { Brand } from "@/db/schema/brand";

interface PublicFilterClientProps {
  categories: Category[];
  subCategories: SubCategory[];
  brands: Brand[];
  currentCategorySlug?: string;
}

// Define parsers for all filter states
const filterParsers = {
  category: parseAsString,
  subcategory: parseAsString,
  brand: parseAsString,
};

export function PublicFilterClient({
  categories,
  subCategories,
  brands,
  currentCategorySlug,
}: PublicFilterClientProps) {
  const router = useRouter();

  // Use useQueryStates for batched updates
  const [filters, setFilters] = useQueryStates(filterParsers, {
    shallow: false,
  });

  const handleCategoryChange = (val: string) => {
    const slug = val === "all" || val === "" ? null : val;

    if (currentCategorySlug) {
      const params = new URLSearchParams(window.location.search);
      if (slug) params.set("category", slug);
      else params.delete("category");

      router.push(`/products?${params.toString()}`);
    } else {
      setFilters({ category: slug });
    }
  };

  const handleMultiSelectChange = (
    key: "subcategory" | "brand",
    checked: boolean,
    slug: string,
  ) => {
    const currentValue = filters[key];
    const values = currentValue?.split(",").filter(Boolean) || [];
    let newValues: string[];

    if (checked) {
      newValues = [...values, slug];
    } else {
      newValues = values.filter((v) => v !== slug);
    }

    setFilters({ [key]: newValues.length > 0 ? newValues.join(",") : null });
  };

  const clearAllFilters = () => {
    // Batch clear all filters in a single update
    setFilters({
      category: null,
      subcategory: null,
      brand: null,
    });
  };

  const hasActiveFilters = !!(
    filters.category ||
    filters.subcategory ||
    filters.brand
  );

  // Get active filter counts for badges
  const categoryCount = filters.category ? 1 : 0;
  const subcategoryCount =
    filters.subcategory?.split(",").filter(Boolean).length || 0;
  const brandCount = filters.brand?.split(",").filter(Boolean).length || 0;

  return (
    <div className="sticky top-20 hidden lg:block bg-white border rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50/80">
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
          <Filter size={16} className="text-blue-600" />
          Filters
        </div>
        {hasActiveFilters && (
          // biome-ignore lint/a11y/useButtonType: ...
          <button
            onClick={clearAllFilters}
            className="text-xs text-gray-500 hover:text-red-500 flex items-center gap-1 transition-colors"
          >
            <X size={12} />
            Clear
          </button>
        )}
      </div>

      <Accordion
        type="multiple"
        defaultValue={["category", "subcategory", "brand"]}
        className="w-full"
      >
        {/* Categories */}
        {!currentCategorySlug && categories.length > 0 && (
          <AccordionItem value="category" className="border-b">
            <AccordionTrigger className="px-4 py-2.5 text-sm font-medium hover:no-underline hover:bg-gray-50/50">
              <div className="flex items-center gap-2">
                Category
                {categoryCount > 0 && (
                  <span className="bg-blue-100 text-blue-700 text-[10px] font-semibold px-1.5 py-0.5 rounded-full">
                    {categoryCount}
                  </span>
                )}
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-3">
              <RadioGroup
                value={filters.category || ""}
                onValueChange={handleCategoryChange}
                className="space-y-1"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem
                    value=""
                    id="cat-all"
                    className="h-3.5 w-3.5 border-gray-300 text-blue-600"
                  />
                  <Label
                    htmlFor="cat-all"
                    className="text-xs font-normal cursor-pointer text-gray-600"
                  >
                    All Categories
                  </Label>
                </div>
                {categories.map((cat) => (
                  <div key={cat.id} className="flex items-center gap-2">
                    <RadioGroupItem
                      value={cat.slug}
                      id={cat.slug}
                      className="h-3.5 w-3.5 border-gray-300 text-blue-600"
                    />
                    <Label
                      htmlFor={cat.slug}
                      className="text-xs font-normal cursor-pointer text-gray-600"
                    >
                      {cat.name}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </AccordionContent>
          </AccordionItem>
        )}

        {/* Sub Categories */}
        {subCategories.length > 0 && (
          <AccordionItem value="subcategory" className="border-b">
            <AccordionTrigger className="px-4 py-2.5 text-sm font-medium hover:no-underline hover:bg-gray-50/50">
              <div className="flex items-center gap-2">
                Sub Category
                {subcategoryCount > 0 && (
                  <span className="bg-blue-100 text-blue-700 text-[10px] font-semibold px-1.5 py-0.5 rounded-full">
                    {subcategoryCount}
                  </span>
                )}
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-3">
              <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                {subCategories.map((sub) => (
                  <div key={sub.id} className="flex items-center gap-2">
                    <Checkbox
                      id={sub.slug}
                      checked={
                        filters.subcategory?.split(",").includes(sub.slug) ??
                        false
                      }
                      onCheckedChange={(checked) =>
                        handleMultiSelectChange(
                          "subcategory",
                          checked as boolean,
                          sub.slug,
                        )
                      }
                      className="h-3.5 w-3.5 rounded-sm data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                    />
                    <Label
                      htmlFor={sub.slug}
                      className="text-xs cursor-pointer text-gray-600"
                    >
                      {sub.name}
                    </Label>
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        )}

        {/* Brands */}
        {brands.length > 0 && (
          <AccordionItem value="brand" className="border-b">
            <AccordionTrigger className="px-4 py-2.5 text-sm font-medium hover:no-underline hover:bg-gray-50/50">
              <div className="flex items-center gap-2">
                Brand
                {brandCount > 0 && (
                  <span className="bg-blue-100 text-blue-700 text-[10px] font-semibold px-1.5 py-0.5 rounded-full">
                    {brandCount}
                  </span>
                )}
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-3">
              <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                {brands.map((b) => (
                  <div key={b.id} className="flex items-center gap-2">
                    <Checkbox
                      id={`brand-${b.slug}`}
                      checked={
                        filters.brand?.split(",").includes(b.slug) ?? false
                      }
                      onCheckedChange={(checked) =>
                        handleMultiSelectChange(
                          "brand",
                          checked as boolean,
                          b.slug,
                        )
                      }
                      className="h-3.5 w-3.5 rounded-sm data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                    />
                    <Label
                      htmlFor={`brand-${b.slug}`}
                      className="text-xs cursor-pointer text-gray-600"
                    >
                      {b.name}
                    </Label>
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        )}
      </Accordion>
    </div>
  );
}
