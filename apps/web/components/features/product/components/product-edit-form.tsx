"use client";

import type { ProductWithRelations } from "./product-columns";
import ProductForm from "./product-form";

export default function ProductEditForm({
  product,
}: {
  product: ProductWithRelations;
}) {
  return <ProductForm mode="edit" product={product} structureLocked />;
}
