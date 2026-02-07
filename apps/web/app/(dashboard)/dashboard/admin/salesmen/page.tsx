import { unauthorized } from "next/navigation";
import { getSalesmen } from "@/actions/admin/salesman-actions";
import { checkIsAdmin } from "@/utils/auth";
import { SalesmenClient } from "./salesmen-client";

export default async function SalesmenPage() {
  const session = await checkIsAdmin();
  if (!session) {
    unauthorized();
  }

  const result = await getSalesmen();

  if (!result.success) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-4 sm:p-6">
        <div className="flex items-center justify-center h-40">
          <p className="text-muted-foreground">Failed to load salesmen</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 sm:p-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
          Salesmen
        </h1>
        <p className="text-sm text-muted-foreground">
          Manage salesmen and their customer assignments
        </p>
      </div>

      <SalesmenClient salesmen={result.salesmen} stats={result.stats} />
    </div>
  );
}
