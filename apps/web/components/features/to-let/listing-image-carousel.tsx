"use client";

import { ChevronLeft, ChevronRight, Images, Pause, Play } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import {
  type FocusEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { cn } from "@/lib/utils";

interface ListingImageCarouselProps {
  imageUrls: string[];
  alt: string;
  className?: string;
  sizes?: string;
  galleryHref?: string | null;
}

const AUTO_ADVANCE_MS = 5_000;

export function ListingImageCarousel({
  imageUrls,
  alt,
  className,
  sizes = "(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw",
  galleryHref,
}: ListingImageCarouselProps) {
  const images = useMemo(
    () => imageUrls.filter((imageUrl) => imageUrl.trim().length > 0),
    [imageUrls],
  );
  const [activeIndex, setActiveIndex] = useState(0);
  const [isInteractionPaused, setIsInteractionPaused] = useState(false);
  const [isUserPaused, setIsUserPaused] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const hasMultipleImages = images.length > 1;
  const isPaused = isInteractionPaused || isUserPaused;

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
    setActiveIndex((index) => (index + 1) % images.length);
  }, [images.length]);

  const showPrevious = useCallback(() => {
    setActiveIndex((index) => (index - 1 + images.length) % images.length);
  }, [images.length]);

  useEffect(() => {
    if (!hasMultipleImages || isPaused || prefersReducedMotion) return;

    const interval = window.setInterval(showNext, AUTO_ADVANCE_MS);
    return () => window.clearInterval(interval);
  }, [hasMultipleImages, isPaused, prefersReducedMotion, showNext]);

  const resumeWhenFocusLeaves = (event: FocusEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget)) {
      setIsInteractionPaused(false);
    }
  };

  if (images.length === 0) {
    return (
      <div
        className={cn(
          "flex aspect-video items-center justify-center bg-slate-100 text-sm text-slate-500",
          className,
        )}
      >
        No photo available
      </div>
    );
  }

  const activeImage = images[activeIndex] ?? images[0];

  return (
    <div
      role="region"
      className={cn(
        "group relative aspect-video overflow-hidden bg-slate-100",
        className,
      )}
      aria-roledescription="carousel"
      aria-label={`${alt} photos`}
      onMouseEnter={() => setIsInteractionPaused(true)}
      onMouseLeave={() => setIsInteractionPaused(false)}
      onFocusCapture={() => setIsInteractionPaused(true)}
      onBlurCapture={resumeWhenFocusLeaves}
    >
      <Image
        src={activeImage}
        alt={`${alt} photo ${activeIndex + 1} of ${images.length}`}
        fill
        className="object-cover"
        sizes={sizes}
        unoptimized={activeImage.startsWith("http")}
      />

      {hasMultipleImages && (
        <>
          <button
            type="button"
            onClick={() => setIsUserPaused((paused) => !paused)}
            className="absolute right-2 top-2 z-10 inline-flex size-11 items-center justify-center rounded-full bg-black/65 text-white hover:bg-black/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            aria-label={
              isUserPaused
                ? "Resume automatic slideshow"
                : "Pause automatic slideshow"
            }
          >
            {isUserPaused ? (
              <Play className="size-3.5" aria-hidden="true" />
            ) : (
              <Pause className="size-3.5" aria-hidden="true" />
            )}
          </button>

          <div className="absolute inset-x-0 top-1/2 flex -translate-y-1/2 justify-between px-2 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
            <button
              type="button"
              onClick={showPrevious}
              className="inline-flex size-11 items-center justify-center rounded-full bg-black/65 text-white hover:bg-black/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              aria-label="Show previous photo"
            >
              <ChevronLeft className="size-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={showNext}
              className="inline-flex size-11 items-center justify-center rounded-full bg-black/65 text-white hover:bg-black/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              aria-label="Show next photo"
            >
              <ChevronRight className="size-4" aria-hidden="true" />
            </button>
          </div>
        </>
      )}

      {galleryHref ? (
        <Link
          href={galleryHref}
          className="absolute bottom-3 right-3 z-10 inline-flex h-9 min-w-12 items-center justify-center gap-1 rounded-lg bg-zinc-950/90 px-2.5 text-white transition-colors after:absolute after:-inset-1 hover:bg-zinc-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          aria-label={`Open ${alt} photo gallery`}
        >
          <Images className="size-5" aria-hidden="true" />
          <span className="text-xs font-semibold tabular-nums">
            {images.length}
          </span>
        </Link>
      ) : hasMultipleImages ? (
        <button
          type="button"
          onClick={showNext}
          className="absolute bottom-3 right-3 z-10 inline-flex h-9 min-w-12 items-center justify-center gap-1 rounded-lg bg-zinc-950/90 px-2.5 text-white transition-colors after:absolute after:-inset-1 hover:bg-zinc-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          aria-label={`Show next photo. Photo ${activeIndex + 1} of ${images.length} is currently shown`}
        >
          <Images className="size-5" aria-hidden="true" />
          <span className="text-xs font-semibold tabular-nums">
            {images.length}
          </span>
        </button>
      ) : null}
    </div>
  );
}
