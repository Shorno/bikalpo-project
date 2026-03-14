"use client";

import { useQuery } from "@tanstack/react-query";
import Image from "next/image";
import Link from "next/link";
import { Sparkles, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { client } from "@/utils/orpc";

export function HomeOffersSection() {
  const { data, isLoading } = useQuery({
    queryKey: ["active-offers"],
    queryFn: () => client.customer.getActiveOffers({ limit: 6 }),
  });

  const offers = data?.offers || [];

  if (isLoading) {
    return (
      <section className="bg-gradient-to-r from-amber-50 to-orange-50 border-b">
        <div className="container mx-auto px-4 py-8">
          <div className="h-32 bg-gray-200 rounded-lg animate-pulse" />
        </div>
      </section>
    );
  }

  if (offers.length === 0) {
    return null;
  }

  return (
    <section className="bg-gradient-to-r from-amber-50 to-orange-50 border-b">
      <div className="container mx-auto px-3 sm:px-4 py-6 sm:py-8 md:py-10">
        {/* Section Title */}
        <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
          <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 text-amber-600" />
          <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900">
            Hot Offers Just For You
          </h2>
        </div>

        {/* Offers Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 md:gap-5">
          {offers.slice(0, 3).map((offer) => (
            <div
              key={offer.id}
              className="group relative overflow-hidden rounded-lg bg-white shadow-md hover:shadow-lg transition-all duration-300"
            >
              {/* Image or Color Background */}
              {offer.bannerImage ? (
                <div className="relative w-full h-32 sm:h-40 md:h-48 bg-gray-100">
                  <Image
                    src={offer.bannerImage}
                    alt={offer.title}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                </div>
              ) : (
                <div className="w-full h-32 sm:h-40 md:h-48 bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                  <span className="text-white text-3xl sm:text-4xl md:text-5xl font-bold opacity-20">
                    {offer.discountPercentage}%
                  </span>
                </div>
              )}

              {/* Badge */}
              {offer.badge && (
                <div className="absolute top-2 sm:top-3 right-2 sm:right-3 z-10">
                  <span className="inline-block bg-red-600 text-white px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-xs font-bold">
                    {offer.badge}
                  </span>
                </div>
              )}

              {/* Content */}
              <div className="p-3 sm:p-4 md:p-5">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="font-semibold text-sm sm:text-base text-gray-900 line-clamp-2 flex-1">
                    {offer.title}
                  </h3>
                  <div className="flex-shrink-0 text-center">
                    <div className="inline-block bg-emerald-100 text-emerald-700 rounded-lg px-2 py-1">
                      <span className="text-base sm:text-lg font-bold">
                        {offer.discountPercentage}%
                      </span>
                      <div className="text-xs">OFF</div>
                    </div>
                  </div>
                </div>

                {offer.description && (
                  <p className="text-xs sm:text-sm text-gray-600 line-clamp-2 mb-3">
                    {offer.description}
                  </p>
                )}

                {/* Date Info */}
                <div className="text-xs text-gray-500 mb-3">
                  {offer.endDate && (
                    <div>
                      Ends:{" "}
                      {new Date(offer.endDate).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </div>
                  )}
                </div>

                {/* CTA Button */}
                <Link href="/products?sort=discount" className="block">
                  <Button
                    variant="outline"
                    className="w-full text-xs sm:text-sm h-8 sm:h-9 group-hover:bg-emerald-50"
                  >
                    Shop Now
                    <ChevronRight className="w-3 h-3 sm:w-4 sm:h-4 ml-1" />
                  </Button>
                </Link>
              </div>
            </div>
          ))}
        </div>

        {/* View All Button */}
        {offers.length > 3 && (
          <div className="flex justify-center mt-6 sm:mt-8">
            <Link href="/products?sort=discount">
              <Button
                size="lg"
                variant="default"
                className="text-sm sm:text-base"
              >
                View All Offers ({offers.length})
              </Button>
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
