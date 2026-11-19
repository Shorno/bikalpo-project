"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { CatalogPageHeader } from "@/components/features/product/components/catalog-layout";
import ProductCatalogTable, {
  type CatalogProduct,
} from "@/components/features/product/components/product-catalog-table";
import { orpc } from "@/utils/orpc";

export default function ProductsPage() {
  const productsQuery = useQuery(
    orpc.product.getAdminWebViewProducts.queryOptions({ input: {} }),
  );
  const products = (productsQuery.data?.products ?? []) as CatalogProduct[];

  const stats = useMemo(
    () => [
      { label: "Products", value: products.length },
      {
        label: "Types",
        value: new Set(
          products
            .map((product) => product.category?.type?.id)
            .filter((id): id is number => id != null),
        ).size,
      },
      {
        label: "Categories",
        value: new Set(products.map((product) => product.categoryId)).size,
      },
    ],
    [products],
  );

  return (
    <div className="space-y-5 max-md:min-w-0 max-md:space-y-4">
      <CatalogPageHeader
        description="Browse configured products by type, category, and sub category."
        stats={stats}
      />

      <ProductCatalogTable
        data={products}
        isLoading={productsQuery.isLoading}
        isError={productsQuery.isError}
        onRetry={() => productsQuery.refetch()}
      />
    </div>
  );
}
