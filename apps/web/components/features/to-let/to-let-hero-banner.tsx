"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { defaultToLetBanner, type ToLetBannerSlide } from "@bikalpo-project/api/lib/tolet-banner";

export function ToLetHeroBanner({ slides, className, children }: { slides: ToLetBannerSlide[]; className: string; children: ReactNode }) {
  const items = slides.length ? slides : defaultToLetBanner;
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [interacting, setInteracting] = useState(false);
  useEffect(() => {
    if (items.length < 2 || paused || interacting || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => setIndex(current => (current + 1) % items.length), 6000);
    return () => window.clearInterval(timer);
  }, [items.length, paused, interacting]);
  const slide = items[index] ?? items[0];
  return <div className={className} onMouseEnter={() => setInteracting(true)} onMouseLeave={() => setInteracting(false)} onFocusCapture={() => setInteracting(true)} onBlurCapture={e => { if (!e.currentTarget.contains(e.relatedTarget)) setInteracting(false); }}>
    <Image src={slide.imageUrl} alt={slide.title} fill priority className="object-cover" sizes="(max-width: 1024px) 100vw, 980px" unoptimized={slide.imageUrl.startsWith("https:")} />
    <div className="absolute inset-0 bg-linear-to-b from-black/50 via-black/10 to-black/35 md:bg-linear-to-r md:from-black/80 md:via-black/60 md:to-black/25" aria-hidden="true" />
    <div className="relative flex min-h-[500px] max-w-3xl flex-col justify-center px-6 py-9 text-white sm:min-h-[460px] sm:px-10 lg:px-12">
      <div data-slot="hero-heading">
        <p className="text-xs font-semibold tracking-[0.16em] text-white uppercase">Bikalpo To-Let</p>
        <h1 className="mt-4 max-w-2xl text-4xl font-bold leading-[1.08] tracking-[-0.035em] [text-shadow:0_2px_6px_rgb(0_0_0/50%)] sm:text-5xl">{slide.link ? <Link href={slide.link} className="rounded-sm underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-white">{slide.title}</Link> : slide.title}</h1>
      </div>
      {items.length > 1 && <div data-slot="banner-controls" className="flex items-center gap-1 py-2" aria-label="Banner slides">
        {items.map((_, i) => <button type="button" key={i} aria-label={`Show banner ${i + 1}`} aria-pressed={i === index} className="flex size-11 items-center justify-center" onClick={() => setIndex(i)}><span className={`h-2 rounded-full ${i === index ? "w-6 bg-current" : "w-2 bg-current opacity-50"}`} /></button>)}
        <button type="button" className="min-h-11 px-2 text-xs underline" onClick={() => setPaused(value => !value)}>{paused ? "Play" : "Pause"}</button>
      </div>}
      {children}
    </div>
  </div>;
}
