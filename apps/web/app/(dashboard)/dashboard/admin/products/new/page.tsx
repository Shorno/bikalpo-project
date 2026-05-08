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

  return (
    <ProductForm
      initialCoreProductId={
        Number.isFinite(coreProductId) ? coreProductId : null
      }
      mode="create"
    />
  );
}
