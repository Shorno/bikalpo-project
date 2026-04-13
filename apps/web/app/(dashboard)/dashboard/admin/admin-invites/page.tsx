import { Suspense } from "react";
import { AdminInvitesClient } from "./admin-invites-client";

export const metadata = {
  title: "Admin Invites | Admin",
  description: "Manage admin-assisted invites and track conversions",
};

export default function AdminInvitesPage() {
  return (
    <Suspense fallback={<AdminInvitesLoading />}>
      <AdminInvitesClient />
    </Suspense>
  );
}

function AdminInvitesLoading() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="h-8 w-40 bg-muted animate-pulse rounded" />
          <div className="h-4 w-56 bg-muted animate-pulse rounded mt-2" />
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
