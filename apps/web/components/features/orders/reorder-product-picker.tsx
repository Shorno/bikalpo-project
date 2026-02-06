"use client";

import { useQuery } from "@tanstack/react-query";
import { Loader2, Package, Plus, Search } from "lucide-react";
import Image from "next/image";
import * as React from "react";
import { searchProducts } from "@/actions/products/search-products";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useDebounce } from "@/hooks/use-debounce";

interface ReorderProduct {
  id: number;
  name: string;
  slug: string;
  image: string;
  price: string;
  size: string;
  stockQuantity: number;
  inStock: boolean;
}

interface ReorderProductPickerProps {
  onSelect: (product: ReorderProduct) => void;
  excludeProductIds?: number[];
}

export function ReorderProductPicker({
  onSelect,
  excludeProductIds = [],
}: ReorderProductPickerProps) {
  const [open, setOpen] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState("");
  const debouncedSearch = useDebounce(searchTerm, 300);

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["reorder-products-search", debouncedSearch],
    queryFn: async () => {
      if (!debouncedSearch.trim()) return [];
      const results = await searchProducts(debouncedSearch);
      return results as ReorderProduct[];
    },
    enabled: open && debouncedSearch.trim().length > 0,
    staleTime: 1000 * 60 * 5,
  });

  // Filter out already added products and out of stock items
  const filteredProducts = products
    .filter((product) => !excludeProductIds.includes(product.id))
    .filter((product) => product.stockQuantity > 0);

  const handleSelect = (product: ReorderProduct) => {
    onSelect(product);
    setOpen(false);
    setSearchTerm("");
  };

  return (
    <div className="w-full">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className="w-full justify-start gap-2 h-11 px-4 border-dashed border-emerald-300 bg-emerald-50/50 hover:bg-emerald-50 hover:border-emerald-400 text-emerald-700 transition-all"
          >
            <Plus className="h-4 w-4" />
            <span>Add More Products</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[400px] max-w-[calc(100vw-2rem)] p-0"
          align="start"
          sideOffset={4}
        >
          <div className="flex flex-col max-h-[350px]">
            <div className="flex items-center border-b px-3 bg-muted/20">
              <Search className="mr-2 h-4 w-4 shrink-0 opacity-50 text-muted-foreground" />
              <input
                className="flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground/60 disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="Search products to add..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                // biome-ignore lint/a11y/noAutofocus: <works>
                autoFocus
              />
            </div>
            <div className="overflow-y-auto p-1">
              {!searchTerm.trim() && (
                <div className="py-8 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
                  <Search className="h-6 w-6 opacity-20" />
                  <span>Type to search products</span>
                </div>
              )}
              {searchTerm.trim() && isLoading && (
                <div className="flex flex-col items-center justify-center p-8 text-muted-foreground gap-2">
                  <Loader2 className="animate-spin h-6 w-6" />
                  <span className="text-xs font-medium">Searching...</span>
                </div>
              )}
              {searchTerm.trim() &&
                !isLoading &&
                filteredProducts.length === 0 && (
                  <div className="py-8 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
                    <Package className="h-6 w-6 opacity-20" />
                    <span>No products found</span>
                  </div>
                )}
              {!isLoading &&
                filteredProducts.map((product) => (
                  <div
                    key={product.id}
                    className="relative flex cursor-pointer select-none items-center rounded-lg px-3 py-2.5 text-sm hover:bg-emerald-50 group transition-colors"
                    onClick={() => handleSelect(product)}
                  >
                    <div className="flex items-center gap-3 w-full">
                      <div className="h-12 w-12 rounded-lg border bg-muted/30 overflow-hidden flex-shrink-0">
                        {product.image ? (
                          <Image
                            width={48}
                            height={48}
                            src={product.image}
                            alt={product.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center">
                            <Package className="h-5 w-5 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col flex-1 overflow-hidden">
                        <span className="truncate font-medium text-foreground/90 group-hover:text-emerald-700 transition-colors">
                          {product.name}
                        </span>
                        <div className="flex items-center justify-between text-xs mt-0.5">
                          <span className="text-muted-foreground/80">
                            {product.size} • Stock: {product.stockQuantity}
                          </span>
                          <span className="font-bold text-emerald-600">
                            ৳{Number(product.price).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
