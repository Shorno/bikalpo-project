import ProductTypeList from "@/components/features/product-type/components/product-type-list";

export default function TypesPage() {
  return (
    <div className="container mx-auto">
      <h1 className="text-2xl font-bold mb-4">Product Types</h1>
      <ProductTypeList />
    </div>
  );
}
