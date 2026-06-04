"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { orpc } from "@/utils/orpc";

export function useLookupWarehouseSupplier(warehouseKey: string) {
  return useQuery(
    orpc.warehouse.lookupWarehouseSupplier.queryOptions({
      input: { warehouseKey },
      enabled: !!warehouseKey,
      retry: false,
    }),
  );
}

export function useMyWarehouseSuppliers(params?: {
  status?: "all" | "active" | "pending" | "disconnected";
  search?: string;
  page?: number;
  limit?: number;
}) {
  return useQuery(
    orpc.warehouse.getMyWarehouseSuppliers.queryOptions({
      input: {
        status: params?.status ?? "all",
        search: params?.search || undefined,
        page: params?.page ?? 1,
        limit: params?.limit ?? 50,
      },
      staleTime: 1000 * 30,
    }),
  );
}

export function useRequestWarehouseSupplier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { warehouseKey: string }) =>
      orpc.warehouse.requestWarehouseSupplier.call(input),
    onSuccess: (data) => {
      if (data.status === "already_connected" || data.status === "already_pending") {
        toast.info(data.message);
      } else {
        toast.success(data.message || "Supplier request sent");
      }
      qc.invalidateQueries({ queryKey: orpc.warehouse.getMyWarehouseSuppliers.key() });
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to request supplier access");
    },
  });
}

export function useCancelWarehouseSupplierRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { connectionId: number }) =>
      orpc.warehouse.cancelWarehouseSupplierRequest.call(input),
    onSuccess: (data) => {
      toast.success(data.message || "Supplier request cancelled");
      qc.invalidateQueries({ queryKey: orpc.warehouse.getMyWarehouseSuppliers.key() });
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to cancel supplier request");
    },
  });
}

export function useDisconnectWarehouseSupplier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { connectionId: number }) =>
      orpc.warehouse.disconnectWarehouseSupplier.call(input),
    onSuccess: (data) => {
      toast.success(data.message || "Supplier disconnected");
      qc.invalidateQueries({ queryKey: orpc.warehouse.getMyWarehouseSuppliers.key() });
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to disconnect supplier");
    },
  });
}

export function useWarehouseSupplierRequests(params?: {
  status?: "all" | "pending" | "active" | "disconnected";
  search?: string;
  page?: number;
  limit?: number;
}) {
  return useQuery(
    orpc.warehouse.getWarehouseSupplierRequests.queryOptions({
      input: {
        status: params?.status ?? "all",
        search: params?.search || undefined,
        page: params?.page ?? 1,
        limit: params?.limit ?? 50,
      },
      staleTime: 1000 * 30,
    }),
  );
}

export function useWarehouseSupplierRequestStats() {
  return useQuery(
    orpc.warehouse.getWarehouseSupplierRequestStats.queryOptions({
      staleTime: 1000 * 60,
    }),
  );
}

export function useApproveWarehouseSupplierRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { connectionId: number }) =>
      orpc.warehouse.approveWarehouseSupplierRequest.call(input),
    onSuccess: (data) => {
      toast.success(data.message || "Warehouse supplier approved");
      qc.invalidateQueries({ queryKey: orpc.warehouse.getWarehouseSupplierRequests.key() });
      qc.invalidateQueries({ queryKey: orpc.warehouse.getWarehouseSupplierRequestStats.key() });
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to approve supplier request");
    },
  });
}

export function useRejectWarehouseSupplierRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { connectionId: number }) =>
      orpc.warehouse.rejectWarehouseSupplierRequest.call(input),
    onSuccess: (data) => {
      toast.success(data.message || "Warehouse supplier request rejected");
      qc.invalidateQueries({ queryKey: orpc.warehouse.getWarehouseSupplierRequests.key() });
      qc.invalidateQueries({ queryKey: orpc.warehouse.getWarehouseSupplierRequestStats.key() });
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to reject supplier request");
    },
  });
}
