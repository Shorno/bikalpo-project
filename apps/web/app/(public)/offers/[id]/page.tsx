"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Calendar, Tag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { client } from "@/utils/orpc";

export default function OfferDetailsPage() {
  const params = useParams<{ id: string }>();
  const offerId = Number(params.id);

  const { data, isLoading } = useQuery({
    queryKey: ["offer-details", offerId],
    queryFn: () => client.customer.getOfferById({ id: offerId }),
    enabled: Number.isFinite(offerId) && offerId > 0,
  });

  if (isLoading) {
    return (
      <section className="py-8 sm:py-12">
        <div className="container mx-auto px-4 space-y-6">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-72 w-full rounded-xl" />
          <Skeleton className="h-8 w-1/2" />
          <Skeleton className="h-24 w-full" />
        </div>
      </section>
    );
  }

  const offer = data?.offer;

  if (!offer) {
    return (
      <section className="py-12">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-2xl font-bold text-gray-900">Offer not found</h1>
          <p className="text-gray-600 mt-2">
            This offer is unavailable or inactive.
          </p>
          <Link href="/" className="inline-block mt-6">
            <Button>Back to Home</Button>
          </Link>
        </div>
      </section>
    );
  }

  const bannerImage = offer.bannerImage || offer.imageUrl || "";

  return (
    <section className="py-6 sm:py-10 bg-gray-50 min-h-[60vh]">
      <div className="container mx-auto px-4 max-w-5xl">
        <Link
          href="/"
          className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-4 sm:mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to offers
        </Link>

        <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
          {bannerImage ? (
            <div className="relative h-56 sm:h-80 w-full bg-gray-100">
              <Image
                src={bannerImage}
                alt={offer.title}
                fill
                className="object-cover"
              />
            </div>
          ) : (
            <div className="h-56 sm:h-80 w-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
              <span className="text-white text-5xl sm:text-7xl font-bold opacity-30">
                {offer.discountPercentage}%
              </span>
            </div>
          )}

          <div className="p-4 sm:p-6 md:p-8 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="text-xs sm:text-sm">
                <Tag className="w-3 h-3 mr-1" />
                {offer.type}
              </Badge>
              {offer.badge ? <Badge>{offer.badge}</Badge> : null}
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
              {offer.title}
            </h1>

            {offer.description ? (
              <p className="text-gray-700 text-sm sm:text-base leading-relaxed">
                {offer.description}
              </p>
            ) : null}

            <div className="flex items-end gap-3 pt-1">
              {offer.comboPrice ? (
                <span className="text-3xl sm:text-4xl font-bold text-emerald-600">
                  ৳ {offer.comboPrice}
                </span>
              ) : null}
              {offer.originalPrice &&
              offer.comboPrice &&
              offer.originalPrice > offer.comboPrice ? (
                <span className="text-base text-gray-400 line-through">
                  ৳ {offer.originalPrice}
                </span>
              ) : null}
              <span className="text-sm text-emerald-700 font-semibold">
                {offer.discountPercentage}% OFF
              </span>
            </div>

            {offer.products ? (
              <div className="pt-2">
                <h2 className="font-semibold text-gray-900 mb-2">
                  Products included
                </h2>
                <ul className="space-y-1 text-sm text-gray-700">
                  {offer.products
                    .split(",")
                    .map((item) => item.trim())
                    .filter(Boolean)
                    .map((item) => (
                      <li key={item}>• {item}</li>
                    ))}
                </ul>
              </div>
            ) : null}

            {offer.endDate ? (
              <p className="text-sm text-gray-600 pt-2 flex items-center">
                <Calendar className="w-4 h-4 mr-1" />
                Ends on{" "}
                {new Date(offer.endDate).toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </p>
            ) : null}

            <div className="pt-4">
              <Link href="/products?sort=discount">
                <Button size="lg" className="w-full sm:w-auto">
                  Shop This Offer
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
