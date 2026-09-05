"use client";

import { useQuery } from "@tanstack/react-query";
import Image from "next/image";
import { useEffect, useState } from "react";
import { orpc } from "@/utils/orpc";

function BrandLogo({ src }: { src: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  // Saved brand logos may use external CDNs outside the product image allowlist.
  return (
    <Image
      unoptimized
      src={src}
      alt=""
      width={56}
      height={40}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className="h-10 w-14 shrink-0 object-contain"
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
      className="mt-10 scroll-mt-20 border-t border-slate-200 pt-6 pb-2"
    >
      <h2
        id="store-brands-heading"
        className="text-base font-semibold text-slate-950"
      >
        Available brands
      </h2>
      <ul
        className="mt-5 flex flex-wrap items-center gap-x-8 gap-y-5"
        aria-label="Brands available in this store"
      >
        {brands.map((brand) => (
          <li
            key={brand.id}
            className="flex min-h-10 max-w-full items-center gap-3"
          >
            {brand.logo && <BrandLogo key={brand.logo} src={brand.logo} />}
            <span className="min-w-0 break-words text-sm font-medium text-slate-700">
              {brand.name}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
