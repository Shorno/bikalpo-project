"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Image from "next/image";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { client } from "@/utils/orpc";
import { cn } from "@/lib/utils";

const OFFER_TYPES = [
  "Weekly Offers",
  "Combo Deals",
  "Brand Campaigns",
  "More Offers",
];

const normalizeOfferType = (type: string | null | undefined) => {
  const trimmedType = type?.trim();
  return OFFER_TYPES.includes(trimmedType || "") ? trimmedType : "More Offers";
};

export function OffersByCategory() {
  const [selectedType, setSelectedType] = useState("Weekly Offers");

  const { data, isLoading, isError } = useQuery({
    queryKey: ["active-offers-all"],
    queryFn: () => client.customer.getActiveOffers({ limit: 50 }),
    retry: 2,
    staleTime: 30_000,
  });

  const allOffers = useMemo(
    () =>
      (data?.offers || []).map((offer) => ({
        ...offer,
        type: normalizeOfferType(offer.type),
        bannerImage: offer.bannerImage || offer.imageUrl || "",
      })),
    [data?.offers],
  );

  const availableTypes = useMemo(
    () =>
      OFFER_TYPES.filter((type) =>
        allOffers.some((offer) => offer.type === type),
      ),
    [allOffers],
  );

  useEffect(() => {
    if (availableTypes.length > 0 && !availableTypes.includes(selectedType)) {
      setSelectedType(availableTypes[0]);
    }
  }, [availableTypes, selectedType]);

  const visibleOffers = allOffers.filter(
    (offer) => offer.type === selectedType,
  );

  if (isLoading) {
    return (
      <section className="bg-white">
        <div className="container mx-auto px-4 py-6">
          <div className="h-40 bg-gray-100 rounded-2xl animate-pulse" />
        </div>
      </section>
    );
  }

  if (allOffers.length === 0) return null;

  return (
    <section className="bg-white">
      <div className="container mx-auto px-4 py-6">
        {/* Light rounded container */}
        <div className="bg-gray-50 rounded-2xl px-4 sm:px-6 py-5">
          {/* Tab navigation — clean underlined text tabs */}
          <div className="flex gap-6 sm:gap-8 border-b border-gray-200 mb-5">
            {availableTypes.map((type) => {
              const isActive = selectedType === type;
              const isDisabled = !availableTypes.includes(type);
              return (
                <button
                  key={type}
                  onClick={() => setSelectedType(type)}
                  className={cn(
                    "pb-2.5 text-sm font-medium whitespace-nowrap transition-colors relative",
                    isActive
                      ? "text-teal-600"
                      : "text-gray-500 hover:text-gray-800",
                  )}
                >
                  {type}
                  {isActive && (
                    <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-teal-500 rounded-full" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Offer cards — horizontal layout */}
          {visibleOffers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-gray-400">
              <Sparkles className="w-10 h-10 mb-2 opacity-20" />
              <p className="text-sm">
                No {selectedType.toLowerCase()} available right now
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {visibleOffers.slice(0, 6).map((offer) => (
                <Link
                  key={offer.id}
                  href={`/offers/${offer.id}`}
                  className="group flex items-center gap-4 bg-white rounded-xl border border-gray-100 p-3 hover:shadow-md transition-shadow"
                >
                  {/* Left: Image */}
                  <div className="relative w-24 h-24 sm:w-28 sm:h-28 shrink-0 rounded-lg overflow-hidden bg-gray-100">
                    {offer.bannerImage ? (
                      <Image
                        src={offer.bannerImage}
                        alt={offer.title}
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-amber-300 to-orange-400 flex items-center justify-center">
                        <span className="text-white text-2xl font-bold opacity-40">
                          {offer.discountPercentage}%
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Right: Content */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-sm sm:text-base text-gray-900 line-clamp-1">
                      {offer.title}
                    </h3>
                    {offer.products && (
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">
                        {offer.products}
                      </p>
                    )}
                    {offer.description && !offer.products && (
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">
                        {offer.description}
                      </p>
                    )}

                    <div className="flex items-center gap-3 mt-2.5">
                      {/* Price */}
                      <div className="flex items-baseline gap-1.5">
                        {offer.comboPrice && (
                          <span className="text-lg sm:text-xl font-bold text-gray-900">
                            ৳{offer.comboPrice}
                          </span>
                        )}
                        {offer.originalPrice &&
                          offer.comboPrice &&
                          offer.originalPrice > offer.comboPrice && (
                            <span className="text-xs text-gray-400 line-through">
                              ৳{offer.originalPrice}
                            </span>
                          )}
                      </div>

                      {/* View button */}
                      <span className="inline-flex items-center px-3.5 py-1.5 bg-teal-500 hover:bg-teal-600 text-white text-xs font-semibold rounded-full transition-colors">
                        {offer.type === "Combo Deals"
                          ? "View Combo"
                          : "View Offer"}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
