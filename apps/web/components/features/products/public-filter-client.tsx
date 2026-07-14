"use client";

import type { Brand, Category, SubCategory } from "@bikalpo-project/db/schema";
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
    <div className="sticky top-28 hidden overflow-hidden rounded-md border bg-background lg:block">
      <div className="flex items-center justify-between border-b bg-muted/40 px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Filter size={16} className="text-primary" />
          Filters
        </div>
        {hasActiveFilters && (
          <button
            onClick={clearAllFilters}
            className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground hover:underline hover:underline-offset-4"
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
                  <span className="rounded-sm bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
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
                    className="h-3.5 w-3.5 border-border text-primary"
                  />
                  <Label
                    htmlFor="cat-all"
                    className="cursor-pointer text-xs font-normal text-muted-foreground"
                  >
                    All Categories
                  </Label>
                </div>
                {categories.map((cat) => (
                  <div key={cat.id} className="flex items-center gap-2">
                    <RadioGroupItem
                      value={cat.slug}
                      id={cat.slug}
                      className="h-3.5 w-3.5 border-border text-primary"
                    />
                    <Label
                      htmlFor={cat.slug}
                      className="cursor-pointer text-xs font-normal text-muted-foreground"
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
                  <span className="rounded-sm bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
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
                      className="h-3.5 w-3.5 rounded-sm data-[state=checked]:border-primary data-[state=checked]:bg-primary"
                    />
                    <Label
                      htmlFor={sub.slug}
                      className="cursor-pointer text-xs text-muted-foreground"
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
                  <span className="rounded-sm bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
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
                      className="h-3.5 w-3.5 rounded-sm data-[state=checked]:border-primary data-[state=checked]:bg-primary"
                    />
                    <Label
                      htmlFor={`brand-${b.slug}`}
                      className="cursor-pointer text-xs text-muted-foreground"
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
