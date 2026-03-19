import type { Metadata } from "next";
import { getToLetListings } from "@/lib/public-data";
import { PublicToLetCard } from "@/components/features/to-let/public-tolet-card";

export const metadata: Metadata = {
  title: "To-Let Listings",
  description: "Browse public To-Let listings",
};

export default async function ToLetPage() {
  const listings = await getToLetListings(300);

  return (
    <div className="bg-gradient-to-b from-gray-50 to-white min-h-screen">
      <div className="custom-container py-8 md:py-12">
        <div className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">
            To-Let Listings
          </h1>
          <p className="text-gray-500 mt-1">
            Find verified rental spaces from our network. Admin can manage
            listings in Dashboard {">"} To-Let.
          </p>
        </div>

        {listings.length === 0 ? (
          <div className="bg-white rounded-xl border border-dashed border-gray-200 p-10 text-center">
            <p className="text-gray-500">
              No To-Let listings are available yet.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {listings.map((listing: any) => (
              <PublicToLetCard key={listing.id} listing={listing} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
