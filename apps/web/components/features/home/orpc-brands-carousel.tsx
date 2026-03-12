/**
 * ORPC-powered Brands Carousel
 * Fetches and displays brands using the customer API
 */
"use client";

import { Building2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { Skeleton } from "@/components/ui/skeleton";
import { useActiveBrands } from "@/hooks/use-customer-api";

type ActiveBrand = NonNullable<
  ReturnType<typeof useActiveBrands>["data"]
>["brands"][number];

function BrandItem({ brand }: { brand: ActiveBrand }) {
  return (
    <Link
      href={`/products?brand=${brand.slug}`}
      className="flex flex-col items-center group"
    >
      <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-white border-2 border-gray-100 flex items-center justify-center mb-2 group-hover:border-primary/30 group-hover:shadow-md transition-all overflow-hidden p-2">
        {brand.logo ? (
          <Image
            src={brand.logo}
            alt={brand.name}
            width={60}
            height={60}
            className="object-contain grayscale group-hover:grayscale-0 transition-all"
          />
        ) : (
          <Building2 className="w-8 h-8 sm:w-10 sm:h-10 text-gray-400" />
        )}
      </div>
      <span className="text-xs font-medium text-gray-700 text-center line-clamp-1 group-hover:text-primary transition-colors">
        {brand.name}
      </span>
    </Link>
  );
}

export function OrpcBrandsCarousel() {
  const { data, isLoading, isError } = useActiveBrands();

  if (isLoading) {
    return (
      <section className="py-6 bg-gray-50 border-b">
        <div className="container mx-auto px-4">
          <Skeleton className="h-6 w-28 mb-4" />
          <div className="flex justify-center gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex flex-col items-center">
                <Skeleton className="w-20 h-20 rounded-full mb-2" />
                <Skeleton className="h-3 w-14" />
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (isError || !data?.brands || data.brands.length === 0) {
    return null; // Don't show section if no brands
  }

  const brands = data.brands;

  return (
    <section className="py-6 bg-gray-50 border-b">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900">Top Brands</h2>
        </div>

        {/* Mobile Carousel */}
        <div className="sm:hidden px-6">
          <Carousel opts={{ align: "start", loop: true }} className="w-full">
            <CarouselContent className="-ml-3">
              {brands.map((brand) => (
                <CarouselItem
                  key={brand.id}
                  className="pl-3 basis-[28%] min-w-0 shrink-0"
                >
                  <BrandItem brand={brand} />
                </CarouselItem>
              ))}
            </CarouselContent>
            <CarouselPrevious className="left-0 z-10" />
            <CarouselNext className="right-0 z-10" />
          </Carousel>
        </div>

        {/* Desktop Carousel */}
        <div className="hidden sm:block px-10">
          <Carousel opts={{ align: "start", loop: true }} className="w-full">
            <CarouselContent className="-ml-4">
              {brands.map((brand) => (
                <CarouselItem
                  key={brand.id}
                  className="pl-4 basis-1/4 md:basis-1/5 lg:basis-[12.5%] xl:basis-[10%]"
                >
                  <BrandItem brand={brand} />
                </CarouselItem>
              ))}
            </CarouselContent>
            <CarouselPrevious className="-left-5" />
            <CarouselNext className="-right-5" />
          </Carousel>
        </div>
      </div>
    </section>
  );
}
