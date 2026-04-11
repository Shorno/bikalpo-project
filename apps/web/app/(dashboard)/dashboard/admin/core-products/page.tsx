import CoreProductList from "@/components/features/core-product/components/core-product-list";

export default async function CoreProductsPage() {
  return (
    <div className="container mx-auto">
      <h1 className="text-2xl font-bold mb-4">Core Product Identities</h1>
      <CoreProductList />
    </div>
  );
}
