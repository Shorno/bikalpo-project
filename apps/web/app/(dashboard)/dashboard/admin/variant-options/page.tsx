"use client";

import { useQuery } from "@tanstack/react-query";
import { Package } from "lucide-react";
import { AdminCatalogRequests } from "@/components/catalog-approval/admin-catalog-requests";
import {
  useVariantOptionColumns,
  type VariantOptionRow,
} from "@/components/features/variant-option/components/variant-option-columns";
import VariantOptionTable from "@/components/features/variant-option/components/variant-option-table";
import { Skeleton } from "@/components/ui/skeleton";
import { orpc } from "@/utils/orpc";

export default function VariantOptionsPage() {
  // Fetch all variant options
  const { data: variantOptions, isLoading } = useQuery(
    orpc.adminVariantOption.getAll.queryOptions({ input: {} }),
  );

  // Fetch types for filter dropdown
  const { data: typesData } = useQuery(
    orpc.adminProductType.getAll.queryOptions({ input: {} }),
  );

  // Fetch categories for cascade filter
  const { data: categoriesData } = useQuery(
    orpc.category.getAll.queryOptions(),
  );

  const columns = useVariantOptionColumns();

  const types = (typesData?.types ?? []).map((t) => ({
    id: t.id,
    name: t.name,
  }));

  const categories = (categoriesData ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    typeId: c.typeId,
  }));

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-9 w-40" />
        </div>
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Package className="h-6 w-6" />
          Variant Setup
        </h1>
        <p className="text-sm text-muted-foreground">
          Manage global variant options that can be reused across core products.
        </p>
      </div>

      <VariantOptionTable
        columns={columns}
        data={(variantOptions as VariantOptionRow[]) ?? []}
        types={types}
        categories={categories}
      />

      <AdminCatalogRequests
        requestType="variant_option"
        title="Variant Requests"
      />
    </div>
  );
}
