"use client";

import { ChevronLeft, ChevronRight, Image as ImageIcon } from "lucide-react";
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
  const dotCount = Math.min(images.length, 5);
  const activeDot =
    images.length <= 5
      ? activeIndex
      : Math.round((activeIndex / (images.length - 1)) * (dotCount - 1));

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
    if (galleryHref) {
      return (
        <Link
          href={galleryHref}
          aria-label={`View ${alt} details`}
          className={cn(
            "flex aspect-video items-center justify-center bg-muted text-sm text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-primary",
            className,
          )}
        >
          No photo available
        </Link>
      );
    }
    return (
      <div
        className={cn(
          "flex aspect-video items-center justify-center bg-muted text-sm text-muted-foreground",
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
        "group/gallery relative aspect-video overflow-hidden bg-muted",
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

      {galleryHref ? (
        <Link
          href={galleryHref}
          aria-label={`View ${alt} details`}
          className="absolute inset-0 focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-primary"
        />
      ) : null}

      {hasMultipleImages && (
        <>
          <button
            type="button"
            onClick={() => setIsUserPaused((paused) => !paused)}
            className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-20 focus:rounded-md focus:bg-black/80 focus:px-3 focus:py-2 focus:text-sm focus:text-white"
            aria-label={
              isUserPaused
                ? "Resume automatic slideshow"
                : "Pause automatic slideshow"
            }
          >
            {isUserPaused ? "Resume slideshow" : "Pause slideshow"}
          </button>

          <div className="pointer-events-none absolute inset-x-0 top-1/2 z-10 hidden -translate-y-1/2 justify-between px-2 opacity-0 transition-opacity md:flex group-hover/gallery:opacity-100 group-focus-within/gallery:opacity-100 [@media(hover:none)]:hidden">
            <button
              type="button"
              onClick={showPrevious}
              className="pointer-events-auto relative inline-flex size-8 items-center justify-center rounded-full bg-black/65 text-white after:absolute after:-inset-1.5 hover:bg-black/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              aria-label="Show previous photo"
            >
              <ChevronLeft className="size-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={showNext}
              className="pointer-events-auto relative inline-flex size-8 items-center justify-center rounded-full bg-black/65 text-white after:absolute after:-inset-1.5 hover:bg-black/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              aria-label="Show next photo"
            >
              <ChevronRight className="size-4" aria-hidden="true" />
            </button>
          </div>
        </>
      )}

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 z-[5] h-14 bg-gradient-to-t from-black/40 to-transparent md:h-16"
      />

      {hasMultipleImages ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1 md:bottom-4"
        >
          {Array.from({ length: dotCount }, (_, index) => (
            <span
              key={index}
              className={cn(
                "h-1.5 rounded-full bg-white shadow-sm transition-all duration-300",
                index === activeDot ? "w-3.5 opacity-100" : "w-1.5 opacity-60",
              )}
            />
          ))}
        </div>
      ) : null}

      {galleryHref ? (
        <Link
          href={galleryHref}
          className={photoBadgeClassName}
          aria-label={`Open ${alt} photo gallery`}
        >
          <ImageIcon className="size-3 md:size-3.5" aria-hidden="true" />
          <span className="tabular-nums">{images.length}</span>
        </Link>
      ) : hasMultipleImages ? (
        <button
          type="button"
          onClick={showNext}
          className={photoBadgeClassName}
          aria-label={`Show next photo. Photo ${activeIndex + 1} of ${images.length} is currently shown`}
        >
          <ImageIcon className="size-3 md:size-3.5" aria-hidden="true" />
          <span className="tabular-nums">{images.length}</span>
        </button>
      ) : null}
    </div>
  );
}

const photoBadgeClassName =
  "absolute bottom-2 right-2 z-10 inline-flex h-6 items-center gap-1 rounded-full bg-black/45 px-2 text-[11px] font-medium text-white ring-1 ring-white/20 backdrop-blur-md transition-colors after:absolute after:-inset-2 hover:bg-black/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white md:bottom-3 md:right-3 md:h-7 md:px-2.5 md:text-xs";
