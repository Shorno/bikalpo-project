"use client";

import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

export function IncludedExcludedButtons({
  label,
  included,
  onChange,
  className,
}: {
  label: string;
  included: boolean;
  onChange?: (included: boolean) => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "inline-grid min-w-44 grid-cols-2 overflow-hidden rounded-md border border-gray-200 bg-white",
        className,
      )}
      role="group"
      aria-label={`${label}: Included or Excluded`}
    >
      <button
        type="button"
        aria-pressed={included}
        disabled={!onChange}
        className={cn(
          "flex min-h-9 items-center justify-center gap-1.5 border-r border-gray-200 px-3 text-xs font-semibold transition-colors disabled:cursor-default disabled:opacity-100",
          included
            ? "bg-emerald-600 text-white"
            : "bg-white text-gray-500 hover:bg-gray-50",
        )}
        onClick={() => onChange?.(true)}
      >
        <Check className="size-3.5" /> Included
      </button>
      <button
        type="button"
        aria-pressed={!included}
        disabled={!onChange}
        className={cn(
          "flex min-h-9 items-center justify-center gap-1.5 px-3 text-xs font-semibold transition-colors disabled:cursor-default disabled:opacity-100",
          included
            ? "bg-white text-gray-500 hover:bg-gray-50"
            : "bg-gray-700 text-white",
        )}
        onClick={() => onChange?.(false)}
      >
        <X className="size-3.5" /> Excluded
      </button>
    </div>
  );
}
