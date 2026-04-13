import { Suspense } from "react";
import { InviteTrackingClient } from "./invite-tracking-client";

export const metadata = {
  title: "Invite Tracking | Admin",
  description: "Track and manage referral invites",
};

export default function InviteTrackingPage() {
  return (
    <Suspense fallback={<InviteTrackingLoading />}>
      <InviteTrackingClient />
    </Suspense>
  );
}

function InviteTrackingLoading() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="h-8 w-40 bg-muted animate-pulse rounded" />
          <div className="h-4 w-56 bg-muted animate-pulse rounded mt-2" />
        </div>
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
