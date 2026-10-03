"use client";

import { Loader2, Search } from "lucide-react";
import { useFormStatus } from "react-dom";

export function ToLetSearchButton({ className }: { className: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={className}
      aria-busy={pending}
    >
      {pending ? (
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
      ) : (
        <Search className="size-4" aria-hidden="true" />
      )}
      {pending ? "Searching…" : "Search"}
    </button>
  );
}
