import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import getCategoryById from "@/actions/category/get-category-by-id";
import getSubcategories from "@/actions/subcategory/get-subcategories";
import { subcategoryColumns } from "@/components/features/subcategory/components/subcategory-columns";
import SubcategoryTable from "@/components/features/subcategory/components/subcategory-table";
import { Button } from "@/components/ui/button";
import { getQueryClient } from "@/utils/get-query-client";

export default async function SubCategoryPage({
  params,
}: {
  params: Promise<{ categoryId: string }>;
}) {
  const { categoryId } = await params;
  const category = await getCategoryById(Number(categoryId));
  if (!category) {
    notFound();
  }

  const queryClient = getQueryClient();

  // Prefetch subcategories data on the server (don't await - non-blocking)
  queryClient.prefetchQuery({
    queryKey: ["admin-subcategories", Number(categoryId)],
    queryFn: () => getSubcategories(Number(categoryId)),
  });

  return (
    <div className="container mx-auto py-6">
      <div className="mb-6 space-y-2">
        <Button asChild variant="ghost" size="sm">
          <Link href="/dashboard/categories">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Categories
          </Link>
        </Button>
        <h1 className="text-2xl font-bold">
          Subcategories for {category.name}
        </h1>
        <p className="text-muted-foreground">
          Manage subcategories under the {category.name} category.
        </p>
      </div>
      <HydrationBoundary state={dehydrate(queryClient)}>
        <SubcategoryTable
          columns={subcategoryColumns}
          categoryId={Number(categoryId)}
          categoryName={category.name}
        />
      </HydrationBoundary>
    </div>
  );
}
