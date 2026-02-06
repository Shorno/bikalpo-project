"use client";

import { useQuery } from "@tanstack/react-query";
import getProducts from "@/actions/product/get-products";
import { useProductColumns } from "@/components/features/product/components/product-columns";
import ProductTable from "@/components/features/product/components/product-table";
import TableSkeleton from "@/components/table-skeleton";

export default function ProductList() {
  const columns = useProductColumns();

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["admin-products"],
    queryFn: getProducts,
  });

  if (isLoading) {
    return <TableSkeleton />;
  }

  return <ProductTable columns={columns} data={products} />;
}
