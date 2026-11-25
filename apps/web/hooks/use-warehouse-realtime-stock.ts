import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/utils/orpc";

/** The warehouse Real-time Stock list, the same shape as the shop's. */
export function useWarehouseRealtimeStock() {
  return useQuery(
    orpc.warehouse.getRealtimeStock.queryOptions({
      staleTime: 1000 * 30, // 30s for real-time feel
    }),
  );
}

/** Saves a warehouse product's low-stock limit and refreshes the list. */
export function useSetWarehouseLowStockLevel() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.warehouse.setProductLowStockLevel.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: orpc.warehouse.getRealtimeStock.key(),
        });
      },
    }),
  );
}
