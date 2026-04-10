import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ADMIN_BASE } from "@/lib/routes";
import { getQueryClient } from "@/utils/get-query-client";
import { client } from "@/utils/orpc";
import CategoryDetailClient from "./category-detail-client";

export default async function CategoryDetailPage({
  params,
}: {
  params: Promise<{ categoryId: string }>;
}) {
  const { categoryId } = await params;
  let categoryData: any = null;
  try {
    categoryData = await client.category.getById({ id: Number(categoryId) });
  } catch {
    notFound();
  }
  if (!categoryData) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost" size="sm">
          <Link href={`${ADMIN_BASE}/categories`}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Categories
          </Link>
        </Button>
      </div>
      <CategoryDetailClient category={categoryData} />
    </div>
  );
}
