"use client";

import { useQuery } from "@tanstack/react-query";
import getBrands from "@/actions/brand/get-brands";
import { useBrandColumns } from "@/components/features/brand/components/brand-columns";
import BrandTable from "@/components/features/brand/components/brand-table";
import TableSkeleton from "@/components/table-skeleton";

export default function BrandList() {
  const columns = useBrandColumns();

  const { data: brands = [], isLoading } = useQuery({
    queryKey: ["admin-brands"],
    queryFn: getBrands,
  });

  if (isLoading) {
    return <TableSkeleton />;
  }

  return <BrandTable columns={columns} data={brands} />;
}
