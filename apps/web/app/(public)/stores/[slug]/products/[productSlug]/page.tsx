import { notFound } from "next/navigation";
import type { DetailVariant } from "@/components/features/products/trade-product-detail-client";
import { ProductDetailsView } from "@/components/features/products/product-details-view";
import { StoreRelatedProducts } from "@/components/features/products/store-related-products";
import {
  isCustomerStorefrontPreview,
  withCustomerStorefrontPreview,
} from "@/lib/customer-storefront-preview";
import { getStoreProductDetail } from "@/lib/public-data";

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

  return (
    <ProductDetailsView
      product={{
        id: product.id,
        name: product.name,
        price: String(product.lowestRetailPrice),
        image: product.image || "",
        images: product.images,
        size: product.size || variants[0]?.unitLabel || "Retail unit",
        description: product.description,
        features: product.features,
        inStock: product.inStock,
        stockQuantity: product.totalAvailableQty,
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
        { label: product.name },
      ]}
      categoryHref={categoryHref}
      purchaseMode="direct"
      directShopId={shop.id}
      previewMode={previewMode}
      relatedProducts={
        <StoreRelatedProducts
          shopId={shop.id}
          shopSlug={slug}
          categorySlug={product.category.slug}
          currentProductId={product.id}
          previewMode={previewMode}
        />
      }
    />
  );
}
