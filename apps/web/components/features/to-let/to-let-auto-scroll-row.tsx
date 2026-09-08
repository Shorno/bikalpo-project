"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

export function ToLetAutoScrollRow({
  children,
  ariaLabel,
  itemClassName = "w-[86vw] max-w-sm sm:w-[calc((100%-1.25rem)/2)] xl:w-[calc((100%-2.5rem)/3)]",
}: {
  children: ReactNode[];
  ariaLabel: string;
  itemClassName?: string;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);

  const move = useCallback((direction: 1 | -1) => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const item = viewport.querySelector<HTMLElement>("[data-scroll-item]");
    const distance = (item?.offsetWidth ?? viewport.clientWidth) + 20;
    const atEnd =
      viewport.scrollLeft + viewport.clientWidth >= viewport.scrollWidth - 8;
    const atStart = viewport.scrollLeft <= 8;

    viewport.scrollTo({
      left:
        direction === 1 && atEnd
          ? 0
          : direction === -1 && atStart
            ? viewport.scrollWidth
            : viewport.scrollLeft + distance * direction,
      behavior: "smooth",
    });
  }, []);

  useEffect(() => {
    if (paused || children.length < 2) return;
    const timer = window.setInterval(() => move(1), 5000);
    return () => window.clearInterval(timer);
  }, [children.length, move, paused]);

  return (
    <div
      className="group/rail relative"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <div
        ref={viewportRef}
        role="region"
        aria-label={ariaLabel}
        className="flex snap-x snap-mandatory gap-5 overflow-x-auto pb-3 [scrollbar-color:theme(colors.blue.300)_transparent] [scrollbar-width:thin] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
      >
        {children.map((child, index) => (
          <div
            key={index}
            data-scroll-item
            className={`shrink-0 snap-start ${itemClassName}`}
          >
            {child}
          </div>
        ))}
      </div>

      {children.length > 1 ? (
        <div className="mt-3 flex justify-end gap-2">
          <button
            type="button"
            aria-label={`Show previous ${ariaLabel}`}
            onClick={() => move(-1)}
            className="inline-flex size-10 items-center justify-center rounded-full border border-border bg-background text-foreground transition-colors hover:border-primary/40 hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label={`Show next ${ariaLabel}`}
            onClick={() => move(1)}
            className="inline-flex size-10 items-center justify-center rounded-full border border-border bg-background text-foreground transition-colors hover:border-primary/40 hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <ChevronRight className="size-4" aria-hidden="true" />
          </button>
        </div>
      ) : null}
    </div>
  );
}
