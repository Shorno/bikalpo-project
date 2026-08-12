"use client";

import { useQuery } from "@tanstack/react-query";
import { useBrandColumns } from "@/components/features/brand/components/brand-columns";
import BrandCsvActions from "@/components/features/brand/components/brand-csv-actions";
import BrandTable from "@/components/features/brand/components/brand-table";
import NewBrandDialog from "@/components/features/brand/components/new-brand-dialog";
import {
  SetupErrorState,
  SetupPageHeader,
  SetupPageShell,
} from "@/components/features/product-setup";
import TableSkeleton from "@/components/table-skeleton";
import { orpc } from "@/utils/orpc";

export default function BrandList() {
  const columns = useBrandColumns();
  const {
    data: brands = [],
    isError,
    isLoading,
    refetch,
  } = useQuery(orpc.brand.getAdminAll.queryOptions());

  return (
    <SetupPageShell>
      <SetupPageHeader
        action={<NewBrandDialog />}
        count={brands.length}
        secondaryActions={<BrandCsvActions brands={brands} />}
        title="Brands"
      />
      {isLoading ? (
        <TableSkeleton columns={6} />
      ) : isError ? (
        <SetupErrorState onRetry={() => void refetch()} />
      ) : (
        <BrandTable columns={columns} data={brands} />
      )}
    </SetupPageShell>
  );
}
