"use client";

import { useQuery } from "@tanstack/react-query";
import { Loader2, Package, RefreshCw, Search } from "lucide-react";
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

interface ItemReplacePickerProps {
  onSelect: (product: Product) => void;
  excludeProductId?: number;
}

export function ItemReplacePicker({
  onSelect,
  excludeProductId,
}: ItemReplacePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState("");

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["estimate-products"],
    queryFn: async () => {
      const data = await getProducts();
      return data as Product[];
    },
    enabled: open,
    staleTime: 1000 * 60 * 5,
  });

  const filteredProducts = products
    .filter((product) => product.id !== excludeProductId)
    .filter((product) =>
      product.name.toLowerCase().includes(searchTerm.toLowerCase()),
    );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
          title="Replace product"
        >
          <RefreshCw className="size-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[400px] max-w-[calc(100vw-2rem)] p-0"
        align="end"
        side="bottom"
      >
        <div className="flex flex-col max-h-[320px]">
          <div className="flex items-center border-b px-3 bg-muted/20">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <input
              className="flex h-10 w-full bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground/60"
              placeholder="Search replacement..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="overflow-y-auto p-1">
            {isLoading && (
              <div className="flex items-center justify-center p-6 text-muted-foreground gap-2">
                <Loader2 className="animate-spin size-5" />
                <span className="text-xs">Loading...</span>
              </div>
            )}
            {!isLoading && filteredProducts.length === 0 && (
              <div className="py-8 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
                <Package className="size-6 opacity-20" />
                <span>No products found</span>
              </div>
            )}
            {!isLoading &&
              filteredProducts.map((product) => (
                <div
                  key={product.id}
                  className="flex cursor-pointer items-center rounded-md px-2 py-2 text-sm hover:bg-primary/5 group"
                  onClick={() => {
                    onSelect(product);
                    setOpen(false);
                    setSearchTerm("");
                  }}
                >
                  <div className="flex items-center gap-3 w-full">
                    <div className="size-10 rounded border bg-muted/30 overflow-hidden shrink-0">
                      <Image
                        width={40}
                        height={40}
                        src={product.image}
                        alt={product.name}
                        className="size-full object-cover"
                      />
                    </div>
                    <div className="flex flex-col flex-1 min-w-0">
                      <span className="truncate font-medium text-sm">
                        {product.name}
                      </span>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{product.size}</span>
                        <span className="font-semibold text-primary">
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
  );
}
