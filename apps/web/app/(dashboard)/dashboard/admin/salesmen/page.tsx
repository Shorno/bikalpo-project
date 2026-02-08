"use client";

import { useQuery } from "@tanstack/react-query";
import { SalesmenClient } from "./salesmen-client";
import TableSkeleton from "@/components/table-skeleton";
import { orpc } from "@/utils/orpc";

export default function SalesmenPage() {
  const { data, isLoading, error } = useQuery({
    ...orpc.salesman.getAll.queryOptions({ input: {} }),
  });

  if (isLoading) {
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
        <TableSkeleton />
      </div>
    );
  }

  if (error || !data) {
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

      <SalesmenClient salesmen={data.salesmen} stats={data.stats} />
    </div>
  );
}
