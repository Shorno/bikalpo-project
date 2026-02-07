"use client";

import { useQuery } from "@tanstack/react-query";
import { useProductColumns } from "@/components/features/product/components/product-columns";
import ProductTable from "@/components/features/product/components/product-table";
import TableSkeleton from "@/components/table-skeleton";
import { orpc } from "@/utils/orpc";

export default function ProductList() {
  const columns = useProductColumns();

  const { data, isLoading } = useQuery({
    ...orpc.product.getAll.queryOptions({ input: {} }),
  });

  const products = data?.products ?? [];

  if (isLoading) {
    return <TableSkeleton />;
  }

  return <ProductTable columns={columns} data={products} />;
}
