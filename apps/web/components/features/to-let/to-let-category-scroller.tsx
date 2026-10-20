"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { type ReactNode, useRef } from "react";
import { toLetChipRow } from "./to-let-button";

/** One-line category chips that scroll sideways, with arrow buttons at both ends. */
export function ToLetCategoryScroller({ label, children }: { label: string; children: ReactNode }) {
  const track = useRef<HTMLElement>(null);
  const scroll = (direction: 1 | -1) => {
    const element = track.current;
    if (!element) return;
    element.scrollBy({
      left: direction * Math.max(160, element.clientWidth * 0.6),
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
    });
  };
  const arrow = "flex size-8 shrink-0 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-xs transition-colors hover:border-primary/40 hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";
  return (
    <div className="flex items-center gap-2 sm:gap-3">
      <button type="button" onClick={() => scroll(-1)} aria-label="Scroll categories left" className={arrow}>
        <ChevronLeft className="size-4" aria-hidden="true" />
      </button>
      <nav ref={track} aria-label={label} className={`flex min-w-0 flex-1 gap-2 overflow-x-auto scroll-smooth py-0.5 sm:gap-3 ${toLetChipRow}`}>
        {children}
      </nav>
      <button type="button" onClick={() => scroll(1)} aria-label="Scroll categories right" className={arrow}>
        <ChevronRight className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}
