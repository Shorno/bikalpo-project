import { useQuery } from "@tanstack/react-query";
import getBrands from "@/actions/brand/get-brands";

export function useBrands() {
  return useQuery({
    queryKey: ["brands-for-select"],
    queryFn: getBrands,
    staleTime: 1000 * 60 * 10, // Cache for 10 minutes
    gcTime: 1000 * 60 * 30, // Keep in cache for 30 minutes
  });
}
