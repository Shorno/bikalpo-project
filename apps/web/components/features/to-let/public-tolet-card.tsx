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
      <article className="bg-card rounded-xl border border-border overflow-hidden shadow-sm hover:shadow-md transition-shadow">
        <div className="relative aspect-video bg-muted">
          <Image
            src={imageUrl}
            alt={listing.title}
            fill
            className="object-cover"
            unoptimized={imageUrl.startsWith("http")}
          />
        </div>

        <div className="p-4 space-y-2">
          <h3 className="text-lg font-semibold text-foreground">
            {listing.title}
          </h3>
          <p className="text-sm text-muted-foreground">{listing.location}</p>
          {listing.area && (
            <p className="text-sm text-muted-foreground">Area: {listing.area}</p>
          )}
          <p className="text-sm text-foreground line-clamp-2">
            {listing.description}
          </p>

          <div className="flex items-center justify-between pt-2">
            <span className="font-bold text-emerald-600">{`৳ ${Number(
              listing.rent,
            ).toLocaleString()}/month`}</span>
            <div className="text-xs font-medium text-primary flex items-center gap-1">
              Details <ArrowRight className="w-3 h-3" />
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Contact: {listing.contactInfo}
          </p>
        </div>
      </article>
    </Link>
  );
}
