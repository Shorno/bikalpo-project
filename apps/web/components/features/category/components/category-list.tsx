"use client";

import { useQuery } from "@tanstack/react-query";
import { useCategoryColumns } from "@/components/features/category/components/category-columns";
import CategoryTable from "@/components/features/category/components/category-table";
import TableSkeleton from "@/components/table-skeleton";
import { orpc } from "@/utils/orpc";

export default function CategoryList() {
  const columns = useCategoryColumns();

  const { data: categories = [], isLoading } = useQuery(
    orpc.category.getAll.queryOptions(),
  );

  const { data: typesData } = useQuery(
    orpc.adminProductType.getAll.queryOptions({ input: {} }),
  );

  if (isLoading) {
    return <TableSkeleton />;
  }

  const typeOptions = (typesData?.types ?? []).map((t: any) => ({ id: t.id, name: t.name }));

  return <CategoryTable columns={columns} data={categories} types={typeOptions} />;
}
