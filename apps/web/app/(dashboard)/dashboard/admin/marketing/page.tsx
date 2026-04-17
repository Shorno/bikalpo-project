import { Suspense } from "react";
import { MarketingClient } from "./marketing-client";

export const metadata = {
  title: "Marketing Materials | Admin",
  description: "Manage marketing material requests and fulfillment",
};

export default function MarketingPage() {
  return (
    <Suspense fallback={<MarketingLoading />}>
      <MarketingClient />
    </Suspense>
  );
}

function MarketingLoading() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="h-8 w-48 bg-muted animate-pulse rounded" />
          <div className="h-4 w-64 bg-muted animate-pulse rounded mt-2" />
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
