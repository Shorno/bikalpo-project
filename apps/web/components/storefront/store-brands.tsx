"use client";

import { useQuery } from "@tanstack/react-query";
import { Building2 } from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";
import { orpc } from "@/utils/orpc";

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

export function StoreBrands({ slug }: { slug: string }) {
  // Header, footer and this section share one cached, unfiltered inventory result.
  const { data } = useQuery(
    orpc.customer.getShopNavigation.queryOptions({ input: { slug } }),
  );
  const brands = data?.availableBrands;

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
      <div className="mx-auto max-w-7xl px-3 sm:px-6 lg:px-8">
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
        <ul
          className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6"
          aria-label="Brands available in this store"
        >
          {brands.map((brand) => (
            <li
              key={brand.id}
              className="flex min-h-28 min-w-0 flex-col items-center justify-center gap-3 rounded-xl border border-border bg-background px-4 py-5 text-center"
            >
              <div className="h-10 w-24">
                <BrandLogo key={brand.logo} src={brand.logo} />
              </div>
              <span className="max-w-full break-words text-xs font-medium text-foreground">
                {brand.name}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
