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

interface Category {
  name: string;
  slug: string;
  image: string | null;
}

interface CategoriesCarouselProps {
  categories: Category[];
}

function CategoryItem({ category }: { category: Category }) {
  return (
    <Link
      href={`/products/${category.slug}`}
      className="flex flex-col items-center group"
    >
      <div className="w-16 h-16 sm:w-24 sm:h-24 lg:w-28 lg:h-28 rounded-full bg-blue-50 flex items-center justify-center mb-2 sm:mb-3 group-hover:bg-blue-100 transition-colors overflow-hidden">
        {category.image ? (
          <Image
            src={category.image}
            alt={category.name}
            width={80}
            height={80}
            className="object-contain w-10 h-10 sm:w-16 sm:h-16 lg:w-20 lg:h-20"
          />
        ) : (
          <Package className="w-8 h-8 sm:w-12 sm:h-12 lg:w-14 lg:h-14 text-blue-600" />
        )}
      </div>
      <span className="text-xs sm:text-sm lg:text-base font-medium text-gray-900 text-center line-clamp-2">
        {category.name}
      </span>
    </Link>
  );
}

export function CategoriesCarousel({ categories }: CategoriesCarouselProps) {
  return (
    <section className="py-10 sm:py-16 bg-white">
      <div className="container mx-auto px-4 md:px-0">
        <h2 className="text-2xl sm:text-3xl font-bold text-center mb-8 sm:mb-12">
          Categories
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
        <div className="hidden sm:block px-12">
          <Carousel
            opts={{
              align: "start",
              loop: true,
            }}
            className="w-full"
          >
            <CarouselContent className="-ml-4">
              {categories.map((category) => (
                <CarouselItem
                  key={category.slug}
                  className="pl-4 basis-1/3 md:basis-1/4 lg:basis-1/6 xl:basis-[14.28%]"
                >
                  <CategoryItem category={category} />
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
