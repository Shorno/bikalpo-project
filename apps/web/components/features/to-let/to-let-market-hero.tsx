"use client";

import { defaultToLetBanner, type ToLetBannerSlide } from "@bikalpo-project/api/lib/tolet-banner";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { type ReactNode, useEffect, useState } from "react";

/**
 * Landing hero: admin-managed banner slides with a centred headline, arrows and
 * dots. `children` (the search card) overlaps the banner's bottom edge.
 */
export function ToLetMarketHero({ slides, children }: { slides: ToLetBannerSlide[]; children: ReactNode }) {
  const items = slides.length ? slides : defaultToLetBanner;
  const [index, setIndex] = useState(0);
  const [interacting, setInteracting] = useState(false);
  useEffect(() => {
    if (items.length < 2 || interacting || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => setIndex(current => (current + 1) % items.length), 6000);
    return () => window.clearInterval(timer);
  }, [items.length, interacting]);
  const slide = items[index] ?? items[0];
  const go = (step: number) => setIndex(current => (current + step + items.length) % items.length);

  return (
    <section className="site-container px-4 pt-4 sm:px-6 sm:pt-6 lg:px-8">
      <div
        className="relative h-[200px] overflow-hidden rounded-2xl bg-primary sm:h-[280px] lg:h-[300px]"
        onMouseEnter={() => setInteracting(true)}
        onMouseLeave={() => setInteracting(false)}
        onFocusCapture={() => setInteracting(true)}
        onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setInteracting(false); }}
      >
        {slide ? (
          <Image src={slide.imageUrl} alt="" fill priority className="object-cover" sizes="100vw" unoptimized={slide.imageUrl.startsWith("https:")} />
        ) : null}
        <div className="absolute inset-0 bg-linear-to-r from-black/70 via-black/50 to-primary/45" aria-hidden="true" />
        <div className="relative flex h-full items-center justify-center px-14 pb-6 text-center sm:px-20">
          <h1 className="max-w-4xl text-xl leading-tight font-extrabold tracking-tight text-balance text-white uppercase [text-shadow:0_2px_8px_rgb(0_0_0/45%)] sm:text-3xl lg:text-4xl">
            {slide?.link ? (
              <Link href={slide.link} className="rounded-sm underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-white">{slide.title}</Link>
            ) : slide?.title}
          </h1>
        </div>
        {items.length > 1 ? (
          <>
            <button type="button" onClick={() => go(-1)} aria-label="Previous banner" className="absolute top-1/2 left-3 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-sm transition-colors hover:bg-white/30 focus-visible:outline-2 focus-visible:outline-white sm:left-4 sm:size-10">
              <ChevronLeft className="size-5" aria-hidden="true" />
            </button>
            <button type="button" onClick={() => go(1)} aria-label="Next banner" className="absolute top-1/2 right-3 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-sm transition-colors hover:bg-white/30 focus-visible:outline-2 focus-visible:outline-white sm:right-4 sm:size-10">
              <ChevronRight className="size-5" aria-hidden="true" />
            </button>
            <div className="absolute inset-x-0 bottom-9 flex justify-center gap-1.5 sm:bottom-10" aria-label="Banner slides">
              {items.map((_, i) => (
                <button key={i} type="button" onClick={() => setIndex(i)} aria-label={`Show banner ${i + 1}`} aria-pressed={i === index} className="flex h-4 items-center focus-visible:outline-2 focus-visible:outline-white">
                  <span className={`h-1.5 rounded-full transition-all ${i === index ? "w-5 bg-white" : "w-1.5 bg-white/55"}`} />
                </button>
              ))}
            </div>
          </>
        ) : null}
      </div>
      <div className="relative z-10 mx-auto -mt-7 max-w-[40rem] px-2 sm:-mt-8">{children}</div>
    </section>
  );
}
