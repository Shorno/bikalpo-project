"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useProductTypeColumns } from "@/components/features/product-type/components/product-type-columns";
import ProductTypeTable from "@/components/features/product-type/components/product-type-table";
import TableSkeleton from "@/components/table-skeleton";
import { orpc } from "@/utils/orpc";

export default function ProductTypeList() {
  const [statusFilter, setStatusFilter] = useState("all");
  const columns = useProductTypeColumns();

  const { data, isLoading } = useQuery({
    queryKey: ["adminProductType", "getAll", statusFilter],
    queryFn: () =>
      orpc.adminProductType.getAll.call({
        status: statusFilter as "all" | "active" | "inactive",
      }),
  });

  if (isLoading) {
    return <TableSkeleton columns={7} />;
  }

  return (
    <ProductTypeTable
      columns={columns}
      data={data?.types ?? []}
      statusFilter={statusFilter}
      onStatusFilterChange={setStatusFilter}
    />
  );
}
