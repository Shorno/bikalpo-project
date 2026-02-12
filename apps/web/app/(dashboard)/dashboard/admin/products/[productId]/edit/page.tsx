import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { notFound } from "next/navigation";
import { getQueryClient } from "@/utils/get-query-client";
import { client } from "@/utils/orpc";
import EditProductClient from "./edit-product-client";

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ productId: string }>;
}) {
  const { productId } = await params;
  const productIdNum = Number(productId);

  if (Number.isNaN(productIdNum)) {
    notFound();
  }

  let product;
  try {
    const result = await client.product.getById({ id: productIdNum });
    product = result.product;
  } catch {
    notFound();
  }

  if (!product) {
    notFound();
  }

  const queryClient = getQueryClient();

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <EditProductClient product={product} />
    </HydrationBoundary>
  );
}
