import { ProductDetailClient } from "@/components/shop/product-detail-client";

export const revalidate = 30;

interface ProductDetailsPageProps {
  params: Promise<{ category: string; productSlug: string }>;
}

export default async function ProductPage({ params }: ProductDetailsPageProps) {
  const { category, productSlug } = await params;

  return (
    <ProductDetailClient
      slug={productSlug}
      category={category}
      homeLabel="Home"
      homeHref="/"
      productsHref="/products"
    />
  );
}
