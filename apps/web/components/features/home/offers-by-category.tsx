"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Image from "next/image";
import Link from "next/link";
import { Sparkles, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { client } from "@/utils/orpc";

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

  const { data, isLoading, isError, error, refetch } = useQuery({
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
      <section className="bg-white border-b">
        <div className="container mx-auto px-4 py-8">
          <div className="h-96 bg-gray-200 rounded-lg animate-pulse" />
        </div>
      </section>
    );
  }

  if (allOffers.length === 0) {
    if (isError) {
      return (
        <section className="bg-white border-b">
          <div className="container mx-auto px-4 py-8">
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 sm:p-5">
              <p className="text-sm text-amber-900 font-medium">
                Could not load offers right now.
              </p>
              <p className="text-xs text-amber-800 mt-1 break-words">
                {error instanceof Error ? error.message : "Unknown error"}
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => void refetch()}
              >
                Retry
              </Button>
            </div>
          </div>
        </section>
      );
    }

    return null;
  }

  return (
    <section className="bg-gradient-to-b from-white to-gray-50 border-b">
      <div className="container mx-auto px-3 sm:px-4 py-6 sm:py-10 md:py-12">
        {/* Section Header */}
        <div className="flex items-center gap-2 sm:gap-3 mb-6 sm:mb-8">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900">
            🔥 Deals / Offers
          </h2>
        </div>

        {/* Tabs */}
        <Tabs
          value={selectedType}
          onValueChange={setSelectedType}
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 mb-6 sm:mb-8">
            {OFFER_TYPES.map((type) => (
              <TabsTrigger
                key={type}
                value={type}
                className="text-xs sm:text-sm"
                disabled={!availableTypes.includes(type)}
              >
                {type}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value={selectedType} className="space-y-4 sm:space-y-6">
            {visibleOffers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                <Sparkles className="w-12 h-12 mb-3 opacity-20" />
                <p>No {selectedType.toLowerCase()} available at the moment</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 md:gap-5">
                  {visibleOffers.slice(0, 6).map((offer) => (
                    <div
                      key={offer.id}
                      className="group relative overflow-hidden rounded-xl bg-white shadow-md hover:shadow-xl transition-all duration-300 border border-gray-100"
                    >
                      {/* Image Section */}
                      {offer.bannerImage ? (
                        <div className="relative w-full h-40 sm:h-48 md:h-56 bg-gray-100 overflow-hidden">
                          <Image
                            src={offer.bannerImage}
                            alt={offer.title}
                            fill
                            className="object-cover group-hover:scale-110 transition-transform duration-300"
                          />
                        </div>
                      ) : (
                        <div className="w-full h-40 sm:h-48 md:h-56 bg-gradient-to-br from-amber-400 via-orange-400 to-red-500 flex items-center justify-center relative overflow-hidden">
                          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
                          <span className="text-white text-4xl sm:text-5xl md:text-6xl font-bold opacity-30 relative z-10">
                            {offer.discountPercentage}%
                          </span>
                        </div>
                      )}

                      {/* Badge */}
                      {offer.badge && (
                        <div className="absolute top-2 sm:top-3 right-2 sm:right-3 z-20">
                          <span className="inline-block bg-red-600 text-white px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full text-xs font-bold shadow-lg">
                            {offer.badge}
                          </span>
                        </div>
                      )}

                      {/* Discount Badge - Top Left */}
                      <div className="absolute top-2 sm:top-3 left-2 sm:left-3 z-20">
                        <div className="inline-block bg-emerald-500 text-white rounded-lg px-2 sm:px-3 py-1 sm:py-1.5 shadow-lg">
                          <div className="text-sm sm:text-base font-bold">
                            {offer.discountPercentage}%
                          </div>
                          <div className="text-xs font-semibold">OFF</div>
                        </div>
                      </div>

                      {/* Content Section */}
                      <div className="p-3 sm:p-4 md:p-5 space-y-2 sm:space-y-3">
                        <h3 className="font-bold text-sm sm:text-base md:text-lg text-gray-900 line-clamp-2">
                          {offer.title}
                        </h3>

                        {offer.description && (
                          <p className="text-xs sm:text-sm text-gray-600 line-clamp-2">
                            {offer.description}
                          </p>
                        )}

                        {/* Products List */}
                        {offer.products && (
                          <div className="text-xs text-gray-500 space-y-1">
                            <div className="font-semibold text-gray-700">
                              Includes:
                            </div>
                            {offer.products
                              .split(",")
                              .slice(0, 2)
                              .map((product, idx) => (
                                <div key={idx} className="text-gray-600">
                                  • {product.trim()}
                                </div>
                              ))}
                            {offer.products.split(",").length > 2 && (
                              <div className="text-gray-600">
                                +{offer.products.split(",").length - 2} more
                              </div>
                            )}
                          </div>
                        )}

                        {/* Price Block */}
                        {(offer.comboPrice || offer.originalPrice) && (
                          <div className="pt-1">
                            <div className="flex items-end gap-2">
                              {offer.comboPrice ? (
                                <span className="text-2xl sm:text-3xl font-bold text-emerald-600 leading-none">
                                  ৳ {offer.comboPrice}
                                </span>
                              ) : null}
                              {offer.originalPrice &&
                              offer.comboPrice &&
                              offer.originalPrice > offer.comboPrice ? (
                                <span className="text-sm text-gray-400 line-through">
                                  ৳ {offer.originalPrice}
                                </span>
                              ) : null}
                            </div>
                          </div>
                        )}

                        {/* Date Info */}
                        {offer.endDate && (
                          <div className="text-xs text-gray-500 pt-1 border-t">
                            Ends:{" "}
                            {new Date(offer.endDate).toLocaleDateString(
                              "en-US",
                              {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              },
                            )}
                          </div>
                        )}

                        {/* CTA Button */}
                        <Link
                          href={`/offers/${offer.id}`}
                          className="block pt-1"
                        >
                          <Button
                            variant="outline"
                            className="w-full text-xs sm:text-sm h-8 sm:h-9 group-hover:bg-emerald-50 group-hover:border-emerald-300 transition-colors"
                          >
                            {offer.type === "Combo Deals"
                              ? "View Combo"
                              : "View Offer"}
                            <ChevronRight className="w-3 h-3 sm:w-4 sm:h-4 ml-1.5" />
                          </Button>
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>

                {visibleOffers.length > 6 && (
                  <div className="flex justify-center mt-8 sm:mt-10">
                    <Link
                      href={`/products?offer_type=${encodeURIComponent(selectedType)}`}
                    >
                      <Button
                        size="lg"
                        className="text-sm sm:text-base gap-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600"
                      >
                        View All {selectedType} ({visibleOffers.length})
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </Link>
                  </div>
                )}
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </section>
  );
}
