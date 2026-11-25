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

/** The warehouse Batch page, the same shape as the shop's. */
export function useWarehouseBatchStock() {
  return useQuery(
    orpc.warehouse.getBatchStock.queryOptions({
      staleTime: 1000 * 60, // 1 min cache
    }),
  );
}

/** The warehouse Expired Products list, the same shape as the shop's. */
export function useWarehouseExpiryStock() {
  return useQuery(
    orpc.warehouse.getExpiryStock.queryOptions({
      staleTime: 1000 * 60, // 1 min cache
    }),
  );
}

/** Saves how many days before expiry a warehouse product shows as expiring. */
export function useSetWarehouseExpiryAlertDays() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.warehouse.setProductExpiryAlertDays.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: orpc.warehouse.getExpiryStock.key(),
        });
        queryClient.invalidateQueries({
          queryKey: orpc.warehouse.getRealtimeStock.key(),
        });
      },
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
