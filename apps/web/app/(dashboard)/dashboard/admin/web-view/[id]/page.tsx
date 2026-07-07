import { notFound } from "next/navigation";
import { client } from "@/utils/orpc";
import { WebViewDetailClient } from "./web-view-detail-client";

export default async function AdminWebViewDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const productId = Number(id);

  if (Number.isNaN(productId)) {
    notFound();
  }

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
      reviews={reviewData.reviews}
      stats={reviewData.stats}
    />
  );
}
