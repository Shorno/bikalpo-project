"use client";

import { ChevronLeft, ChevronRight, ImageIcon } from "lucide-react";
import Image from "next/image";
import {
  type KeyboardEvent,
  type TouchEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

interface PublicListingGalleryProps {
  imageUrls: string[];
  alt: string;
}

const SWIPE_THRESHOLD_PX = 45;
const MAX_IMAGES = 12;

export function PublicListingGallery({
  imageUrls,
  alt,
}: PublicListingGalleryProps) {
  const images = useMemo(
    () =>
      Array.from(
        new Set(
          imageUrls
            .filter((imageUrl) => imageUrl.trim().length > 0)
            .map((imageUrl) => imageUrl.trim()),
        ),
      ).slice(0, MAX_IMAGES),
    [imageUrls],
  );
  const [activeIndex, setActiveIndex] = useState(0);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const thumbnailStripRef = useRef<HTMLDivElement | null>(null);
  const thumbnailRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const hasMultipleImages = images.length > 1;

  useEffect(() => {
    setActiveIndex((index) => Math.min(index, Math.max(images.length - 1, 0)));
  }, [images.length]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setPrefersReducedMotion(mediaQuery.matches);

    updatePreference();
    mediaQuery.addEventListener("change", updatePreference);
    return () => mediaQuery.removeEventListener("change", updatePreference);
  }, []);

  const showNext = useCallback(() => {
    if (images.length < 2) return;
    setActiveIndex((index) => (index + 1) % images.length);
  }, [images.length]);

  const showPrevious = useCallback(() => {
    if (images.length < 2) return;
    setActiveIndex((index) => (index - 1 + images.length) % images.length);
  }, [images.length]);

  useEffect(() => {
    const strip = thumbnailStripRef.current;
    const thumbnail = thumbnailRefs.current[activeIndex];
    if (!strip || !thumbnail) return;

    const targetLeft =
      thumbnail.offsetLeft - (strip.clientWidth - thumbnail.offsetWidth) / 2;
    strip.scrollTo({
      left: Math.max(0, targetLeft),
      behavior: prefersReducedMotion ? "auto" : "smooth",
    });
  }, [activeIndex, prefersReducedMotion]);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!hasMultipleImages) return;

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      showPrevious();
    }

    if (event.key === "ArrowRight") {
      event.preventDefault();
      showNext();
    }
  };

  const handleTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    touchStartX.current = event.changedTouches[0]?.clientX ?? null;
  };

  const handleTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    const startX = touchStartX.current;
    const endX = event.changedTouches[0]?.clientX;
    touchStartX.current = null;

    if (startX === null || endX === undefined) return;

    const distance = startX - endX;
    if (Math.abs(distance) < SWIPE_THRESHOLD_PX) return;

    if (distance > 0) showNext();
    else showPrevious();
  };

  if (images.length === 0) {
    return (
      <div className="flex aspect-video flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-zinc-300 bg-zinc-50 text-zinc-500">
        <span className="flex size-12 items-center justify-center rounded-full border border-zinc-200 bg-white">
          <ImageIcon className="size-5" aria-hidden="true" />
        </span>
        <p className="text-sm font-medium">No photos available</p>
      </div>
    );
  }

  const activeImage = images[activeIndex] ?? images[0];

  return (
    <section
      aria-roledescription="carousel"
      aria-label={`${alt} photo gallery`}
      className="space-y-3"
      onKeyDown={handleKeyDown}
    >
      <div
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className="group relative aspect-video touch-pan-y overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100"
      >
        <Image
          key={activeImage}
          src={activeImage}
          alt={`${alt} photo ${activeIndex + 1} of ${images.length}`}
          fill
          priority
          loading="eager"
          className="object-cover"
          sizes="(max-width: 1024px) 100vw, 760px"
          unoptimized={activeImage.startsWith("http")}
        />

        {hasMultipleImages ? (
          <>
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/45 to-transparent" />

            <button
              type="button"
              onClick={showPrevious}
              className="absolute left-3 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/70 bg-white/90 text-zinc-900 transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100"
              aria-label="Show previous photo"
            >
              <ChevronLeft className="size-5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={showNext}
              className="absolute right-3 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/70 bg-white/90 text-zinc-900 transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100"
              aria-label="Show next photo"
            >
              <ChevronRight className="size-5" aria-hidden="true" />
            </button>

            <span className="absolute bottom-3 right-3 rounded-md bg-black/70 px-2.5 py-1 text-xs font-semibold tabular-nums text-white">
              {activeIndex + 1} / {images.length}
            </span>
          </>
        ) : null}
      </div>

      {hasMultipleImages ? (
        <div
          ref={thumbnailStripRef}
          role="group"
          className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]"
          aria-label="Choose a listing photo"
        >
          {images.map((imageUrl, index) => (
            <button
              key={`${imageUrl}-${index}`}
              ref={(element) => {
                thumbnailRefs.current[index] = element;
              }}
              type="button"
              onClick={() => setActiveIndex(index)}
              aria-label={`Show photo ${index + 1} of ${images.length}`}
              aria-pressed={index === activeIndex}
              className={`relative aspect-[4/3] w-20 shrink-0 overflow-hidden rounded-md border-2 bg-zinc-100 transition sm:w-24 ${
                index === activeIndex
                  ? "border-blue-600 ring-2 ring-blue-100"
                  : "border-transparent opacity-75 hover:opacity-100"
              } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2`}
            >
              <Image
                src={imageUrl}
                alt=""
                fill
                className="object-cover"
                sizes="96px"
                unoptimized={imageUrl.startsWith("http")}
              />
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}
