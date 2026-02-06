import { useQuery, useQueryClient } from "@tanstack/react-query";
import getProducts from "@/actions/product/get-products";

export function useAdminProducts() {
  return useQuery({
    queryKey: ["admin-products"],
    queryFn: async () => {
      return await getProducts();
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
