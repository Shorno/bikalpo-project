import { Building2, MapPin } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { PublicUnitListingCard } from "@/components/features/to-let/public-unit-listing-card";
import { getToLetQrProperty } from "@/lib/public-data";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Property availability",
  robots: {
    index: false,
    follow: false,
  },
};

interface QrPropertyPageProps {
  params: Promise<{ qrToken: string }>;
}

export default async function QrPropertyPage({ params }: QrPropertyPageProps) {
  const { qrToken } = await params;
  const result = await getToLetQrProperty(qrToken, 0);

  if (!result) {
    notFound();
  }

  const { property, listings } = result;

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <div className="container mx-auto px-4 py-8 md:py-12">
        <section className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
          <div className="grid md:grid-cols-[minmax(0,1fr)_2fr]">
            <div className="relative aspect-video bg-slate-100 md:aspect-auto">
              {property.coverImageUrl ? (
                <Image
                  src={property.coverImageUrl}
                  alt={property.name}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, 33vw"
                  unoptimized={property.coverImageUrl.startsWith("http")}
                />
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-slate-500">
                  No property photo available
                </div>
              )}
            </div>
            <div className="p-6 md:p-8">
              <p className="text-sm font-medium text-blue-600">
                Verified property
              </p>
              <h1 className="mt-1 text-2xl font-bold text-gray-900">
                {property.name}
              </h1>
              <p className="mt-3 flex items-center gap-2 text-sm text-gray-600">
                <MapPin className="h-4 w-4 shrink-0" />
                {[property.area, property.district, property.division]
                  .filter(Boolean)
                  .join(", ")}
              </p>
              <p className="mt-3 flex items-center gap-2 text-sm text-gray-600">
                <Building2 className="h-4 w-4 shrink-0" />
                {property.propertyType} / {property.buildingType}
              </p>
              {property.nearbyLandmark && (
                <p className="mt-3 text-sm text-gray-600">
                  Near {property.nearbyLandmark}
                </p>
              )}
            </div>
          </div>
        </section>

        <section className="mt-8" aria-labelledby="available-units-heading">
          <div className="mb-4">
            <h2
              id="available-units-heading"
              className="text-xl font-semibold text-gray-900"
            >
              Available units
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              These listings are currently available at this property.
            </p>
          </div>

          {listings.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-200 bg-white p-10 text-center text-gray-500">
              No units are currently available at this property.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {listings.map((listing) => (
                <PublicUnitListingCard
                  key={listing.listingCode}
                  listing={listing}
                  href={
                    listing.visibility === "public"
                      ? `/to-let/listings/${listing.listingCode}`
                      : null
                  }
                  phone={listing.contact.phone}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
