"use client";

/**
 * Route-level Error Page — catches errors in any route segment.
 * Rendered inside the root layout, so it has access to the design system.
 */

import { useEffect } from "react";
import { AlertTriangle, Home, RotateCcw } from "lucide-react";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Route error:", error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="text-center max-w-lg">
        {/* Animated background glow */}
        <div className="relative mb-8">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-32 h-32 rounded-full bg-destructive/5 blur-3xl animate-pulse" />
          </div>
          <div className="relative w-20 h-20 mx-auto rounded-2xl bg-destructive/10 border border-destructive/20 flex items-center justify-center">
            <AlertTriangle className="w-9 h-9 text-destructive" strokeWidth={1.5} />
          </div>
        </div>

        {/* Error code */}
        <p className="text-sm font-semibold tracking-widest text-destructive/70 uppercase mb-3">
          Something went wrong
        </p>

        {/* Title */}
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground mb-4">
          Oops! An error occurred
        </h1>

        {/* Description */}
        <p className="text-muted-foreground text-base leading-relaxed mb-6 max-w-md mx-auto">
          We encountered an unexpected problem while loading this page.
          Your data is safe — please try again or head back to the homepage.
        </p>

        {/* Error digest */}
        {error.digest && (
          <div className="inline-block mb-6">
            <code className="text-xs text-muted-foreground/60 bg-muted/50 px-3 py-1.5 rounded-lg border border-border/50 font-mono">
              Error ID: {error.digest}
            </code>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={reset}
            type="button"
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-primary-foreground bg-primary hover:bg-primary/90 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            Try Again
          </button>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-muted-foreground bg-secondary hover:bg-secondary/80 rounded-lg transition-all duration-200 border border-border/50 hover:border-border"
          >
            <Home className="w-4 h-4" />
            Go Home
          </Link>
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
