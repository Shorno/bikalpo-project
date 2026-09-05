"use client";

import { useEffect, useRef } from "react";
import { client } from "@/utils/orpc";

/** Prefetching listing data must never count as viewing the listing. */
export function ListingViewRecorder({
  listingCode,
  qrToken,
}: {
  listingCode: string;
  qrToken?: string;
}) {
  const recorded = useRef<string | null>(null);
  useEffect(() => {
    const key = `${listingCode}:${qrToken ?? "public"}`;
    function record() {
      if (document.visibilityState !== "visible" || recorded.current === key)
        return;
      recorded.current = key;
      // Analytics must not block booking or trigger a page error/retry loop.
      void client.toLetUnitListing
        .recordListingView({ listingCode, qrToken })
        .catch(() => {});
    }
    record();
    document.addEventListener("visibilitychange", record);
    return () => document.removeEventListener("visibilitychange", record);
  }, [listingCode, qrToken]);
  return null;
}
