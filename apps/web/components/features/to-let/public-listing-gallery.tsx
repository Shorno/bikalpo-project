"use client";

import {
  ChevronLeft,
  ChevronRight,
  ImageIcon,
  Pause,
  Play,
} from "lucide-react";
import Image from "next/image";
import {
  type FocusEvent,
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

const AUTO_ADVANCE_MS = 5_000;
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
  const [isUserPaused, setIsUserPaused] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isFocusWithin, setIsFocusWithin] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const thumbnailStripRef = useRef<HTMLDivElement | null>(null);
  const thumbnailRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const hasMultipleImages = images.length > 1;
  const isInteractionPaused = isHovered || isFocusWithin;

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
    if (
      !hasMultipleImages ||
      isUserPaused ||
      isInteractionPaused ||
      prefersReducedMotion
    ) {
      return;
    }

    const interval = window.setInterval(showNext, AUTO_ADVANCE_MS);
    return () => window.clearInterval(interval);
  }, [
    hasMultipleImages,
    isInteractionPaused,
    isUserPaused,
    prefersReducedMotion,
    showNext,
  ]);

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

  const handleBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setIsFocusWithin(false);
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
      <div className="flex aspect-video flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-gray-300 bg-gray-50 text-gray-500">
        <span className="flex size-12 items-center justify-center rounded-full bg-white shadow-sm">
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
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onFocusCapture={() => setIsFocusWithin(true)}
      onBlurCapture={handleBlur}
    >
      <div
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className="group relative aspect-video touch-pan-y overflow-hidden rounded-2xl border border-gray-200 bg-gray-100 shadow-sm"
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
              className="absolute left-3 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-gray-900 shadow-md transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100"
              aria-label="Show previous photo"
            >
              <ChevronLeft className="size-5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={showNext}
              className="absolute right-3 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-gray-900 shadow-md transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100"
              aria-label="Show next photo"
            >
              <ChevronRight className="size-5" aria-hidden="true" />
            </button>

            <button
              type="button"
              onClick={() => setIsUserPaused((paused) => !paused)}
              disabled={prefersReducedMotion}
              className="absolute left-3 top-3 inline-flex h-8 items-center gap-1.5 rounded-full bg-black/65 px-3 text-xs font-medium text-white shadow-sm backdrop-blur-sm transition hover:bg-black/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:cursor-default disabled:opacity-70"
              aria-label={
                prefersReducedMotion
                  ? "Automatic slideshow is off because reduced motion is enabled"
                  : isUserPaused
                    ? "Resume automatic slideshow"
                    : "Pause automatic slideshow"
              }
            >
              {isUserPaused || prefersReducedMotion ? (
                <Play className="size-3.5" aria-hidden="true" />
              ) : (
                <Pause className="size-3.5" aria-hidden="true" />
              )}
              {isUserPaused || prefersReducedMotion ? "Play" : "Pause"}
            </button>

            <span className="absolute bottom-3 right-3 rounded-full bg-black/65 px-3 py-1 text-xs font-semibold tabular-nums text-white backdrop-blur-sm">
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
              className={`relative aspect-[4/3] w-20 shrink-0 overflow-hidden rounded-lg border-2 bg-gray-100 transition sm:w-24 ${
                index === activeIndex
                  ? "border-emerald-600 ring-2 ring-emerald-100"
                  : "border-transparent opacity-75 hover:opacity-100"
              } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2`}
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
