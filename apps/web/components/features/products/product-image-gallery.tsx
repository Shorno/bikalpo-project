"use client";

import { ChevronLeft, ChevronRight, ZoomIn } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ProductImageGalleryProps {
  images: string[];
  productName: string;
  variant?: "default" | "emerald";
  density?: "default" | "compact";
}

const galleryDensityStyles = {
  default: {
    root: "space-y-4",
    mainImage: "aspect-square",
    zoomButton: "right-4 top-4 p-2",
    zoomIcon: "size-5",
    counter: "bottom-4 px-3 py-1 text-sm",
    thumbnails: "gap-3 pb-2",
    thumbnail: "size-20",
  },
  compact: {
    root: "space-y-2.5",
    mainImage: "aspect-[4/3]",
    zoomButton: "right-2 top-2 p-1.5",
    zoomIcon: "size-4",
    counter: "bottom-2 px-2 py-0.5 text-xs",
    thumbnails: "gap-2 pb-1",
    thumbnail: "size-14",
  },
} as const;

export function ProductImageGallery({
  images,
  productName,
  variant = "default",
  density = "default",
}: ProductImageGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isZoomed, setIsZoomed] = useState(false);

  const isEmerald = variant === "emerald";
  const densityStyles = galleryDensityStyles[density];
  const activeBorderColor = isEmerald
    ? "border-emerald-600 ring-emerald-200"
    : "border-blue-600 ring-blue-200";

  const handlePrevious = () => {
    setSelectedIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
  };

  const handleNext = () => {
    setSelectedIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
  };

  return (
    <div className={densityStyles.root}>
      {/* Main Image */}
      <div
        className={cn(
          "group relative overflow-hidden rounded-lg bg-gray-100",
          densityStyles.mainImage,
        )}
      >
        <Image
          src={images[selectedIndex]}
          alt={`${productName} - Image ${selectedIndex + 1}`}
          fill
          className={`object-contain transition-transform duration-300 ${
            isZoomed ? "scale-150 cursor-zoom-out" : "cursor-zoom-in"
          }`}
          onClick={() => setIsZoomed(!isZoomed)}
          priority
        />

        {/* Zoom indicator */}
        <button
          type="button"
          onClick={() => setIsZoomed(!isZoomed)}
          aria-label={
            isZoomed ? "Zoom out product image" : "Zoom product image"
          }
          aria-pressed={isZoomed}
          className={cn(
            "absolute rounded-full bg-white/80 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100",
            densityStyles.zoomButton,
          )}
        >
          <ZoomIn className={cn("text-gray-600", densityStyles.zoomIcon)} />
        </button>

        {/* Navigation arrows */}
        {images.length > 1 && (
          <>
            <Button
              variant="ghost"
              size="icon"
              className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/80 opacity-0 transition-opacity hover:bg-white group-hover:opacity-100 focus-visible:opacity-100"
              onClick={handlePrevious}
              aria-label="Previous product image"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/80 opacity-0 transition-opacity hover:bg-white group-hover:opacity-100 focus-visible:opacity-100"
              onClick={handleNext}
              aria-label="Next product image"
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          </>
        )}

        {/* Image counter */}
        {images.length > 1 && (
          <div
            className={cn(
              "absolute left-1/2 -translate-x-1/2 rounded-full bg-black/60 text-white",
              densityStyles.counter,
            )}
          >
            {selectedIndex + 1} / {images.length}
          </div>
        )}
      </div>

      {/* Thumbnail Gallery */}
      {images.length > 1 && (
        <div className={cn("flex overflow-x-auto", densityStyles.thumbnails)}>
          {images.map((image, index) => (
            <button
              type="button"
              key={`${image}-${index}`}
              onClick={() => setSelectedIndex(index)}
              aria-label={`View product image ${index + 1}`}
              aria-pressed={selectedIndex === index}
              className={cn(
                "relative shrink-0 overflow-hidden rounded-lg border-2 transition-colors",
                densityStyles.thumbnail,
                selectedIndex === index
                  ? activeBorderColor
                  : "border-gray-200 hover:border-gray-300",
              )}
            >
              <Image
                src={image}
                alt={`${productName} - Thumbnail ${index + 1}`}
                fill
                className="object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
