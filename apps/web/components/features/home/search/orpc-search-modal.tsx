/**
 * ORPC-powered Search Modal – fetches results via useSearchProducts hook.
 */
"use client";

import { Loader2, Search, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useSearchProducts } from "@/hooks/use-customer-api";

interface OrpcSearchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 'public' hides prices, 'customer' shows prices */
  variant?: "public" | "customer";
}

export function OrpcSearchModal({
  open,
  onOpenChange,
  variant = "customer",
}: OrpcSearchModalProps) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounce
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);

  // Focus input when modal opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      setQuery("");
      setDebouncedQuery("");
    }
  }, [open]);

  const { data, isLoading } = useSearchProducts(debouncedQuery);
  const products = data?.products ?? [];
  type SearchProduct = (typeof products)[number];

  const basePath = variant === "public" ? "/products" : "/shop/products";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-0 gap-0">
        <DialogHeader className="px-4 pt-4 pb-2">
          <DialogTitle className="sr-only">Search Products</DialogTitle>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search products..."
              className="pl-9 pr-9 h-10"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-y-auto px-4 pb-4">
          {!debouncedQuery && (
            <p className="text-center text-sm text-gray-400 py-8">
              Start typing to search...
            </p>
          )}

          {debouncedQuery && isLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-emerald-600" />
              <span className="ml-2 text-sm text-gray-500">Searching...</span>
            </div>
          )}

          {debouncedQuery && !isLoading && products.length === 0 && (
            <div className="text-center py-8">
              <p className="text-sm text-gray-500">
                No products found for &ldquo;{debouncedQuery}&rdquo;
              </p>
            </div>
          )}

          {products.length > 0 && (
            <div className="space-y-1">
              {products.map((product: SearchProduct) => (
                <Link
                  key={product.id}
                  href={`${basePath}/${product.category?.slug || "all"}/${product.slug}`}
                  onClick={() => onOpenChange(false)}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="relative h-12 w-12 rounded-md overflow-hidden bg-gray-100 shrink-0">
                    <Image
                      src={product.image}
                      alt={product.name}
                      fill
                      className="object-cover"
                      sizes="48px"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {product.name}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {product.category?.name && (
                        <span className="text-xs text-gray-500">
                          {product.category.name}
                        </span>
                      )}
                      <span className="text-xs text-gray-400">
                        {product.size}
                      </span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    {variant === "customer" && (
                      <p className="text-sm font-semibold text-gray-900">
                        ৳{Number(product.price).toLocaleString("en-BD")}
                      </p>
                    )}
                    {!product.inStock && (
                      <Badge
                        variant="secondary"
                        className="text-[10px] bg-red-50 text-red-600"
                      >
                        Out of Stock
                      </Badge>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * A simple search trigger button that opens the ORPC search modal.
 */
export function OrpcSearchTrigger({
  variant = "customer",
}: {
  variant?: "public" | "customer";
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 w-full max-w-md px-4 py-2 rounded-lg border bg-gray-50 text-gray-400 text-sm hover:bg-gray-100 transition-colors"
      >
        <Search className="h-4 w-4" />
        Search products...
      </button>
      <OrpcSearchModal open={open} onOpenChange={setOpen} variant={variant} />
    </>
  );
}
