import { WarehouseProductDetailPage } from "@/components/features/warehouse/warehouse-product-detail-page";
import { isCustomerStorefrontPreview } from "@/lib/customer-storefront-preview";

interface PageProps {
  params: Promise<{ slug: string; productSlug: string }>;
  searchParams: Promise<{ preview?: string }>;
}

export default async function WarehouseProductDetailsRoute({
  params,
  searchParams,
}: PageProps) {
  const [{ slug, productSlug }, query] = await Promise.all([
    params,
    searchParams,
  ]);
  const storefrontPath = `/w/${encodeURIComponent(slug)}`;

  return (
    <WarehouseProductDetailPage
      warehouseSlug={slug}
      productSlug={productSlug}
      storefrontPath={storefrontPath}
      cartPath={storefrontPath}
      previewMode={isCustomerStorefrontPreview(query.preview)}
    />
  );
}
