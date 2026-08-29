import { notFound } from "next/navigation";
import { StorefrontProductDetailsView } from "@/components/features/products/public-product-details-view";
import type { DetailVariant } from "@/components/features/products/trade-product-detail-client";
import {
  isCustomerStorefrontPreview,
  withCustomerStorefrontPreview,
} from "@/lib/customer-storefront-preview";
import { getStoreProductDetail } from "@/lib/public-data";
import { formatProductCode } from "@/lib/storefront-product-details";

interface StoreProductDetailsPageProps {
  params: Promise<{ slug: string; productSlug: string }>;
  searchParams: Promise<{ preview?: string }>;
}

export default async function StoreProductDetailsPage({
  params,
  searchParams,
}: StoreProductDetailsPageProps) {
  const [{ slug, productSlug }, query] = await Promise.all([
    params,
    searchParams,
  ]);
  const previewMode = isCustomerStorefrontPreview(query.preview);
  const detail = await getStoreProductDetail(slug, productSlug, 0);
  const product = detail?.product;
  const shop = detail?.shop;

  if (!product || !shop || !product.category) {
    notFound();
  }

  const variants: DetailVariant[] = product.variants.map((variant) => ({
    id: variant.id,
    sku: variant.sku,
    unitLabel:
      variant.unitLabel || variant.quantitySelectorLabel || "Retail unit",
    price: String(variant.retailPrice),
    weightKg: variant.weightKg == null ? null : String(variant.weightKg),
    packagingType: variant.packagingType,
    origin: variant.origin,
    shelfLife: variant.shelfLife,
    orderMin: variant.orderMin == null ? null : String(variant.orderMin),
    orderMax: String(Math.floor(variant.availableQty)),
    orderIncrement:
      variant.orderIncrement == null ? null : String(variant.orderIncrement),
    orderUnit: variant.orderUnit,
    quantitySelectorOptions: variant.quantitySelectorOptions,
    sortOrder: variant.sortOrder,
    stockQuantity: variant.availableQty,
    variantType: variant.variantType,
    packType: variant.packType,
    isActive: variant.isActive,
    cylinderSale: variant.cylinderSale,
  }));
  const storeHref = withCustomerStorefrontPreview(
    `/stores/${encodeURIComponent(slug)}`,
    previewMode,
  );
  const categoryHref = withCustomerStorefrontPreview(
    `/stores/${encodeURIComponent(slug)}?category=${encodeURIComponent(product.category.slug)}`,
    previewMode,
  );
  const storeName = shop.shopName || shop.name;
  const productCode = formatProductCode(product.id);

  return (
    <StorefrontProductDetailsView
      product={{
        id: product.id,
        code: productCode,
        name: product.name,
        image: product.image || "",
        size: product.size || variants[0]?.unitLabel || "Retail unit",
        description: product.description,
        shortDescription: product.shortDescription,
        features: product.features,
        inStock: product.inStock,
        category: product.category,
        subCategory: product.subCategory,
        brand: product.brand,
      }}
      variants={variants}
      breadcrumbs={[
        { label: "Home", href: "/" },
        {
          label: "Stores",
          href: withCustomerStorefrontPreview("/stores", previewMode),
        },
        { label: storeName, href: storeHref },
        { label: productCode },
      ]}
      categoryHref={categoryHref}
      previewMode={previewMode}
      purchase={{
        kind: "direct",
        shopId: shop.id,
        supportPhone: shop.phoneNumber,
      }}
      reviewStats={detail.reviewStats}
      soldOrderCount={detail.soldOrderCount}
    />
  );
}
