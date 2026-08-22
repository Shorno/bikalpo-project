import { WarehouseProductDetailPage } from "@/components/features/warehouse/warehouse-product-detail-page";

interface PageProps {
  params: Promise<{ slug: string; productSlug: string }>;
}

export default async function WarehouseProductDetailsRoute({
  params,
}: PageProps) {
  const { slug, productSlug } = await params;
  const storefrontPath = `/w/${encodeURIComponent(slug)}`;

  return (
    <WarehouseProductDetailPage
      warehouseSlug={slug}
      productSlug={productSlug}
      storefrontPath={storefrontPath}
      cartPath={storefrontPath}
    />
  );
}
