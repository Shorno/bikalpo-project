"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * A single row of chips that scrolls sideways (swipe on touch, arrow
 * buttons on wider screens) instead of wrapping when there are many.
 */
export function HorizontalScrollRow({
  children,
  label,
  className,
}: {
  children: ReactNode;
  label: string;
  className?: string;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: false, end: false });

  const updateEdges = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    setEdges({
      start: el.scrollLeft > 4,
      end: el.scrollLeft + el.clientWidth < el.scrollWidth - 4,
    });
  }, []);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    updateEdges();
    const observer = new ResizeObserver(updateEdges);
    observer.observe(el);
    for (const child of Array.from(el.children)) observer.observe(child);
    el.addEventListener("scroll", updateEdges, { passive: true });
    return () => {
      observer.disconnect();
      el.removeEventListener("scroll", updateEdges);
    };
  }, [updateEdges]);

  const scrollBy = (direction: 1 | -1) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({
      left: direction * Math.max(160, el.clientWidth * 0.7),
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
    });
  };

  return (
    <div className={cn("relative", className)}>
      <div
        ref={scrollerRef}
        role="group"
        aria-label={label}
        className="flex snap-x gap-2 overflow-x-auto scroll-smooth pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [&>*]:snap-start"
      >
        {children}
      </div>
      {edges.start && (
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center bg-gradient-to-r from-white via-white/90 to-transparent pr-6 pb-1">
          <button
            type="button"
            onClick={() => scrollBy(-1)}
            aria-label="Scroll categories left"
            className="pointer-events-auto hidden size-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm hover:border-slate-400 md:flex"
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
          </button>
        </div>
      )}
      {edges.end && (
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center bg-gradient-to-l from-white via-white/90 to-transparent pl-6 pb-1">
          <button
            type="button"
            onClick={() => scrollBy(1)}
            aria-label="Scroll categories right"
            className="pointer-events-auto hidden size-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm hover:border-slate-400 md:flex"
          >
            <ChevronRight className="size-4" aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
}
