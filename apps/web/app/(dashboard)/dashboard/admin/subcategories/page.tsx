"use client";

import { useQuery } from "@tanstack/react-query";
import { FolderTree, Loader } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useSubcategoryColumns,
  type SubcategoryWithCategory,
} from "@/components/features/subcategory/components/subcategory-columns";
import SubcategoryTable from "@/components/features/subcategory/components/subcategory-table";
import { orpc } from "@/utils/orpc";

export default function SubcategoryListPage() {
  // Fetch all subcategories globally
  const { data: subcategories, isLoading } = useQuery(
    orpc.adminSubcategory.getAllGlobal.queryOptions({ input: undefined }),
  );

  // Fetch categories for filter dropdown
  const { data: categoriesData } = useQuery(
    orpc.category.getAll.queryOptions(),
  );

  const columns = useSubcategoryColumns();

  // Build types and categories lists for filters
  const typesMap = new Map<number, string>();
  const categoriesList: { id: number; name: string; typeId: number | null }[] =
    [];

  if (categoriesData) {
    for (const cat of categoriesData) {
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
          <FolderTree className="h-6 w-6" />
          Sub Category Setup
        </h1>
        <p className="text-sm text-muted-foreground">
          Manage all sub categories across product types and categories.
        </p>
      </div>

      <SubcategoryTable
        columns={columns}
        data={(subcategories as SubcategoryWithCategory[]) ?? []}
        types={types}
        categories={categoriesList}
      />
    </div>
  );
}
