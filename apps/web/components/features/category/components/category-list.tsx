"use client";

import { useQuery } from "@tanstack/react-query";
import { useCategoryColumns } from "@/components/features/category/components/category-columns";
import CategoryTable from "@/components/features/category/components/category-table";
import TableSkeleton from "@/components/table-skeleton";
import { orpc } from "@/utils/orpc";

export default function CategoryList() {
  const columns = useCategoryColumns();

  const { data: categories = [], isLoading } = useQuery(
    orpc.category.getAll.queryOptions()
  );

  if (isLoading) {
    return <TableSkeleton />;
  }

  return <CategoryTable columns={columns} data={categories} />;
}
