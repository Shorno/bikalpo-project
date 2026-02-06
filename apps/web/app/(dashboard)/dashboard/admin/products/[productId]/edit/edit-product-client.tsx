"use client";

import type { ProductWithRelations } from "@/components/features/product/components/product-columns";
import ProductForm from "@/components/features/product/components/product-form";

interface EditProductClientProps {
  product: ProductWithRelations;
}

export default function EditProductClient({ product }: EditProductClientProps) {
  return <ProductForm mode="edit" product={product} />;
}
