/**
 * ORPC-powered Brands Carousel
 * Shwapno-style rounded cards matching the categories carousel
 */
"use client";

import { Building2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { SectionHeader } from "@/components/shared/section-header";
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
      <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-xl bg-white border border-gray-100 shadow-sm flex items-center justify-center mb-2 group-hover:shadow-md group-hover:border-primary/20 transition-all overflow-hidden p-3">
        {brand.logo ? (
          <Image
            src={brand.logo}
            alt={brand.name}
            width={100}
            height={100}
            className="object-contain"
          />
        ) : (
          <Building2 className="w-10 h-10 sm:w-12 sm:h-12 text-gray-400" />
        )}
      </div>
      <span className="text-xs sm:text-sm font-medium text-gray-700 text-center line-clamp-1 group-hover:text-primary transition-colors">
        {brand.name}
      </span>
    </Link>
  );
}

export function OrpcBrandsCarousel() {
  const { data, isLoading, isError } = useActiveBrands();

  if (isLoading) {
    return (
      <section className="py-6 bg-gray-50">
        <div className="container mx-auto px-4">
          <Skeleton className="h-6 w-28 mb-4" />
          <div className="flex gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex flex-col items-center">
                <Skeleton className="w-32 h-32 rounded-xl mb-2" />
                <Skeleton className="h-3 w-16" />
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (isError || !data?.brands || data.brands.length === 0) {
    return null;
  }

  const brands = data.brands;

  return (
    <section className="py-6 bg-gray-50">
      <div className="container mx-auto px-4">
        <SectionHeader title="Top Brands" viewAllHref="/products?view=brands" />

        {/* Mobile Carousel */}
        <div className="sm:hidden">
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
        <div className="hidden sm:block">
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
