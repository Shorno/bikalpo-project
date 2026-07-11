"use client";

import type { ProductWithRelations } from "./product-columns";
import ProductForm from "./product-form";

export default function ProductEditForm({
  product,
  editAdapter,
}: {
  product: ProductWithRelations;
  editAdapter?: React.ComponentProps<typeof ProductForm>["editAdapter"];
}) {
  return (
    <ProductForm
      mode="edit"
      product={product}
      structureLocked
      editAdapter={editAdapter}
    />
  );
}
