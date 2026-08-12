"use client";

import { countAddableBrands } from "@bikalpo-project/db/brand-creation";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { CoreProductBrandManagement } from "@/components/features/product/components/core-product-brand-management";
import { Skeleton } from "@/components/ui/skeleton";
import { ADMIN_BASE } from "@/lib/routes";
import { orpc } from "@/utils/orpc";

export default function AdminCoreProductBrandManagementPage() {
  const coreProductId = Number(
    useParams<{ coreProductId: string }>().coreProductId,
  );
  const configurationQuery = useQuery(
    orpc.adminProductConfig.get.queryOptions({ input: { coreProductId } }),
  );
  const brandsQuery = useQuery(orpc.brand.getAll.queryOptions());

  if (configurationQuery.isLoading || brandsQuery.isLoading) {
    return <ManagementLoading />;
  }
  const data = configurationQuery.data;
  if (!data || configurationQuery.isError) {
    return (
      <p className="p-6 text-sm text-destructive">
        Could not load brand products.
      </p>
    );
  }

  const activeBrandIds = (brandsQuery.data ?? [])
    .filter((brand) => brand.isActive)
    .map((brand) => brand.id);
  const configuredBrandIds = data.brands.map((brand) => brand.brandId);

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
      products={data.brands.map((brand) => ({
        productId: brand.productId,
        productName: brand.productName,
        productImage: brand.productImage,
        brandId: brand.brandId,
        brandName: brand.brandName,
        brandLogo: brand.brandLogo,
        status: brand.status,
        variantCount: brand.variantOptions.length,
      }))}
      addableBrandCount={countAddableBrands(activeBrandIds, configuredBrandIds)}
      backHref={`${ADMIN_BASE}/products`}
      addHref={`${ADMIN_BASE}/products/core/${coreProductId}/edit`}
      editConfigurationHref={`${ADMIN_BASE}/products/core/${coreProductId}/edit`}
      productEditHref={(productId) =>
        `${ADMIN_BASE}/products/${productId}/edit`
      }
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
