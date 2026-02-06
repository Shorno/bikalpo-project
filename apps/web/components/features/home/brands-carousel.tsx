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

interface Brand {
  id: number;
  name: string;
  slug: string;
  logo: string;
}

interface BrandsCarouselProps {
  brands: Brand[];
}

function BrandItem({ brand }: { brand: Brand }) {
  return (
    <Link
      href={`/products?brand=${brand.slug}`}
      className="flex flex-col items-center group"
    >
      <div className="w-16 h-16 sm:w-24 sm:h-24 lg:w-28 lg:h-28 rounded-full bg-white border border-gray-200 flex items-center justify-center mb-2 sm:mb-3 group-hover:border-blue-300 group-hover:shadow-md transition-all overflow-hidden p-2 sm:p-3">
        {brand.logo ? (
          <Image
            src={brand.logo}
            alt={brand.name}
            width={80}
            height={80}
            className="object-contain grayscale group-hover:grayscale-0 transition-all w-10 h-10 sm:w-16 sm:h-16 lg:w-20 lg:h-20"
          />
        ) : (
          <Building2 className="w-8 h-8 sm:w-12 sm:h-12 lg:w-14 lg:h-14 text-gray-400" />
        )}
      </div>
      <span className="text-xs sm:text-sm lg:text-base font-medium text-gray-900 text-center line-clamp-1">
        {brand.name}
      </span>
    </Link>
  );
}

export function BrandsCarousel({ brands }: BrandsCarouselProps) {
  if (brands.length === 0) {
    return (
      <section className="py-10 sm:py-12 bg-gray-50">
        <div className="container mx-auto px-4 md:px-0">
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-8">
            Top Brands
          </h2>
          <p className="text-center text-gray-500">No brands available</p>
        </div>
      </section>
    );
  }

  return (
    <section className="py-10 sm:py-12 bg-gray-50">
      <div className="container mx-auto px-4 md:px-0">
        <h2 className="text-2xl sm:text-3xl font-bold text-center mb-8 sm:mb-12">
          Top Brands
        </h2>

        {/* Mobile Carousel - single horizontal row */}
        <div className="sm:hidden px-8">
          <Carousel
            opts={{
              align: "start",
              loop: true,
            }}
            className="w-full"
          >
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

        {/* Tablet & Desktop Carousel */}
        <div className="hidden sm:block px-12">
          <Carousel
            opts={{
              align: "start",
              loop: true,
            }}
            className="w-full"
          >
            <CarouselContent className="-ml-4">
              {brands.map((brand) => (
                <CarouselItem
                  key={brand.id}
                  className="pl-4 basis-1/3 md:basis-1/4 lg:basis-1/6 xl:basis-[14.28%]"
                >
                  <BrandItem brand={brand} />
                </CarouselItem>
              ))}
            </CarouselContent>
            <CarouselPrevious className="-left-10 z-10" />
            <CarouselNext className="-right-10 z-10" />
          </Carousel>
        </div>
      </div>
    </section>
  );
}
