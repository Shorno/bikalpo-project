"use client";

import { countAddableBrands } from "@bikalpo-project/db/brand-creation";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { CoreProductBrandManagement } from "@/components/features/product/components/core-product-brand-management";
import { Skeleton } from "@/components/ui/skeleton";
import { orpc } from "@/utils/orpc";

const CATALOG_URL = "/dashboard/product-catalog";

export default function RetailerCoreProductBrandManagementPage() {
  const coreProductId = Number(
    useParams<{ coreProductId: string }>().coreProductId,
  );
  const configurationQuery = useQuery({
    queryKey: ["shopOwner", "getShopCoreConfiguration", { coreProductId }],
    queryFn: () =>
      (orpc.shopOwner as any).getShopCoreConfiguration.call({ coreProductId }),
  });

  if (configurationQuery.isLoading) return <ManagementLoading />;
  const data = configurationQuery.data;
  if (!data || configurationQuery.isError) {
    return (
      <p className="p-6 text-sm text-destructive">
        Could not load brand products.
      </p>
    );
  }

  const activeBrandIds = data.options.brands
    .filter((brand: any) => brand.isActive)
    .map((brand: any) => brand.id);
  const configuredBrandIds = data.current
    .map((product: any) => product.brandId)
    .filter((brandId: unknown): brandId is number => Number.isInteger(brandId));

  return (
    <CoreProductBrandManagement
      core={{
        id: data.core.id,
        name: data.core.name,
        image: data.core.image,
        brandCreationMode: data.core.brandCreationMode,
        categoryName: data.core.category?.name,
        subCategoryName: data.core.subCategory?.name,
      }}
      products={data.current
        .filter((product: any) => product.brandId)
        .map((product: any) => {
          const brand = data.options.brands.find(
            (option: any) => option.id === product.brandId,
          );
          return {
            productId: product.productId,
            productName: product.productName,
            productImage: product.productImage,
            brandId: product.brandId,
            brandName: product.brandName ?? brand?.name ?? "Unknown brand",
            brandLogo: brand?.logo ?? null,
            status: product.status,
            variantCount: product.variants.length,
          };
        })}
      addableBrandCount={countAddableBrands(activeBrandIds, configuredBrandIds)}
      backHref={CATALOG_URL}
      addHref={`${CATALOG_URL}/add/${coreProductId}`}
      addActionLabel="Add"
      editConfigurationHref={`${CATALOG_URL}/add/${coreProductId}`}
      productEditHref={(productId) => `/dashboard/products/${productId}/edit`}
    />
  );
}

function ManagementLoading() {
  return (
    <div className="mx-auto max-w-6xl space-y-5 p-6">
      <Skeleton className="h-12 w-80" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-72 w-full" />
    </div>
  );
}
