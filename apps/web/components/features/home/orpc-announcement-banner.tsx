/**
 * ORPC-powered announcement banner – shows active announcements.
 * Styled to match Shwapno's red/promotional banner feel.
 */
"use client";

import { Megaphone, X } from "lucide-react";
import { useState } from "react";
import { useAnnouncements } from "@/hooks/use-customer-api";

export function OrpcAnnouncementBanner() {
  const { data } = useAnnouncements();
  type AnnouncementItem = NonNullable<typeof data>["announcements"][number];
  const [dismissed, setDismissed] = useState<Set<number>>(new Set());

  const announcements = (data?.announcements ?? []).filter(
    (a) => !dismissed.has(a.id),
  );

  if (announcements.length === 0) return null;

  return (
    <div className="space-y-0">
      {announcements.map((ann: AnnouncementItem) => (
        <div
          key={ann.id}
          className="bg-primary text-white px-4 py-2 text-sm flex items-center justify-center relative"
        >
          <Megaphone className="h-3.5 w-3.5 mr-2 shrink-0" />
          <p className="text-center line-clamp-1 font-medium">
            {ann.description || ann.title}
          </p>
          <button
            type="button"
            onClick={() => setDismissed((prev) => new Set([...prev, ann.id]))}
            className="absolute right-3 p-1 hover:bg-white/20 rounded transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
