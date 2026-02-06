import { VerifiedBuyerStats } from "@/components/features/users/verified-buyer-stats";
import { VerifiedCustomersFilters } from "@/components/features/users/verified-customers-filters";
import { VerifiedCustomersGrid } from "@/components/features/users/verified-customers-grid";
import { VerifiedTopBuyers } from "@/components/features/users/verified-top-buyers";

interface VerifiedCustomersPageProps {
  searchParams: Promise<{
    search?: string;
    area?: string;
    sortBy?: string;
    page?: string;
  }>;
}

export default function VerifiedCustomersPage({
  searchParams,
}: VerifiedCustomersPageProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section - Static Layout */}
      <div className="relative">
        {/* Background with Emerald Gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-600 to-emerald-800" />

        {/* Content */}
        <div className="relative py-12 md:py-16">
          <div className="container mx-auto px-4 text-center">
            {/* Title - Static */}
            <h1 className="text-2xl md:text-4xl font-bold text-white mb-3 tracking-wide">
              VERIFIED B2B CUSTOMERS
            </h1>

            {/* Subtitle - Static */}
            <p className="text-emerald-100 text-base mb-6">
              View other verified buyers and their purchase history.
            </p>

            {/* Verified Buyer Count with Avatar Stack - Dynamic with Suspense */}
            <VerifiedBuyerStats />

            {/* Search & Filters - Dynamic with Suspense */}
            <VerifiedCustomersFilters />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-12">
        {/* Top Buyers Section - Dynamic with Suspense */}
        <VerifiedTopBuyers />

        {/* All Customers Grid - Dynamic with Suspense */}
        <VerifiedCustomersGrid searchParams={searchParams} />
      </div>
    </div>
  );
}
