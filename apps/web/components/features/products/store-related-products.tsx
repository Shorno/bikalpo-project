import type { StorefrontProduct } from "@/components/storefront/retailer-storefront";
import { getStoreCatalog } from "@/lib/public-data";
import { RelatedProductsSection } from "./related-products-section";
import { StoreRelatedProductsGrid } from "./store-related-products-grid";

interface StoreRelatedProductsProps {
  shopId: string;
  shopSlug: string;
  categorySlug: string;
  /** Related products come from the same sub-category when it is known. */
  subcategorySlug?: string | null;
  currentProductId: number;
}

export async function StoreRelatedProducts({
  shopId,
  shopSlug,
  categorySlug,
  subcategorySlug,
  currentProductId,
}: StoreRelatedProductsProps) {
  const result = await getStoreCatalog(
    shopSlug,
    subcategorySlug
      ? { subcategory: subcategorySlug, limit: 9 }
      : { category: categorySlug, limit: 9 },
    30,
  );
  const products = ((result?.products ?? []) as StorefrontProduct[])
    .filter((product) => product.id !== currentProductId)
    .slice(0, 8);

  if (products.length === 0) return null;

  return (
    <RelatedProductsSection>
      <StoreRelatedProductsGrid
        products={products}
        storeSlug={shopSlug}
        shopId={shopId}
        previewMode={false}
      />
    </RelatedProductsSection>
  );
}
