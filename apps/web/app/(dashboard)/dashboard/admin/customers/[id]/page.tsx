import { Loader2 } from "lucide-react";
import { Suspense } from "react";
import { CustomerDetailsClient } from "./customer-details-client";

export const metadata = {
  title: "Customer Details | Admin",
  description: "View customer details and order history",
};

export default async function CustomerDetailsPage({
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
      <CustomerDetailsClient customerId={id} />
    </Suspense>
  );
}
