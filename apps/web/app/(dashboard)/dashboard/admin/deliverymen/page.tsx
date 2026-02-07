import { unauthorized } from "next/navigation";
import { getDeliverymen } from "@/actions/admin/deliveryman-actions";
import { checkIsAdmin } from "@/utils/auth";
import { DeliverymenClient } from "./deliverymen-client";

export default async function DeliverymenPage() {
  const session = await checkIsAdmin();
  if (!session) {
    unauthorized();
  }

  const result = await getDeliverymen();

  if (!result.success) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-4 sm:p-6">
        <div className="flex items-center justify-center h-40">
          <p className="text-muted-foreground">Failed to load deliverymen</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 sm:p-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
          Deliverymen
        </h1>
        <p className="text-sm text-muted-foreground">
          Manage delivery personnel and their assignments
        </p>
      </div>

      <DeliverymenClient
        deliverymen={result.deliverymen}
        stats={result.stats}
      />
    </div>
  );
}
