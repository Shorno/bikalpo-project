import CategoryList from "@/components/features/category/components/category-list";

export default async function CategoryPage() {
  return (
    <div className={"container mx-auto"}>
      <h1 className="text-2xl font-bold mb-4">Product Categories</h1>
      <CategoryList />
    </div>
  );
}
