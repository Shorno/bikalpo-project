"use client";

import { useQuery } from "@tanstack/react-query";
import { useCategoryColumns } from "@/components/features/category/components/category-columns";
import CategoryTable from "@/components/features/category/components/category-table";
import NewCategoryDialog from "@/components/features/category/components/new-category-dialog";
import {
  SetupErrorState,
  SetupPageHeader,
  SetupPageShell,
} from "@/components/features/product-setup";
import TableSkeleton from "@/components/table-skeleton";
import { orpc } from "@/utils/orpc";

export default function CategoryList() {
  const columns = useCategoryColumns();
  const categoriesQuery = useQuery(orpc.category.getAll.queryOptions());
  const typesQuery = useQuery(
    orpc.adminProductType.getAll.queryOptions({ input: {} }),
  );
  const categories = categoriesQuery.data ?? [];
  const typesData = typesQuery.data;
  const typeOptions = (typesData?.types ?? []).map((type) => ({
    id: type.id,
    name: type.name,
  }));

  return (
    <SetupPageShell>
      <SetupPageHeader
        action={<NewCategoryDialog />}
        count={categories.length}
        title="Categories"
      />
      {categoriesQuery.isLoading || typesQuery.isLoading ? (
        <TableSkeleton columns={5} />
      ) : categoriesQuery.isError || typesQuery.isError ? (
        <SetupErrorState
          onRetry={() => {
            void categoriesQuery.refetch();
            void typesQuery.refetch();
          }}
        />
      ) : (
        <CategoryTable
          columns={columns}
          data={categories}
          types={typeOptions}
        />
      )}
    </SetupPageShell>
  );
}
