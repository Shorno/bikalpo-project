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

export default function CoreProductList() {
  const columns = useCoreProductColumns();
  const { data, isError, isLoading, refetch } = useQuery(
    orpc.adminCoreProduct.getAll.queryOptions({ input: {} }),
  );
  const coreProducts = data?.coreProducts ?? [];

  return (
    <SetupPageShell width="wide">
      <SetupPageHeader
        count={coreProducts.length}
        description="Browse reusable product identities and their setup."
        title="Products"
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
