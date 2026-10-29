import { getReferenceProductsWithQuery } from "@/lib/public-data";
import { CatalogProductGrid } from "./catalog-product-grid";
import { ConsumerProductCard } from "./consumer-product-card";

interface RelatedProductsProps {
  categorySlug: string;
  currentProductId: number;
  previewMode?: boolean;
}

export async function RelatedProducts({
  categorySlug,
  currentProductId,
  previewMode = false,
}: RelatedProductsProps) {
  const { products } = await getReferenceProductsWithQuery(
    {
      category: categorySlug,
      limit: "8",
      sort: "newest",
    },
    600,
  );

  const relatedProducts = products
    .filter((prod) => prod.id !== currentProductId)
    .slice(0, 4);

  if (relatedProducts.length === 0) {
    return null;
  }

  return (
    <section className="mt-12">
      <div className="bg-white rounded-lg shadow-sm p-6 lg:p-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">
          Related Products
        </h2>
        <CatalogProductGrid withSidebar>
          {relatedProducts.map((prod) => (
            <ConsumerProductCard
              key={prod.id}
              product={prod}
              previewMode={previewMode}
            />
          ))}
        </CatalogProductGrid>
      </div>
    </section>
  );
}
