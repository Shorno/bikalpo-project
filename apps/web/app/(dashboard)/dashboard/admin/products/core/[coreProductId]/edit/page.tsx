import { notFound } from "next/navigation";
import CoreProductConfigForm from "@/components/features/product/components/core-product-config-form";

export default async function EditCoreBrandProductsPage({
  params,
}: {
  params: Promise<{ coreProductId: string }>;
}) {
  const { coreProductId } = await params;
  const parsedCoreProductId = Number(coreProductId);

  if (!Number.isInteger(parsedCoreProductId) || parsedCoreProductId <= 0) {
    notFound();
  }

  return <CoreProductConfigForm coreProductId={parsedCoreProductId} />;
}
