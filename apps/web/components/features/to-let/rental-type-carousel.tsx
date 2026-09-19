"use client";

import { Children, useRef, useState, type ReactNode } from "react";
import styles from "./rental-type-carousel.module.css";

export function RentalTypeCarousel({ children }: { children: ReactNode }) {
  const cards = Children.toArray(children);
  const pages = Array.from({ length: Math.ceil(cards.length / 4) }, (_, index) => cards.slice(index * 4, index * 4 + 4));
  const track = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  return <div className="mt-7">
    <div ref={track} className={styles.track} role="region" aria-label="Explore rental types" aria-roledescription="carousel" onScroll={() => {
      const element = track.current;
      if (!element) return;
      const offsets = Array.from(element.children).map(child => (child as HTMLElement).offsetLeft);
      setActive(offsets.reduce((nearest, offset, index) => Math.abs(offset - element.scrollLeft) < Math.abs(offsets[nearest] - element.scrollLeft) ? index : nearest, 0));
    }}>
      {pages.map((items, index) => <div key={index} className={styles.page} role="group" aria-label={`Category group ${index + 1} of ${pages.length}`}>{items}</div>)}
    </div>
    <div className="mt-2 flex justify-center md:hidden" aria-label="Category pages">
      {pages.map((_, index) => <button key={index} type="button" aria-label={`Show category group ${index + 1}`} aria-current={active === index ? "true" : undefined} className="flex size-11 items-center justify-center rounded-md focus-visible:outline-2 focus-visible:outline-ring" onClick={() => {
        const element = track.current;
        const target = element?.children[index] as HTMLElement | undefined;
        if (element && target) element.scrollTo({ left: target.offsetLeft, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
      }}><span className={`h-2 rounded-full ${active === index ? "w-6 bg-primary" : "w-2 bg-muted-foreground/35"}`} /></button>)}
    </div>
  </div>;
}
