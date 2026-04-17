"use client";

/**
 * 404 Not Found Page — shown when a route doesn't exist.
 */

import { FileQuestion, Home, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="text-center max-w-lg">
        {/* Animated background glow */}
        <div className="relative mb-8">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-40 h-40 rounded-full bg-primary/5 blur-3xl animate-pulse" />
          </div>

          {/* Large 404 text */}
          <div className="relative">
            <p className="text-[8rem] sm:text-[10rem] font-black leading-none tracking-tighter text-foreground/[0.04] select-none">
              404
            </p>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-20 h-20 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                <FileQuestion className="w-9 h-9 text-primary" strokeWidth={1.5} />
              </div>
            </div>
          </div>
        </div>

        {/* Title */}
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground mb-4">
          Page not found
        </h1>

        {/* Description */}
        <p className="text-muted-foreground text-base leading-relaxed mb-8 max-w-md mx-auto">
          The page you&apos;re looking for doesn&apos;t exist or may have been moved.
          Check the URL or navigate back to familiar ground.
        </p>

        {/* Actions */}
        <div className="flex items-center justify-center gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-primary-foreground bg-primary hover:bg-primary/90 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0"
          >
            <Home className="w-4 h-4" />
            Go Home
          </Link>
          <button
            onClick={() => typeof window !== "undefined" && window.history.back()}
            type="button"
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-muted-foreground bg-secondary hover:bg-secondary/80 rounded-lg transition-all duration-200 border border-border/50 hover:border-border cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            Go Back
          </button>
        </div>

        {/* Decorative dots */}
        <div className="mt-16 flex items-center justify-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/20" />
          <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/15" />
          <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/10" />
        </div>
      </div>
    </div>
  );
}
