"use client";

import { useQuery } from "@tanstack/react-query";
import { useBrandColumns } from "@/components/features/brand/components/brand-columns";
import BrandTable from "@/components/features/brand/components/brand-table";
import TableSkeleton from "@/components/table-skeleton";
import { orpc } from "@/utils/orpc";

export default function BrandList() {
  const columns = useBrandColumns();

  const { data: brands = [], isLoading } = useQuery(
    orpc.brand.getAll.queryOptions()
  );

  if (isLoading) {
    return <TableSkeleton />;
  }

  return <BrandTable columns={columns} data={brands} />;
}
