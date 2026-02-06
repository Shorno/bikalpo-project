"use client";

import { useQuery } from "@tanstack/react-query";
import { ChevronsUpDown, Loader2, Package, Search } from "lucide-react";
import Image from "next/image";
import * as React from "react";
import getProducts from "@/actions/product/get-products";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { Product } from "@/db/schema/product";

interface ProductPickerProps {
  onSelect: (product: Product) => void;
  selectedProductIds?: number[];
}

export function ProductPicker({
  onSelect,
  selectedProductIds = [],
}: ProductPickerProps) {
  const [open, setOpen] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState("");

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["estimate-products"],
    queryFn: async () => {
      const data = await getProducts();
      return data as Product[];
    },
    enabled: open,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Filter out already selected products and apply search filter
  const filteredProducts = products
    .filter((product) => !selectedProductIds.includes(product.id))
    .filter((product) =>
      product.name.toLowerCase().includes(searchTerm.toLowerCase()),
    );

  return (
    <div className="w-full">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between h-10 px-4 bg-background hover:border-primary hover:bg-muted/30 transition-all"
          >
            <div className="flex items-center gap-2">
              <Search className="size-4 text-muted-foreground" />
              <span className="text-muted-foreground">
                Select product to add...
              </span>
            </div>
            <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[500px] max-w-[calc(100vw-2rem)] p-0"
          align="start"
          sideOffset={4}
        >
          <div className="flex flex-col max-h-[400px]">
            <div className="flex items-center border-b px-3 bg-muted/20">
              <Search className="mr-2 h-4 w-4 shrink-0 opacity-50 text-muted-foreground" />
              <input
                className="flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground/60 disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="Search products by name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="overflow-y-auto p-1 custom-scrollbar">
              {isLoading && (
                <div className="flex flex-col items-center justify-center p-8 text-muted-foreground gap-2">
                  <Loader2 className="animate-spin size-6" />
                  <span className="text-xs font-medium">
                    Loading products...
                  </span>
                </div>
              )}
              {!isLoading && filteredProducts.length === 0 && (
                <div className="py-12 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
                  <Package className="size-8 opacity-20" />
                  <span>No products found matching your search.</span>
                </div>
              )}
              {!isLoading &&
                filteredProducts.map((product) => (
                  <div
                    key={product.id}
                    className="relative flex cursor-pointer select-none items-center rounded-lg px-3 py-2.5 text-sm hover:bg-primary/5 hover:text-primary-foreground group transition-colors"
                    onClick={() => {
                      onSelect(product);
                    }}
                  >
                    <div className="flex items-center gap-4 w-full">
                      <div className="size-12 rounded-lg border bg-muted/30 overflow-hidden flex-shrink-0 transition-transform group-hover:scale-105">
                        <Image
                          width={48}
                          height={48}
                          src={product.image}
                          alt={product.name}
                          className="size-full object-cover"
                        />
                      </div>
                      <div className="flex flex-col flex-1 overflow-hidden">
                        <span className="truncate font-semibold text-foreground/90 group-hover:text-primary transition-colors">
                          {product.name}
                        </span>
                        <div className="flex items-center justify-between text-xs mt-0.5">
                          <span className="text-muted-foreground/80 font-medium">
                            Stock: {product.stockQuantity}
                          </span>
                          <span className="font-bold text-primary group-hover:scale-110 transition-transform origin-right">
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
