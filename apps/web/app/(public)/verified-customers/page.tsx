import { Suspense } from "react";
import {
  getVerifiedUsers,
  getVerifiedUsersCount,
} from "@/actions/users/get-verified-users";
import { TopBuyers } from "@/components/features/users/top-buyers";
import { VerifiedCustomersCta } from "@/components/features/users/verified-customers-cta";
import { VerifiedCustomersGrid } from "@/components/features/users/verified-customers-grid";
import { VerifiedCustomersHero } from "@/components/features/users/verified-customers-hero";
import { Skeleton } from "@/components/ui/skeleton";

interface VerifiedCustomersPageProps {
  searchParams: Promise<{
    search?: string;
    area?: string;
    sortBy?: string;
    page?: string;
  }>;
}

function GridSkeleton() {
  return (
    <>
      {/* Section Title Skeleton */}
      <div className="mb-8 flex justify-center">
        <Skeleton className="h-7 w-64" />
      </div>

      {/* Grid Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="border-2 border-gray-100 rounded-lg p-5 space-y-4 bg-white"
          >
            {/* Header: Avatar + Info */}
            <div className="flex items-start gap-4">
              <Skeleton className="w-14 h-14 rounded-full shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-2/5" />
              </div>
            </div>

            {/* Reviews Section */}
            <div className="bg-gray-50 rounded-lg p-3 space-y-2">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/5" />
            </div>

            {/* Button */}
            <Skeleton className="h-10 w-full rounded-md" />
          </div>
        ))}
      </div>
    </>
  );
}

function HeroSkeleton() {
  return (
    <div className="relative">
      {/* Background */}
      <div className="absolute inset-0 bg-gray-200">
        <div className="absolute inset-0 bg-black/60" />
      </div>

      {/* Content */}
      <div className="relative py-16 md:py-24">
        <div className="container mx-auto px-4 text-center">
          {/* Title */}
          <Skeleton className="h-10 md:h-14 w-3/4 md:w-1/2 mx-auto mb-4 bg-white/20" />

          {/* Subtitle */}
          <Skeleton className="h-6 w-2/3 md:w-1/3 mx-auto mb-8 bg-white/20" />

          {/* Avatar Stack */}
          <div className="flex items-center justify-center gap-3 mb-10">
            <div className="flex -space-x-2">
              <Skeleton className="w-10 h-10 rounded-full bg-white/20" />
              <Skeleton className="w-10 h-10 rounded-full bg-white/20" />
              <Skeleton className="w-10 h-10 rounded-full bg-white/20" />
            </div>
            <Skeleton className="h-10 w-20 bg-white/20" />
          </div>

          {/* Search Card */}
          <div className="bg-white rounded-xl shadow-lg p-4 md:p-6 max-w-4xl mx-auto">
            <div className="mb-4">
              <Skeleton className="h-12 w-full" />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function VerifiedCustomersContent({
  searchParams,
}: {
  searchParams: VerifiedCustomersPageProps["searchParams"];
}) {
  return <VerifiedCustomersGrid searchParams={searchParams} />;
}

async function VerifiedCustomersHeroWrapper() {
  const [countResult, usersResult] = await Promise.all([
    getVerifiedUsersCount(),
    getVerifiedUsers({ limit: 100 }),
  ]);

  const totalCount = countResult.count;
  const areas = usersResult.data?.areas || [];
  const allUsers = usersResult.data?.users || [];
  const topCustomers = allUsers.slice(0, 3);

  return (
    <VerifiedCustomersHero
      totalCount={totalCount}
      areas={areas}
      topCustomers={topCustomers}
    />
  );
}

export default async function VerifiedCustomersPage({
  searchParams,
}: VerifiedCustomersPageProps) {
  const [_countResult, usersResult] = await Promise.all([
    getVerifiedUsersCount(),
    getVerifiedUsers({ limit: 100 }),
  ]);

  const allUsers = usersResult.data?.users || [];
  const topBuyers = [...allUsers]
    .sort((a, b) => b.totalSpend - a.totalSpend)
    .slice(0, 3);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section with Search & Filters */}
      <Suspense fallback={<HeroSkeleton />}>
        <VerifiedCustomersHeroWrapper />
      </Suspense>

      {/* Content */}
      <div className="container mx-auto px-4 py-12">
        {/* Top Buyers Section */}
        <TopBuyers buyers={topBuyers} />

        {/* All Customers Grid */}
        <Suspense fallback={<GridSkeleton />}>
          <VerifiedCustomersContent searchParams={searchParams} />
        </Suspense>
      </div>

      {/* CTA Section */}
      <VerifiedCustomersCta />
    </div>
  );
}
