import { useQuery, useQueryClient } from "@tanstack/react-query";
import { client } from "@/utils/orpc";

export function useAdminProducts() {
  return useQuery({
    queryKey: ["admin-products"],
    queryFn: async () => {
      const { products } = await client.product.getAll();
      return products;
    },
    staleTime: 1000 * 60 * 5,
  });
}

export function useInvalidateQueries() {
  const queryClient = useQueryClient();

  return {
    invalidateProducts: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["admin-products"] });
    },
    invalidateCategories: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      queryClient.invalidateQueries({ queryKey: ["categories-with-subs"] });
    },
  };
}
