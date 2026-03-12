/**
 * ORPC-powered Categories Carousel
 * Fetches and displays categories using the customer API
 */
"use client";

import { Package } from "lucide-react";
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
import { useActiveCategories } from "@/hooks/use-customer-api";

type ActiveCategory = NonNullable<
  ReturnType<typeof useActiveCategories>["data"]
>["categories"][number];

function CategoryItem({ category }: { category: ActiveCategory }) {
  return (
    <Link
      href={`/products/${category.slug}`}
      className="flex flex-col items-center group"
    >
      <div className="w-16 h-16 sm:w-20 sm:h-20 lg:w-24 lg:h-24 rounded-full bg-primary/10 flex items-center justify-center mb-2 group-hover:bg-primary/20 transition-colors overflow-hidden border-2 border-transparent group-hover:border-primary/30">
        {category.image ? (
          <Image
            src={category.image}
            alt={category.name}
            width={80}
            height={80}
            className="object-contain w-10 h-10 sm:w-14 sm:h-14 lg:w-16 lg:h-16"
          />
        ) : (
          <Package className="w-7 h-7 sm:w-10 sm:h-10 lg:w-12 lg:h-12 text-primary" />
        )}
      </div>
      <span className="text-xs sm:text-sm font-medium text-gray-800 text-center line-clamp-2 group-hover:text-primary transition-colors">
        {category.name}
      </span>
    </Link>
  );
}

export function OrpcCategoriesCarousel() {
  const { data, isLoading, isError } = useActiveCategories();

  if (isLoading) {
    return (
      <section className="py-6 bg-white border-b">
        <div className="container mx-auto px-4">
          <div className="flex justify-center gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex flex-col items-center">
                <Skeleton className="w-20 h-20 rounded-full mb-2" />
                <Skeleton className="h-3 w-16" />
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (isError || !data?.categories || data.categories.length === 0) {
    return null; // Don't show section if no categories
  }

  const categories = data.categories;

  return (
    <section className="py-6 bg-white border-b">
      <div className="container mx-auto px-4">
        {/* Mobile Carousel - single horizontal row */}
        <div className="sm:hidden px-6">
          <Carousel opts={{ align: "start", loop: true }} className="w-full">
            <CarouselContent className="-ml-3">
              {categories.map((category) => (
                <CarouselItem
                  key={category.slug}
                  className="pl-3 basis-[28%] min-w-0 shrink-0"
                >
                  <CategoryItem category={category} />
                </CarouselItem>
              ))}
            </CarouselContent>
            <CarouselPrevious className="left-0 z-10" />
            <CarouselNext className="right-0 z-10" />
          </Carousel>
        </div>

        {/* Tablet & Desktop Carousel */}
        <div className="hidden sm:block px-10">
          <Carousel opts={{ align: "start", loop: true }} className="w-full">
            <CarouselContent className="-ml-4">
              {categories.map((category) => (
                <CarouselItem
                  key={category.slug}
                  className="pl-4 basis-1/4 md:basis-1/5 lg:basis-[12.5%] xl:basis-[10%]"
                >
                  <CategoryItem category={category} />
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
