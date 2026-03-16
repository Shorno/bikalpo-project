"use client";

import { useQuery } from "@tanstack/react-query";
import { Loader2, Package, Search, X } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useDebounce } from "@/hooks/use-debounce";
import { client } from "@/utils/orpc";

type SearchResult = {
  id: number;
  name: string;
  slug: string;
  image: string;
  price: string;
  size: string;
  inStock: boolean;
  category: { name: string; slug: string };
};

interface NavbarSearchProps {
  className?: string;
}

export function NavbarSearch({ className }: NavbarSearchProps) {
  const [focused, setFocused] = useState(false);
  const [query, setQuery] = useState("");
  const [imageErrors, setImageErrors] = useState<Set<number>>(new Set());
  const debouncedQuery = useDebounce(query, 300);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Fetch suggested products (shown when focused but no query)
  const { data: suggestedProducts = [] } = useQuery({
    queryKey: ["suggested-products"],
    queryFn: async () => {
      const { products } = await client.customer.getCustomerProducts({
        sort: "popular",
        limit: "6",
        page: "1",
      });
      return products as SearchResult[];
    },
    staleTime: 1000 * 60 * 10,
  });

  const showDropdown = focused;

  const { data: results = [], isLoading } = useQuery({
    queryKey: ["search-products", debouncedQuery],
    queryFn: async () => {
      if (!debouncedQuery.trim()) return [];
      const { products } = await client.product.search({
        query: debouncedQuery,
      });
      return products as SearchResult[];
    },
    enabled: debouncedQuery.trim().length > 0,
    staleTime: 1000 * 60 * 5,
  });

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        setFocused(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleProductClick = (categorySlug: string, productSlug: string) => {
    router.push(`/products/${categorySlug}/${productSlug}`);
    setFocused(false);
    setQuery("");
  };

  const formatPrice = (price: string | number) => {
    const numPrice = typeof price === "string" ? parseFloat(price) : price;
    return `৳${numPrice.toLocaleString("en-BD")}`;
  };

  return (
    <div ref={wrapperRef} className={`relative ${className ?? ""}`}>
      {/* Search input */}
      <div className="flex items-center bg-white rounded-full h-10 px-4 gap-2 shadow-sm">
        <Search className="size-4 text-gray-400 shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          placeholder="Search for products..."
          className="flex-1 bg-transparent text-sm text-gray-800 placeholder:text-gray-400 outline-none border-none"
        />
        {query && (
          <button
            onClick={() => {
              setQuery("");
              inputRef.current?.focus();
            }}
            className="shrink-0 text-gray-400 hover:text-gray-600"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      {/* Dropdown results panel */}
      {showDropdown && (
        <div className="absolute top-[calc(100%+8px)] left-0 right-0 bg-white rounded-xl shadow-2xl border border-gray-100 z-50 max-h-[420px] overflow-hidden flex flex-col">
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-100">
            {!query.trim() ? (
              <p className="text-sm font-medium text-gray-700">
                Suggested Products
              </p>
            ) : isLoading ? (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Loader2 className="size-4 animate-spin" />
                Searching...
              </div>
            ) : (
              <p className="text-sm text-gray-500">
                {results.length > 0
                  ? `Found ${results.length} result${results.length > 1 ? "s" : ""}`
                  : `No results for "${query}"`}
              </p>
            )}
          </div>

          {/* Results list */}
          <div className="overflow-y-auto flex-1">
            {(query.trim() ? results : suggestedProducts).map((product) => {
              const hasImageError = imageErrors.has(product.id);
              const hasValidImage =
                product.image && !hasImageError && product.image.trim() !== "";

              return (
                <button
                  key={product.id}
                  type="button"
                  onClick={() =>
                    handleProductClick(product.category.slug, product.slug)
                  }
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left border-b border-gray-50 last:border-0"
                >
                  {/* Product image */}
                  <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-gray-100 shrink-0">
                    {hasValidImage ? (
                      <Image
                        src={product.image}
                        alt={product.name}
                        fill
                        className="object-cover"
                        onError={() =>
                          setImageErrors((prev) =>
                            new Set(prev).add(product.id),
                          )
                        }
                        unoptimized={product.image.startsWith("http")}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package className="size-5 text-gray-300" />
                      </div>
                    )}
                  </div>

                  {/* Product info */}
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-medium text-gray-900 truncate">
                      {product.name}
                    </h4>
                    <p className="text-xs text-gray-500">
                      {product.category.name}
                    </p>
                  </div>

                  {/* Price */}
                  <div className="shrink-0 text-right">
                    <span className="text-sm font-bold text-primary">
                      {formatPrice(product.price)}
                    </span>
                    {!product.inStock && (
                      <p className="text-[10px] text-red-500">Out of stock</p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* View all link */}
          {results.length > 0 && (
            <button
              onClick={() => {
                router.push(`/products?search=${encodeURIComponent(query)}`);
                setFocused(false);
                setQuery("");
              }}
              className="px-4 py-3 text-sm font-medium text-primary hover:bg-primary/5 transition-colors border-t border-gray-100 text-center"
            >
              View all results →
            </button>
          )}
        </div>
      )}
    </div>
  );
}
