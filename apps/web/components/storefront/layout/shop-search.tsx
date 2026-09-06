"use client";
import { Search, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export function ShopSearch({ storePath }: { storePath: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const query = searchParams.get("q") ?? "";
  const [value, setValue] = useState(query);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => setValue(query), [query]);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const updateSearch = (nextValue: string) => {
    setValue(nextValue);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const next = new URLSearchParams(searchParams.toString());
      const normalized = nextValue.trim().slice(0, 150);
      if (normalized) next.set("q", normalized);
      else next.delete("q");
      next.delete("page");
      const href = next.size ? `${storePath}?${next.toString()}` : storePath;
      router.replace(href, { scroll: false });
    }, 300);
  };

  return (
    <div className="relative min-w-0 flex-1 md:max-w-2xl">
      <Search
        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"
        aria-hidden="true"
      />
      <input
        type="search"
        value={value}
        onChange={(event) => updateSearch(event.target.value)}
        placeholder="Search this store"
        aria-label="Search products in this store"
        maxLength={150}
        className="h-10 w-full rounded-lg border border-[var(--header-line)] bg-white pl-9 pr-9 text-sm text-slate-950 outline-none placeholder:text-slate-400 focus:border-[var(--header-brand)] focus:ring-2 focus:ring-[var(--header-brand)]/20"
      />
      {value && (
        <button
          type="button"
          onClick={() => updateSearch("")}
          aria-label="Clear store search"
          className="absolute right-1 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
