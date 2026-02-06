import { useQuery } from "@tanstack/react-query";
import { getCategoriesForSelect } from "@/actions/product/get-categories-for-select";
import type { Category, SubCategory } from "@/db/schema";

export interface CategoryWithSubs extends Category {
  subCategory: SubCategory[];
}

export function useCategories() {
  return useQuery({
    queryKey: ["categories-with-subs"],
    queryFn: async () => {
      return (await getCategoriesForSelect()) as CategoryWithSubs[];
    },
    staleTime: 1000 * 60 * 10, // Cache for 10 minutes
    gcTime: 1000 * 60 * 30, // Keep in cache for 30 minutes
  });
}

export function useSubCategories(categoryId: number | null) {
  const { data: categories } = useCategories();

  if (!categoryId || !categories) {
    return [];
  }

  const category = categories.find((c) => c.id === categoryId);
  return category?.subCategory || [];
}
