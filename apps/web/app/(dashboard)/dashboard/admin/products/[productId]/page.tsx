import { notFound } from "next/navigation";
import { ADMIN_BASE } from "@/lib/routes";
import { client } from "@/utils/orpc";
import { WebViewDetailClient } from "../../web-view/[id]/web-view-detail-client";

export default async function AdminProductDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ productId: string }>;
  searchParams: Promise<{ brandId?: string }>;
}) {
  const { productId: productIdParam } = await params;
  const { brandId: brandIdParam } = await searchParams;
  const productId = Number(productIdParam);

  if (!Number.isInteger(productId) || productId <= 0) {
    notFound();
  }

  const parsedBrandId = Number(brandIdParam);
  const brandId =
    brandIdParam != null &&
    brandIdParam !== "" &&
    Number.isInteger(parsedBrandId) &&
    parsedBrandId > 0
      ? parsedBrandId
      : null;

  const productResult = await client.product
    .getAdminWebViewProductById({ id: productId })
    .catch(() => null);

  if (!productResult?.product) {
    notFound();
  }

  const reviewData = await client.customer
    .getProductReviews({ productId })
    .catch(() => ({
      reviews: [],
      stats: { averageRating: 0, totalReviews: 0 },
    }));

  return (
    <WebViewDetailClient
      product={productResult.product}
      brandId={brandId}
      reviews={reviewData.reviews}
      stats={reviewData.stats}
      listingUrl={`${ADMIN_BASE}/products`}
      listingLabel="Product Catalog"
    />
  );
}
