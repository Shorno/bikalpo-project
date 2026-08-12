"use client";

import type { ProductWithRelations } from "./product-columns";
import ProductForm from "./product-form";

export default function ProductEditForm({
  product,
  editAdapter,
  backHref,
}: {
  product: ProductWithRelations;
  editAdapter?: React.ComponentProps<typeof ProductForm>["editAdapter"];
  backHref?: string;
}) {
  return (
    <ProductForm
      mode="edit"
      product={product}
      structureLocked
      backHref={backHref}
      editAdapter={editAdapter}
    />
  );
}
