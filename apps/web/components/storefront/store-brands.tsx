"use client";

import { useQuery } from "@tanstack/react-query";
import { Building2 } from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";
import {
  Carousel,
  type CarouselApi,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { orpc } from "@/utils/orpc";

const AUTO_SLIDE_MS = 2800;

function BrandLogo({ src }: { src: string | null }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <Building2
        className="mx-auto size-8 text-muted-foreground"
        aria-hidden="true"
      />
    );
  }
  // Saved brand logos may use external CDNs outside the product image allowlist.
  return (
    <Image
      unoptimized
      src={src}
      alt=""
      width={96}
      height={40}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className="h-10 w-24 object-contain"
    />
  );
}

/** Advances the carousel on a timer; pauses on hover/focus and for reduced motion. */
function useAutoSlide(api: CarouselApi | undefined, paused: boolean) {
  useEffect(() => {
    if (!api || paused) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => {
      // Nothing to slide when every brand already fits on screen;
      // otherwise step forward and rewind to the start at the end.
      if (api.canScrollNext()) api.scrollNext();
      else if (api.canScrollPrev()) api.scrollTo(0);
    }, AUTO_SLIDE_MS);
    return () => window.clearInterval(timer);
  }, [api, paused]);
}

export function StoreBrands({ slug }: { slug: string }) {
  // Header, footer and this section share one cached, unfiltered inventory result.
  const { data } = useQuery(
    orpc.customer.getShopNavigation.queryOptions({ input: { slug } }),
  );
  const brands = data?.availableBrands;
  const [api, setApi] = useState<CarouselApi>();
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  useAutoSlide(api, hovered || focused);

  useEffect(() => {
    if (!brands?.length || window.location.hash !== "#available-brands") return;
    const frame = requestAnimationFrame(() => {
      document
        .getElementById("available-brands")
        ?.scrollIntoView({ block: "start" });
    });
    return () => cancelAnimationFrame(frame);
  }, [brands?.length]);

  if (!brands?.length) return null;

  return (
    <section
      id="available-brands"
      aria-labelledby="store-brands-heading"
      className="scroll-mt-20 bg-[oklch(0.985_0.004_260)] py-12 sm:py-16"
    >
      <div className="site-container px-3 sm:px-6 lg:px-8">
        <div className="mb-6 sm:mb-8">
          <h2
            id="store-brands-heading"
            className="text-2xl font-semibold tracking-[-0.02em] text-foreground sm:text-3xl"
          >
            Available brands
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Brands available from this store.
          </p>
        </div>
        <Carousel
          setApi={setApi}
          opts={{ align: "start", containScroll: "trimSnaps" }}
          className="sm:px-10"
          aria-label="Brands available in this store"
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          onFocusCapture={() => setFocused(true)}
          onBlurCapture={() => setFocused(false)}
        >
          <CarouselContent className="-ml-3">
            {brands.map((brand) => (
              <CarouselItem
                key={brand.id}
                className="basis-1/2 pl-3 min-[480px]:basis-1/3 md:basis-1/4 lg:basis-1/6"
              >
                <div className="flex h-full min-h-28 min-w-0 flex-col items-center justify-center gap-3 rounded-xl border border-border bg-background px-4 py-5 text-center">
                  <div className="h-10 w-24">
                    <BrandLogo key={brand.logo} src={brand.logo} />
                  </div>
                  <span className="max-w-full break-words text-xs font-medium text-foreground">
                    {brand.name}
                  </span>
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselPrevious className="left-0 hidden sm:flex" />
          <CarouselNext className="right-0 hidden sm:flex" />
        </Carousel>
      </div>
    </section>
  );
}
