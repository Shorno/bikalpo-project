import { Suspense } from "react";
import { SellerApplicationsClient } from "./seller-applications-client";

export const metadata = {
  title: "Seller Applications | Admin",
  description: "Review and manage seller applications",
};

export default function SellerApplicationsPage() {
  return (
    <Suspense fallback={<SellerApplicationsLoading />}>
      <SellerApplicationsClient />
    </Suspense>
  );
}

function SellerApplicationsLoading() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="h-8 w-48 bg-muted animate-pulse rounded" />
          <div className="h-4 w-64 bg-muted animate-pulse rounded mt-2" />
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />
        ))}
      </div>
      <div className="h-96 bg-muted animate-pulse rounded-lg" />
    </div>
  );
}
