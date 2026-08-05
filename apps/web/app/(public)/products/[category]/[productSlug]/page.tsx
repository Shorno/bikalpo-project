import { notFound } from "next/navigation";
import { ProductDetailsView } from "@/components/features/products/product-details-view";
import { RelatedProducts } from "@/components/features/products/related-products";
import type { DetailVariant } from "@/components/features/products/trade-product-detail-client";
import {
  isCustomerStorefrontPreview,
  withCustomerStorefrontPreview,
} from "@/lib/customer-storefront-preview";
import { getProductBySlug } from "@/lib/public-data";

export const revalidate = 30;

interface ProductDetailsPageProps {
  params: Promise<{ category: string; productSlug: string }>;
  searchParams: Promise<{ preview?: string }>;
}

export default async function ProductPage({
  params,
  searchParams,
}: ProductDetailsPageProps) {
  const [{ productSlug }, query] = await Promise.all([params, searchParams]);
  const previewMode = isCustomerStorefrontPreview(query.preview);

  const productData = await getProductBySlug(productSlug, 30);
  const product = productData?.product;

  if (!product) {
    notFound();
  }

  const variants: DetailVariant[] = (productData.variants ?? []).map(
    (variant) => ({
      ...variant,
      price: String(variant.price),
    }),
  );
  const productsHref = withCustomerStorefrontPreview("/products", previewMode);
  const categoryHref = withCustomerStorefrontPreview(
    `/products/${product.category.slug}`,
    previewMode,
  );

  return (
    <ProductDetailsView
      product={{
        id: product.id,
        name: product.name,
        price: String(product.price),
        image: product.image,
        images: product.images?.map((image) => image.imageUrl) ?? [],
        size: product.size,
        description: product.description,
        features: product.features,
        inStock: product.inStock,
        stockQuantity: 0,
        category: product.category,
        subCategory: product.subCategory,
        brand: product.brand,
      }}
      variants={variants}
      breadcrumbs={[
        { label: "Home", href: "/" },
        { label: "Products", href: productsHref },
        { label: product.category.name, href: categoryHref },
        { label: product.name },
      ]}
      categoryHref={categoryHref}
      purchaseMode="open_order"
      previewMode={previewMode}
      relatedProducts={
        <RelatedProducts
          categorySlug={product.category.slug}
          currentProductId={product.id}
          previewMode={previewMode}
        />
      }
    />
  );
}
