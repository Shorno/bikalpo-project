"use client";

import type { ProductWithRelations } from "@/components/features/product/components/product-columns";
import ProductEditForm from "@/components/features/product/components/product-edit-form";
import ProductForm from "@/components/features/product/components/product-form";

interface EditProductClientProps {
  product: ProductWithRelations;
}

export default function EditProductClient({ product }: EditProductClientProps) {
  const isCoreManaged =
    product.coreProductId !== null && product.createdByWarehouseId === null;

  if (isCoreManaged) {
    return <ProductEditForm product={product} />;
  }

  return <ProductForm mode="edit" product={product} />;
}
