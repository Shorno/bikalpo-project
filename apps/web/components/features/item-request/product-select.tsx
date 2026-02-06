"use client";

import { useQuery } from "@tanstack/react-query";
import { Check, ChevronsUpDown, Loader2, Package } from "lucide-react";
import Image from "next/image";
import * as React from "react";
import getProducts from "@/actions/product/get-products";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface Product {
  id: number;
  name: string;
  price: string;
  image: string;
}

interface ProductSelectProps {
  onSelect: (productId: number) => void;
  selectedId: number | null;
}

export function ProductSelect({ onSelect, selectedId }: ProductSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [selectedProduct, setSelectedProduct] = React.useState<Product | null>(
    null,
  );

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["products-for-suggestion"],
    queryFn: async () => {
      const result = await getProducts();
      return (result || []) as unknown as Product[];
    },
    enabled: open, // Only fetch when popover is open
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  const handleSelect = (product: Product) => {
    setSelectedProduct(product);
    onSelect(product.id);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          {selectedProduct ? (
            <div className="flex items-center gap-2 truncate">
              <Package className="size-4 shrink-0" />
              <span className="truncate">{selectedProduct.name}</span>
            </div>
          ) : (
            "Select a product..."
          )}
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-100 p-0" align="start">
        <Command>
          <CommandInput placeholder="Search products..." />
          <CommandList>
            {isLoading && (
              <div className="flex items-center justify-center p-4">
                <Loader2 className="animate-spin size-4" />
              </div>
            )}
            {!isLoading && <CommandEmpty>No products found.</CommandEmpty>}
            <CommandGroup>
              {!isLoading &&
                products.map((product) => (
                  <CommandItem
                    key={product.id}
                    value={product.name}
                    onSelect={() => handleSelect(product)}
                  >
                    <div className="flex items-center gap-3 w-full">
                      <div className="size-10 rounded-md overflow-hidden bg-muted shrink-0">
                        {product.image ? (
                          <Image
                            width={100}
                            height={100}
                            src={product.image}
                            alt={product.name}
                            className="size-full object-cover"
                          />
                        ) : (
                          <div className="size-full flex items-center justify-center">
                            <Package className="size-4 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{product.name}</p>
                        <p className="text-xs text-muted-foreground">
                          ৳{Number(product.price).toLocaleString()}
                        </p>
                      </div>
                      {selectedId === product.id && (
                        <Check className="size-4 shrink-0" />
                      )}
                    </div>
                  </CommandItem>
                ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
