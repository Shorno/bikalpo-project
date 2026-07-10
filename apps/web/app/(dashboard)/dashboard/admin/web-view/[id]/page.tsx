import { notFound } from "next/navigation";
import { client } from "@/utils/orpc";
import { WebViewDetailClient } from "./web-view-detail-client";

export default async function AdminWebViewDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ brandId?: string }>;
}) {
  const { id } = await params;
  const { brandId: brandIdParam } = await searchParams;
  const productId = Number(id);

  if (Number.isNaN(productId)) {
    notFound();
  }

  const parsedBrandId = Number(brandIdParam);
  const brandId =
    brandIdParam != null && brandIdParam !== "" && !Number.isNaN(parsedBrandId)
      ? parsedBrandId
      : null;

  let product;
  try {
    const result = await client.product.getById({ id: productId });
    product = result.product;
  } catch {
    notFound();
  }

  if (!product) {
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
      // biome-ignore lint/suspicious/noExplicitAny: getById output is a superset of the fields the view needs
      product={product as any}
      brandId={brandId}
      reviews={reviewData.reviews}
      stats={reviewData.stats}
    />
  );
}
