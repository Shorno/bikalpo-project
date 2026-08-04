"use client";

import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useState } from "react";
import {
  SetupErrorState,
  SetupPageHeader,
} from "@/components/features/product-setup";
import VariantBulkActions from "@/components/features/variant-option/components/variant-bulk-actions";
import {
  useVariantOptionColumns,
  type VariantOptionRow,
} from "@/components/features/variant-option/components/variant-option-columns";
import VariantOptionDialog from "@/components/features/variant-option/components/variant-option-dialog";
import VariantOptionTable from "@/components/features/variant-option/components/variant-option-table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { orpc } from "@/utils/orpc";

export default function VariantOptionsPage() {
  const [showCreate, setShowCreate] = useState(false);
  // Fetch all variant options
  const variantsQuery = useQuery(
    orpc.adminVariantOption.getAll.queryOptions({ input: {} }),
  );

  // Fetch types for filter dropdown
  const typesQuery = useQuery(
    orpc.adminProductType.getAll.queryOptions({ input: {} }),
  );

  // Fetch categories for cascade filter
  const categoriesQuery = useQuery(orpc.category.getAll.queryOptions());
  const variantOptions = variantsQuery.data;
  const typesData = typesQuery.data;
  const categoriesData = categoriesQuery.data;

  const columns = useVariantOptionColumns();

  const types = (typesData?.types ?? []).map((t) => ({
    id: t.id,
    name: t.name,
    slug: t.slug,
    inventoryBehaviour: t.inventoryBehaviour,
  }));

  const categories = (categoriesData ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    typeId: c.typeId,
  }));

  if (
    variantsQuery.isLoading ||
    typesQuery.isLoading ||
    categoriesQuery.isLoading
  ) {
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

  if (variantsQuery.isError || typesQuery.isError || categoriesQuery.isError) {
    return (
      <SetupErrorState
        onRetry={() => {
          void variantsQuery.refetch();
          void typesQuery.refetch();
          void categoriesQuery.refetch();
        }}
      />
    );
  }

  return (
    <div className="space-y-5">
      <SetupPageHeader
        action={
          <Button onClick={() => setShowCreate(true)}>
            <Plus aria-hidden="true" className="size-4" />
            Create Variant
          </Button>
        }
        count={variantOptions?.length ?? 0}
        description="Define canonical Pack and Loose options and scope them to a Type or Category."
        secondaryActions={<VariantBulkActions />}
        title="Variants"
      />
      <VariantOptionDialog
        mode="create"
        onOpenChange={setShowCreate}
        open={showCreate}
      />

      <VariantOptionTable
        columns={columns}
        data={(variantOptions as VariantOptionRow[]) ?? []}
        emptyAction={
          <Button onClick={() => setShowCreate(true)}>Create Variant</Button>
        }
        types={types}
        categories={categories}
      />
    </div>
  );
}
