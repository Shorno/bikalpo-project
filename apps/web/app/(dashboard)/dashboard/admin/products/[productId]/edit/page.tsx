import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { notFound } from "next/navigation";
import getProductById from "@/actions/product/get-product-by-id";
import { getQueryClient } from "@/utils/get-query-client";
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

  const product = await getProductById(productIdNum);

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
