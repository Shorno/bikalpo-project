/**
 * ORPC-powered Categories Carousel
 * Shwapno-style: tall image cards with colored pill labels
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

// Rotating accent colors for category pills
const PILL_COLORS = [
  "bg-amber-400 text-amber-900",
  "bg-emerald-400 text-emerald-900",
  "bg-sky-400 text-sky-900",
  "bg-rose-400 text-rose-900",
  "bg-violet-400 text-violet-900",
  "bg-orange-400 text-orange-900",
  "bg-teal-400 text-teal-900",
  "bg-pink-400 text-pink-900",
  "bg-lime-400 text-lime-900",
  "bg-cyan-400 text-cyan-900",
  "bg-fuchsia-400 text-fuchsia-900",
  "bg-yellow-400 text-yellow-900",
];

function CategoryCard({
  category,
  colorIndex,
}: {
  category: ActiveCategory;
  colorIndex: number;
}) {
  const pillColor = PILL_COLORS[colorIndex % PILL_COLORS.length];

  return (
    <Link href={`/products/${category.slug}`} className="group block">
      <div className="relative rounded-xl overflow-hidden bg-gray-100 aspect-[3/4] shadow-sm group-hover:shadow-lg transition-shadow">
        {/* Category image */}
        {category.image ? (
          <Image
            src={category.image}
            alt={category.name}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-b from-gray-100 to-gray-200">
            <Package className="size-10 text-gray-300" />
          </div>
        )}

        {/* Category name pill at bottom */}
        <div className="absolute bottom-0 left-0 right-0 flex justify-center pb-3">
          <span
            className={`px-4 py-1.5 rounded-full text-xs font-bold shadow-md ${pillColor}`}
          >
            {category.name}
          </span>
        </div>
      </div>
    </Link>
  );
}

export function OrpcCategoriesCarousel() {
  const { data, isLoading, isError } = useActiveCategories();

  if (isLoading) {
    return (
      <div className="flex gap-3">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="flex-1 aspect-[3/4] rounded-xl min-w-0" />
        ))}
      </div>
    );
  }

  if (isError || !data?.categories || data.categories.length === 0) {
    return null;
  }

  const categories = data.categories;

  return (
    <>
      {/* Mobile Carousel */}
      <div className="sm:hidden">
        <Carousel opts={{ align: "start", loop: true }} className="w-full">
          <CarouselContent className="-ml-2">
            {categories.map((category, i) => (
              <CarouselItem
                key={category.slug}
                className="pl-2 basis-[35%] min-w-0 shrink-0"
              >
                <CategoryCard category={category} colorIndex={i} />
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
          <CarouselContent className="-ml-3">
            {categories.map((category, i) => (
              <CarouselItem
                key={category.slug}
                className="pl-3 basis-1/4 md:basis-1/5 lg:basis-1/6 xl:basis-[14.28%]"
              >
                <CategoryCard category={category} colorIndex={i} />
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselPrevious className="-left-4" />
          <CarouselNext className="-right-4" />
        </Carousel>
      </div>
    </>
  );
}
