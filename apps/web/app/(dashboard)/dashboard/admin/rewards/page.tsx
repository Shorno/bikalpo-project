import { Suspense } from "react";
import { RewardsClient } from "./rewards-client";

export const metadata = {
  title: "Rewards | Admin",
  description: "Manage referral rewards, approvals, and payouts",
};

export default function RewardsPage() {
  return (
    <Suspense fallback={<RewardsLoading />}>
      <RewardsClient />
    </Suspense>
  );
}

function RewardsLoading() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <div className="h-8 w-40 bg-muted animate-pulse rounded" />
        <div className="h-4 w-56 bg-muted animate-pulse rounded mt-2" />
      </div>
      <div className="grid gap-4 md:grid-cols-5">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />
        ))}
      </div>
      <div className="h-96 bg-muted animate-pulse rounded-lg" />
    </div>
  );
}
