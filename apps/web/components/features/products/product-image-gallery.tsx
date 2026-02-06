"use client";

import { ChevronLeft, ChevronRight, ZoomIn } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { Button } from "@/components/ui/button";

interface ProductImageGalleryProps {
  images: string[];
  productName: string;
  variant?: "default" | "emerald";
}

export function ProductImageGallery({
  images,
  productName,
  variant = "default",
}: ProductImageGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isZoomed, setIsZoomed] = useState(false);

  const isEmerald = variant === "emerald";
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
    <div className="space-y-4">
      {/* Main Image */}
      <div className="relative aspect-square bg-gray-100 rounded-lg overflow-hidden group">
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
          className="absolute top-4 right-4 p-2 bg-white/80 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <ZoomIn className="w-5 h-5 text-gray-600" />
        </button>

        {/* Navigation arrows */}
        {images.length > 1 && (
          <>
            <Button
              variant="ghost"
              size="icon"
              className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={handlePrevious}
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={handleNext}
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          </>
        )}

        {/* Image counter */}
        {images.length > 1 && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1 bg-black/60 text-white text-sm rounded-full">
            {selectedIndex + 1} / {images.length}
          </div>
        )}
      </div>

      {/* Thumbnail Gallery */}
      {images.length > 1 && (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {images.map((image, index) => (
            <button
              type="button"
              key={`${image}-${index}`}
              onClick={() => setSelectedIndex(index)}
              className={`relative flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 transition-all ${
                selectedIndex === index
                  ? activeBorderColor
                  : "border-gray-200 hover:border-gray-300"
              }`}
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
