import { WarehouseProductDetailPage } from "@/components/features/warehouse/warehouse-product-detail-page";

interface PageProps {
  params: Promise<{ warehouseSlug: string; productSlug: string }>;
}

export default async function LegacyWarehouseProductDetailsRoute({
  params,
}: PageProps) {
  const { warehouseSlug, productSlug } = await params;
  const storefrontPath = `/warehouse/${encodeURIComponent(warehouseSlug)}`;

  return (
    <WarehouseProductDetailPage
      warehouseSlug={warehouseSlug}
      productSlug={productSlug}
      storefrontPath={storefrontPath}
      cartPath={`/w/${encodeURIComponent(warehouseSlug)}`}
    />
  );
}
