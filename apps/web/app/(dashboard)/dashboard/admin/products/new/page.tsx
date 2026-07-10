import ProductForm from "@/components/features/product/components/product-form";

type NewProductPageProps = {
  searchParams: Promise<{
    coreProductId?: string;
  }>;
};

export default async function NewProductPage({
  searchParams,
}: NewProductPageProps) {
  const params = await searchParams;
  const coreProductId = Number(params.coreProductId);
  const initialCoreProductId =
    Number.isInteger(coreProductId) && coreProductId > 0 ? coreProductId : null;

  return (
    <ProductForm mode="create" initialCoreProductId={initialCoreProductId} />
  );
}
