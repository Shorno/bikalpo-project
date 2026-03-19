"use client";

import Link from "next/link";
import type { ToletListing } from "@bikalpo-project/db/schema";
import { ArrowRight } from "lucide-react";
import Image from "next/image";

interface PublicToLetCardProps {
  listing: ToletListing;
}

export function PublicToLetCard({ listing }: PublicToLetCardProps) {
  const imageUrl =
    listing.imageUrl && listing.imageUrl.trim().length > 0
      ? listing.imageUrl
      : "/placeholder-image.svg";

  return (
    <Link href={`/to-let/${listing.id}`} className="block">
      <article className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
        <div className="relative aspect-video bg-slate-100">
          <Image
            src={imageUrl}
            alt={listing.title}
            fill
            className="object-cover"
            unoptimized={imageUrl.startsWith("http")}
          />
        </div>

        <div className="p-4 space-y-2">
          <h3 className="text-lg font-semibold text-gray-900">
            {listing.title}
          </h3>
          <p className="text-sm text-gray-500">{listing.location}</p>
          {listing.area && (
            <p className="text-sm text-gray-500">Area: {listing.area}</p>
          )}
          <p className="text-sm text-gray-700 line-clamp-2">
            {listing.description}
          </p>

          <div className="flex items-center justify-between pt-2">
            <span className="font-bold text-emerald-600">{`৳ ${Number(
              listing.rent,
            ).toLocaleString()}/month`}</span>
            <div className="text-xs font-medium text-blue-600 flex items-center gap-1">
              Details <ArrowRight className="w-3 h-3" />
            </div>
          </div>

          <p className="text-xs text-gray-500">
            Contact: {listing.contactInfo}
          </p>
        </div>
      </article>
    </Link>
  );
}
