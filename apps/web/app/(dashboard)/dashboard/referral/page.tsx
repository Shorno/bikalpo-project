import { Suspense } from "react";
import { ReferralClient } from "./referral-client";

export const metadata = {
  title: "My Referrals",
  description: "Share your invite code and track your referral earnings",
};

export default function ReferralPage() {
  return (
    <Suspense fallback={<ReferralLoading />}>
      <ReferralClient />
    </Suspense>
  );
}

function ReferralLoading() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="h-8 w-48 bg-muted animate-pulse rounded" />
      <div className="grid gap-4 md:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />
        ))}
      </div>
      <div className="h-64 bg-muted animate-pulse rounded-lg" />
    </div>
  );
}
