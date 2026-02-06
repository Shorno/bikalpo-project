import BrandList from "@/components/features/brand/components/brand-list";

export default async function BrandPage() {
  return (
    <div className={"container mx-auto"}>
      <h1 className="text-2xl font-bold mb-4">Brands</h1>
      <BrandList />
    </div>
  );
}
