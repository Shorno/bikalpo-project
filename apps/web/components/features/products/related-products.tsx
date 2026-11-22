import { getReferenceProductsWithQuery } from "@/lib/public-data";
import { CatalogProductGrid } from "./catalog-product-grid";
import { ConsumerProductCard } from "./consumer-product-card";
import { RelatedProductsSection } from "./related-products-section";

interface RelatedProductsProps {
  categorySlug: string;
  /** Related products come from the same sub-category when it is known. */
  subcategorySlug?: string | null;
  currentProductId: number;
}

export async function RelatedProducts({
  categorySlug,
  subcategorySlug,
  currentProductId,
}: RelatedProductsProps) {
  const { products } = await getReferenceProductsWithQuery(
    {
      ...(subcategorySlug
        ? { subcategory: subcategorySlug }
        : { category: categorySlug }),
      limit: "11",
      sort: "newest",
    },
    600,
  ).catch(() => ({ products: [] }));

  const relatedProducts = products
    .filter((prod) => prod.id !== currentProductId)
    .slice(0, 10);

  if (relatedProducts.length === 0) {
    return null;
  }

  return (
    <RelatedProductsSection>
      <CatalogProductGrid>
        {relatedProducts.map((prod) => (
          <ConsumerProductCard key={prod.id} product={prod} />
        ))}
      </CatalogProductGrid>
    </RelatedProductsSection>
  );
}
