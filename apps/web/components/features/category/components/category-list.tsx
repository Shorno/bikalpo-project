"use client";

import { useQuery } from "@tanstack/react-query";
import getCategories from "@/actions/category/get-categories";
import { useCategoryColumns } from "@/components/features/category/components/category-columns";
import CategoryTable from "@/components/features/category/components/category-table";
import TableSkeleton from "@/components/table-skeleton";

export default function CategoryList() {
  const columns = useCategoryColumns();

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ["admin-categories"],
    queryFn: getCategories,
  });

  if (isLoading) {
    return <TableSkeleton />;
  }

  return <CategoryTable columns={columns} data={categories} />;
}
