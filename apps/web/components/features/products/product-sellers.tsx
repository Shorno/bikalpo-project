"use client";

import { useQuery } from "@tanstack/react-query";
import { Check, MapPin, Store } from "lucide-react";
import Image from "next/image";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { orpc } from "@/utils/orpc";

interface SelectedSeller {
  shopId: string;
  shopName: string;
  retailPrice: number;
}

interface ProductSellersProps {
  productId: number;
  selectedSeller: SelectedSeller | null;
  onSelectSeller: (seller: SelectedSeller | null) => void;
}

export function ProductSellers({
  productId,
  selectedSeller,
  onSelectSeller,
}: ProductSellersProps) {
  const { data, isLoading } = useQuery(
    orpc.customer.getProductSellers.queryOptions({
      input: { productId },
      staleTime: 1000 * 60 * 2,
    }),
  );

  const sellers = data?.sellers ?? [];

  if (isLoading) {
    return (
      <div className="mt-6 pt-6 border-t">
        <Skeleton className="h-5 w-40 mb-3" />
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (sellers.length === 0) {
    return null;
  }

  return (
    <div className="mt-6 pt-6 border-t">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900">
          Available from {sellers.length}{" "}
          {sellers.length === 1 ? "seller" : "sellers"}
        </h3>
        {selectedSeller && (
          <button
            onClick={() => onSelectSeller(null)}
            className="text-xs text-gray-500 hover:text-gray-700 underline"
          >
            Clear selection
          </button>
        )}
      </div>

      <div className="space-y-2 max-h-[300px] overflow-y-auto">
        {sellers.map((seller: any) => {
          const isSelected = selectedSeller?.shopId === seller.shopId;
          const price = Number(seller.retailPrice || 0);

          return (
            <button
              key={seller.shopId}
              type="button"
              onClick={() =>
                onSelectSeller(
                  isSelected
                    ? null
                    : {
                        shopId: seller.shopId,
                        shopName: seller.shopName || "Shop",
                        retailPrice: price,
                      },
                )
              }
              className={cn(
                "w-full flex items-center gap-3 p-3 rounded-lg border-2 transition-all text-left",
                "hover:border-emerald-300 hover:bg-emerald-50/50",
                isSelected
                  ? "border-emerald-500 bg-emerald-50"
                  : "border-gray-200 bg-white",
              )}
            >
              {/* Shop Avatar */}
              {seller.shopImage ? (
                <Image
                  src={seller.shopImage}
                  alt={seller.shopName || "Shop"}
                  width={40}
                  height={40}
                  className="rounded-full object-cover border border-gray-200 shrink-0"
                />
              ) : (
                <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center border border-gray-200 shrink-0">
                  <Store className="w-4 h-4 text-gray-400" />
                </div>
              )}

              {/* Shop Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-medium text-gray-900 truncate">
                    {seller.shopName || "Shop"}
                  </span>
                  {isSelected && (
                    <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  )}
                </div>
                {seller.shopAddress && (
                  <div className="flex items-center gap-1 text-xs text-gray-500 mt-0.5">
                    <MapPin className="w-3 h-3 shrink-0" />
                    <span className="truncate">{seller.shopAddress}</span>
                  </div>
                )}
              </div>

              {/* Price */}
              <div className="text-right shrink-0">
                <span
                  className={cn(
                    "text-base font-bold",
                    isSelected ? "text-emerald-600" : "text-gray-900",
                  )}
                >
                  ৳{price.toLocaleString("en-BD")}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {selectedSeller && (
        <div className="mt-2 flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 rounded-md px-3 py-2">
          <Check className="w-3.5 h-3.5" />
          <span>
            Buying from <strong>{selectedSeller.shopName}</strong> at ৳
            {selectedSeller.retailPrice.toLocaleString("en-BD")}
          </span>
        </div>
      )}
    </div>
  );
}
