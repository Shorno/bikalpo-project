"use client";

import { getInventoryBehaviourOptions } from "@bikalpo-project/db/fulfillment.schema";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useProductTypeColumns } from "@/components/features/product-type/components/product-type-columns";
import ProductTypeTable from "@/components/features/product-type/components/product-type-table";
import TableSkeleton from "@/components/table-skeleton";
import { orpc } from "@/utils/orpc";

export default function ProductTypeList() {
  const [statusFilter, setStatusFilter] = useState("all");
  const [inventoryBehaviourFilter, setInventoryBehaviourFilter] = useState("all");
  const columns = useProductTypeColumns();
  const inventoryBehaviourOptions = getInventoryBehaviourOptions();

  const { data, isLoading } = useQuery({
    queryKey: [
      "adminProductType",
      "getAll",
      statusFilter,
      inventoryBehaviourFilter,
    ],
    queryFn: () =>
      orpc.adminProductType.getAll.call({
        status: statusFilter as "all" | "active" | "inactive",
        inventoryBehaviour: inventoryBehaviourFilter as
          | "all"
          | "auto_break"
          | "loose_convert"
          | "fixed_pack",
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
      inventoryBehaviourFilter={inventoryBehaviourFilter}
      inventoryBehaviourOptions={inventoryBehaviourOptions}
      onStatusFilterChange={setStatusFilter}
      onInventoryBehaviourFilterChange={setInventoryBehaviourFilter}
    />
  );
}
