"use client";

import { useQuery } from "@tanstack/react-query";
import { ShoppingCart, Sparkles, Zap } from "lucide-react";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
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

type Offer = {
  id: number;
  title: string;
  description?: string | null;
  type: string | undefined;
  bannerImage: string;
  badge?: string | null;
  discountPercentage?: number | null;
  comboPrice?: number | null;
  originalPrice?: number | null;
  products?: string | null;
  endDate?: string | null;
  imageUrl?: string | null;
};

function OfferDetailModal({
  offer,
  open,
  onOpenChange,
}: {
  offer: Offer | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!offer) return null;

  const productList = offer.products
    ? offer.products.split(",").map((p) => p.trim())
    : [];

  const savings =
    offer.originalPrice && offer.comboPrice
      ? offer.originalPrice - offer.comboPrice
      : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg p-0 overflow-hidden rounded-2xl max-h-[85vh] flex flex-col gap-0">
        <DialogHeader className="sr-only">
          <DialogTitle>{offer.title}</DialogTitle>
        </DialogHeader>

        {/* Image */}
        <div className="relative w-full h-48 sm:h-56 bg-gray-100 shrink-0">
          {offer.bannerImage ? (
            <Image
              src={offer.bannerImage}
              alt={offer.title}
              fill
              className="object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-amber-300 to-orange-400 flex items-center justify-center">
              <span className="text-white text-5xl font-bold opacity-30">
                {offer.discountPercentage}%
              </span>
            </div>
          )}

          {/* Discount badge */}
          {offer.discountPercentage && (
            <div className="absolute top-3 left-3 bg-red-500 text-white px-3 py-1 rounded-full text-sm font-bold shadow-lg">
              {offer.discountPercentage}% OFF
            </div>
          )}

          {/* Badge */}
          {offer.badge && (
            <div className="absolute top-3 right-12 bg-teal-500 text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg">
              {offer.badge}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Title */}
          <div>
            <h3 className="text-xl font-bold text-gray-900">{offer.title}</h3>
            {offer.description && (
              <p className="text-sm text-gray-500 mt-1">{offer.description}</p>
            )}
          </div>

          {/* Products list */}
          {productList.length > 0 && (
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-2">
                What&apos;s included:
              </p>
              <ul className="space-y-1.5">
                {productList.map((product, idx) => (
                  <li
                    key={idx}
                    className="flex items-center gap-2 text-sm text-gray-600"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-teal-400 shrink-0" />
                    {product}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Price block */}
          {(offer.comboPrice || offer.originalPrice) && (
            <div className="bg-gray-50 rounded-xl p-4">
              <div className="flex items-baseline gap-3">
                {offer.comboPrice && (
                  <span className="text-2xl font-bold text-gray-900">
                    ৳{offer.comboPrice}
                  </span>
                )}
                {offer.originalPrice &&
                  offer.comboPrice &&
                  offer.originalPrice > offer.comboPrice && (
                    <span className="text-base text-gray-400 line-through">
                      ৳{offer.originalPrice}
                    </span>
                  )}
              </div>
              {savings > 0 && (
                <p className="text-sm text-teal-600 font-medium mt-1">
                  You save ৳{savings}!
                </p>
              )}
            </div>
          )}

          {/* End date */}
          {offer.endDate && (
            <p className="text-xs text-gray-500">
              Offer ends:{" "}
              {new Date(offer.endDate).toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </p>
          )}
        </div>

        {/* Action buttons */}
        <div className="border-t border-gray-100 p-4 flex gap-3 shrink-0">
          <Button
            variant="outline"
            className="flex-1 h-11 gap-2 border-teal-500 text-teal-600 hover:bg-teal-50"
            onClick={() => {
              // TODO: integrate with cart
              onOpenChange(false);
            }}
          >
            <ShoppingCart className="size-4" />
            Add to Cart
          </Button>
          <Button
            className="flex-1 h-11 gap-2 bg-teal-500 hover:bg-teal-600 text-white"
            onClick={() => {
              // TODO: integrate with buy now
              onOpenChange(false);
            }}
          >
            <Zap className="size-4" />
            Buy Now
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function OffersByCategory() {
  const [selectedType, setSelectedType] = useState("Weekly Offers");
  const [selectedOffer, setSelectedOffer] = useState<Offer | null>(null);

  const { data, isLoading } = useQuery({
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
    <>
      {/* Offer Detail Modal */}
      <OfferDetailModal
        offer={selectedOffer}
        open={!!selectedOffer}
        onOpenChange={(open) => {
          if (!open) setSelectedOffer(null);
        }}
      />

      <section className="bg-white">
        <div className="container mx-auto px-4 py-6">
          <div className="bg-gray-50 rounded-2xl px-4 sm:px-6 py-5">
            {/* Tab navigation */}
            <div className="flex gap-6 sm:gap-8 border-b border-gray-200 mb-5">
              {availableTypes.map((type) => {
                const isActive = selectedType === type;
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

            {/* Offer cards */}
            {visibleOffers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                <Sparkles className="w-10 h-10 mb-2 opacity-20" />
                <p className="text-sm">
                  No {selectedType.toLowerCase()} available right now
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {visibleOffers.slice(0, 8).map((offer) => (
                  <button
                    key={offer.id}
                    onClick={() => setSelectedOffer(offer as Offer)}
                    className="group flex items-center gap-3 bg-white rounded-xl border border-gray-100 p-2.5 hover:shadow-md transition-shadow text-left"
                  >
                    {/* Left: Image */}
                    <div className="relative w-20 h-20 shrink-0 rounded-lg overflow-hidden bg-gray-100">
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

                        <span className="inline-flex items-center px-3.5 py-1.5 bg-teal-500 hover:bg-teal-600 text-white text-xs font-semibold rounded-full transition-colors">
                          {offer.type === "Combo Deals"
                            ? "View Combo"
                            : "View Offer"}
                        </span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
