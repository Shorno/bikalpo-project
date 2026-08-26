import { notFound } from "next/navigation";
import { PublicProductDetailsView } from "@/components/features/products/public-product-details-view";
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
  const categoryHref = withCustomerStorefrontPreview(
    `/products/${product.category.slug}`,
    previewMode,
  );

  return (
    <PublicProductDetailsView
      product={{
        id: product.id,
        code: `PRD-${String(product.id).padStart(6, "0")}`,
        name: product.name,
        image: product.image,
        size: product.size,
        description: product.description,
        shortDescription: product.shortDescription,
        features: product.features,
        inStock: product.inStock,
        category: product.category,
        subCategory: product.subCategory,
        brand: product.brand,
      }}
      variants={variants}
      reviewStats={productData.reviewStats}
      soldOrderCount={productData.soldOrderCount}
      breadcrumbs={[
        { label: "Home", href: "/" },
        { label: product.category.name, href: categoryHref },
        ...(product.subCategory ? [{ label: product.subCategory.name }] : []),
        ...(product.brand
          ? [
              {
                label:
                  product.category.slug === "lpg"
                    ? `${product.brand.name} Gas`
                    : product.brand.name,
              },
            ]
          : []),
        { label: `PRD-${String(product.id).padStart(6, "0")}` },
      ]}
      categoryHref={categoryHref}
      previewMode={previewMode}
      supportPhone={process.env.NEXT_PUBLIC_SUPPORT_PHONE?.trim() || null}
    />
  );
}
