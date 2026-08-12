import { notFound } from "next/navigation";
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

  return <CategoryDetailClient category={categoryData} />;
}
