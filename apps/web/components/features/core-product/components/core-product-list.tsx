"use client";

import { useQuery } from "@tanstack/react-query";
import {
  SetupErrorState,
  SetupPageHeader,
  SetupPageShell,
} from "@/components/features/product-setup";
import TableSkeleton from "@/components/table-skeleton";
import { orpc } from "@/utils/orpc";
import { useCoreProductColumns } from "./core-product-columns";
import CoreProductTable from "./core-product-table";
import NewCoreProductDialog from "./new-core-product-dialog";

export default function CoreProductList() {
  const columns = useCoreProductColumns();
  const { data, isError, isLoading, refetch } = useQuery(
    orpc.adminCoreProduct.getAll.queryOptions({ input: {} }),
  );
  const coreProducts = data?.coreProducts ?? [];

  return (
    <SetupPageShell>
      <SetupPageHeader
        action={<NewCoreProductDialog />}
        count={coreProducts.length}
        secondaryActions={
          <a
            className="inline-flex h-10 items-center rounded-md border px-4 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            href="/dashboard/admin/setup-requests"
          >
            Review requests
          </a>
        }
        title="Core Identities"
      />
      {isLoading ? (
        <TableSkeleton columns={6} />
      ) : isError ? (
        <SetupErrorState onRetry={() => void refetch()} />
      ) : (
        <CoreProductTable columns={columns} data={coreProducts} />
      )}
    </SetupPageShell>
  );
}
