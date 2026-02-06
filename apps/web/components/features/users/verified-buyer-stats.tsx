import { Suspense } from "react";
import {
  getVerifiedUsers,
  getVerifiedUsersCount,
} from "@/actions/users/get-verified-users";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

const avatarColors = ["bg-emerald-500", "bg-teal-500", "bg-green-500"];

// Server component that fetches the count and top customers
async function HeroDataContent() {
  const [countResult, usersResult] = await Promise.all([
    getVerifiedUsersCount(),
    getVerifiedUsers({ limit: 3 }),
  ]);

  const totalCount = countResult.count;
  const topCustomers = usersResult.data?.users.slice(0, 3) || [];

  return (
    <div className="flex items-center justify-center gap-3 mb-8">
      {/* Avatar Stack */}
      <div className="*:data-[slot=avatar]:ring-background flex -space-x-2 *:data-[slot=avatar]:ring-2">
        {topCustomers.map((customer, index) => (
          <Avatar key={customer.id}>
            <AvatarFallback
              className={`${avatarColors[index % avatarColors.length]} text-white`}
            >
              {getInitials(customer.shopName || customer.name)}
            </AvatarFallback>
          </Avatar>
        ))}
      </div>
      <div className="text-white text-left">
        <span className="font-bold">{totalCount}+</span> Verified
        <br />
        <span className="font-bold">Buyers</span>
      </div>
    </div>
  );
}

function HeroDataSkeleton() {
  return (
    <div className="flex items-center justify-center gap-3 mb-8">
      <div className="flex -space-x-2">
        <Skeleton className="w-10 h-10 rounded-full bg-emerald-500/30" />
        <Skeleton className="w-10 h-10 rounded-full bg-emerald-500/30" />
        <Skeleton className="w-10 h-10 rounded-full bg-emerald-500/30" />
      </div>
      <div className="space-y-1">
        <Skeleton className="h-4 w-20 bg-emerald-500/30" />
        <Skeleton className="h-4 w-16 bg-emerald-500/30" />
      </div>
    </div>
  );
}

export function VerifiedBuyerStats() {
  return (
    <Suspense fallback={<HeroDataSkeleton />}>
      <HeroDataContent />
    </Suspense>
  );
}
