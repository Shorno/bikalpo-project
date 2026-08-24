import { getReferenceProductsWithQuery } from "@/lib/public-data";
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {relatedProducts.map((prod) => (
            <ConsumerProductCard
              key={prod.id}
              product={prod}
              previewMode={previewMode}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
