/**
 * ORPC-powered announcement banner – shows active announcements.
 */
"use client";

import { Bell, X } from "lucide-react";
import { useState } from "react";
import { useAnnouncements } from "@/hooks/use-customer-api";

export function OrpcAnnouncementBanner() {
  const { data } = useAnnouncements();
  const [dismissed, setDismissed] = useState<Set<number>>(new Set());

  const announcements = (data?.announcements ?? []).filter(
    (a: any) => !dismissed.has(a.id),
  );

  if (announcements.length === 0) return null;

  return (
    <div className="space-y-0">
      {announcements.map((ann: any) => (
        <div
          key={ann.id}
          className="bg-emerald-600 text-white px-4 py-2 text-sm flex items-center justify-center relative"
        >
          <Bell className="h-3.5 w-3.5 mr-2 shrink-0" />
          <p className="text-center line-clamp-1">{ann.message || ann.title}</p>
          <button
            type="button"
            onClick={() => setDismissed((prev) => new Set([...prev, ann.id]))}
            className="absolute right-3 p-1 hover:bg-white/10 rounded"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
