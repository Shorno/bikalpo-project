import { and, desc, eq, ne } from "drizzle-orm";
import { db } from "@/db/config";
import { product } from "@/db/schema/product";
import { ProductCard } from "./product-card";

interface RelatedProductsProps {
  categoryId: number;
  currentProductId: number;
}

export async function RelatedProducts({
  categoryId,
  currentProductId,
}: RelatedProductsProps) {
  const relatedProducts = await db.query.product.findMany({
    where: and(
      eq(product.categoryId, categoryId),
      ne(product.id, currentProductId),
    ),
    limit: 4,
    orderBy: [desc(product.createdAt)],
    with: {
      category: {
        columns: {
          name: true,
          slug: true,
        },
      },
    },
  });

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
            <ProductCard key={prod.id} product={prod} />
          ))}
        </div>
      </div>
    </section>
  );
}
