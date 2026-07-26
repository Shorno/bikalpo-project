import type { StorefrontProduct } from "@/components/storefront/retailer-storefront";
import { getStoreCatalog } from "@/lib/public-data";
import { StoreRelatedProductsGrid } from "./store-related-products-grid";

interface StoreRelatedProductsProps {
  shopId: string;
  shopSlug: string;
  categorySlug: string;
  currentProductId: number;
  previewMode?: boolean;
}

export async function StoreRelatedProducts({
  shopId,
  shopSlug,
  categorySlug,
  currentProductId,
  previewMode = false,
}: StoreRelatedProductsProps) {
  const result = await getStoreCatalog(
    shopSlug,
    { category: categorySlug, limit: 8 },
    30,
  );
  const products = ((result?.products ?? []) as StorefrontProduct[])
    .filter((product) => product.id !== currentProductId)
    .slice(0, 4);

  if (products.length === 0) return null;

  return (
    <section className="mt-12">
      <div className="rounded-lg bg-white p-6 shadow-sm lg:p-8">
        <h2 className="mb-6 text-2xl font-bold text-gray-900">
          Related Products
        </h2>
        <StoreRelatedProductsGrid
          products={products}
          storeSlug={shopSlug}
          shopId={shopId}
          previewMode={previewMode}
        />
      </div>
    </section>
  );
}
