"use client";

import { useQuery } from "@tanstack/react-query";
import { Layers3 } from "lucide-react";
import { useMemo } from "react";
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
    () => ({
      products: products.length,
      types: new Set(
        products
          .map((product) => product.category?.type?.id)
          .filter((id): id is number => id != null),
      ).size,
      categories: new Set(products.map((product) => product.categoryId)).size,
    }),
    [products],
  );

  return (
    <div className="space-y-5">
      <header className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="flex items-center gap-3.5 p-5">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-inset ring-primary/15">
            <Layers3 className="size-5" />
          </span>
          <div>
            <h1 className="text-lg font-semibold tracking-tight">
              Product Catalog
            </h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Browse configured products by type, category, and sub category.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-3 divide-x border-t bg-muted/30">
          <CatalogStat label="Products" value={stats.products} />
          <CatalogStat label="Types" value={stats.types} />
          <CatalogStat label="Categories" value={stats.categories} />
        </div>
      </header>

      <ProductCatalogTable
        data={products}
        isLoading={productsQuery.isLoading}
        isError={productsQuery.isError}
        onRetry={() => productsQuery.refetch()}
      />
    </div>
  );
}

function CatalogStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="px-4 py-3.5 text-center">
      <p className="text-lg font-semibold leading-none tabular-nums">
        {value.toLocaleString("en-BD")}
      </p>
      <p className="mt-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
    </div>
  );
}
