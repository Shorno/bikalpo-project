"use client";

import { useQuery } from "@tanstack/react-query";
import {
  SetupErrorState,
  SetupPageHeader,
  SetupPageShell,
} from "@/components/features/product-setup";
import NewSubcategoryDialog from "@/components/features/subcategory/components/new-subcategory-dialog";
import {
  type SubcategoryWithCategory,
  useSubcategoryColumns,
} from "@/components/features/subcategory/components/subcategory-columns";
import SubcategoryTable from "@/components/features/subcategory/components/subcategory-table";
import { Skeleton } from "@/components/ui/skeleton";
import { orpc } from "@/utils/orpc";

export default function SubcategoryListPage() {
  // Fetch all subcategories globally
  const subcategoriesQuery = useQuery(
    orpc.adminSubcategory.getAllGlobal.queryOptions({ input: undefined }),
  );

  // Fetch categories for filter dropdown
  const categoriesQuery = useQuery(orpc.category.getAll.queryOptions());
  const subcategories = subcategoriesQuery.data;
  const categoriesData = categoriesQuery.data;

  const columns = useSubcategoryColumns();

  // Build types and categories lists for filters
  const typesMap = new Map<number, string>();
  const categoriesList: { id: number; name: string; typeId: number | null }[] =
    [];

  if (categoriesData) {
    for (const cat of categoriesData) {
      if (!cat.isActive) continue;
      categoriesList.push({
        id: cat.id,
        name: cat.name,
        typeId: cat.typeId,
      });
      if (cat.type) {
        typesMap.set(cat.type.id, cat.type.name);
      }
    }
  }

  const types = Array.from(typesMap.entries()).map(([id, name]) => ({
    id,
    name,
  }));

  if (subcategoriesQuery.isLoading || categoriesQuery.isLoading) {
    return (
      <SetupPageShell className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-9 w-40" />
        </div>
        <Skeleton className="h-[400px] w-full" />
      </SetupPageShell>
    );
  }

  if (subcategoriesQuery.isError || categoriesQuery.isError) {
    return (
      <SetupPageShell>
        <SetupErrorState
          onRetry={() => {
            void subcategoriesQuery.refetch();
            void categoriesQuery.refetch();
          }}
        />
      </SetupPageShell>
    );
  }

  return (
    <SetupPageShell>
      <SetupPageHeader
        action={
          <NewSubcategoryDialog
            variant="standalone"
            categories={categoriesList}
          />
        }
        count={subcategories?.length ?? 0}
        description="Manage the third level of the product taxonomy and its Type and Category path."
        title="Sub Categories"
      />

      <SubcategoryTable
        columns={columns}
        data={(subcategories as SubcategoryWithCategory[]) ?? []}
        types={types}
        categories={categoriesList}
      />
    </SetupPageShell>
  );
}
