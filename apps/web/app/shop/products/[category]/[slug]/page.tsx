import { ProductDetailClient } from "@/components/shop/product-detail-client";

interface ProductDetailsPageProps {
  params: Promise<{ category: string; slug: string }>;
}

export default async function CustomerProductDetailsPage({
  params,
}: ProductDetailsPageProps) {
  const { slug, category } = await params;

  return <ProductDetailClient slug={slug} category={category} />;
}
