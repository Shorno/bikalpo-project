"use client";

import { useQuery } from "@tanstack/react-query";
import { useCoreProductColumns } from "./core-product-columns";
import CoreProductTable from "./core-product-table";
import TableSkeleton from "@/components/table-skeleton";
import { orpc } from "@/utils/orpc";

export default function CoreProductList() {
  const columns = useCoreProductColumns();

  const { data, isLoading } = useQuery(
    orpc.adminCoreProduct.getAll.queryOptions({
      input: {},
    }),
  );

  const coreProducts = data?.coreProducts ?? [];

  if (isLoading) {
    return <TableSkeleton />;
  }

  return <CoreProductTable columns={columns} data={coreProducts as any} />;
}
