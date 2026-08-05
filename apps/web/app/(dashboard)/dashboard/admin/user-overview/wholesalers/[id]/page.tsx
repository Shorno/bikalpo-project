import { Loader2 } from "lucide-react";
import { Suspense } from "react";
import { UserDetailClient } from "../../_components/user-detail-client";

export const metadata = {
  title: "Warehouse Owner Details | Admin",
  description: "View and manage Warehouse Owner account details",
};

export default async function WholesalerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-24">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <UserDetailClient userId={id} />
    </Suspense>
  );
}
