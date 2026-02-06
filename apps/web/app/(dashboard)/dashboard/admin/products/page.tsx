import { Plus } from "lucide-react";
import Link from "next/link";
import ProductList from "@/components/features/product/components/product-list";
import { Button } from "@/components/ui/button";

export default async function ProductsPage() {
  return (
    <div className="container mx-auto py-6">
      <div className="flex items-center justify-between mb-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold">Products</h1>
          <p className="text-muted-foreground">
            Manage your product inventory and listings.
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/admin/products/new">
            <Plus className="h-4 w-4 mr-2" />
            Add Product
          </Link>
        </Button>
      </div>
      <ProductList />
    </div>
  );
}
