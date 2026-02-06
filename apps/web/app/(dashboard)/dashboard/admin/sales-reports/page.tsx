import { Suspense } from "react";
import { SalesReportsClient } from "./sales-reports-client";

export const metadata = {
  title: "Sales Reports | Admin",
  description: "View sales reports and analytics",
};

export default function SalesReportsPage() {
  return (
    <Suspense fallback={<SalesReportsLoading />}>
      <SalesReportsClient />
    </Suspense>
  );
}

function SalesReportsLoading() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="h-8 w-48 bg-muted animate-pulse rounded" />
          <div className="h-4 w-64 bg-muted animate-pulse rounded mt-2" />
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />
        ))}
      </div>
      <div className="h-96 bg-muted animate-pulse rounded-lg" />
    </div>
  );
}
