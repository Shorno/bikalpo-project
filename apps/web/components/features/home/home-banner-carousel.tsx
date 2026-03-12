"use client";

import Image from "next/image";
import Link from "next/link";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { cn } from "@/lib/utils";

const banners = [
  {
    id: 1,
    image: "/images/hero-cover.jpg",
    alt: "Special Offers",
    href: "/products",
  },
  {
    id: 2,
    image: "/images/hero-cover.jpg",
    alt: "New Arrivals",
    href: "/products?sort=newest",
  },
  {
    id: 3,
    image: "/images/hero-cover.jpg",
    alt: "Best Sellers",
    href: "/products?sort=popular",
  },
];

interface HomeBannerCarouselProps {
  className?: string;
}

export function HomeBannerCarousel({ className }: HomeBannerCarouselProps) {
  return (
    <section className={cn("w-full bg-primary/10", className)}>
      <Carousel opts={{ loop: true }} className="w-full">
        <CarouselContent>
          {banners.map((banner) => (
            <CarouselItem key={banner.id}>
              <Link
                href={banner.href}
                className="block relative w-full aspect-[16/5] overflow-hidden bg-primary/20"
              >
                <Image
                  src={banner.image}
                  alt={banner.alt}
                  fill
                  className="object-cover"
                  priority={banner.id === 1}
                />
              </Link>
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious className="left-3" />
        <CarouselNext className="right-3" />
      </Carousel>
    </section>
  );
}
