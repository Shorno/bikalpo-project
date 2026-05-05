"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { orpc } from "@/utils/orpc";

// ────────────────────────────────────────────────────────────────
// WAREHOUSE STORE CONNECTION HOOKS (Warehouse Side)
// ────────────────────────────────────────────────────────────────

/** Get all store requests with pagination and filters */
export function useStoreRequests(params?: {
  status?: "pending" | "active" | "disconnected";
  search?: string;
  page?: number;
  limit?: number;
}) {
  return useQuery(
    orpc.warehouse.getStoreRequests.queryOptions({
      input: {
        status: params?.status || "all",
        search: params?.search || undefined,
        page: params?.page ?? 1,
        limit: params?.limit ?? 50,
      },
      staleTime: 1000 * 30, // 30 seconds
    }),
  );
}

/** Get KPIs for store connection requests */
export function useStoreRequestStats() {
  return useQuery(
    orpc.warehouse.getStoreRequestStats.queryOptions({
      staleTime: 1000 * 60, // 1 minute
    }),
  );
}

/** Get connected stores with ordering metrics */
export function useConnectedStores(params?: {
  search?: string;
  page?: number;
  limit?: number;
}) {
  return useQuery(
    orpc.warehouse.getConnectedStores.queryOptions({
      input: {
        search: params?.search || undefined,
        page: params?.page ?? 1,
        limit: params?.limit ?? 50,
      },
      staleTime: 1000 * 60, // 1 minute
    }),
  );
}

/** Approve a pending store request */
export function useApproveStoreRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { connectionId: number }) =>
      orpc.warehouse.approveStoreRequest.call(input),
    onSuccess: (data) => {
      toast.success(data.message || "Store approved successfully");
      qc.invalidateQueries({ queryKey: orpc.warehouse.getStoreRequests.key() });
      qc.invalidateQueries({ queryKey: orpc.warehouse.getStoreRequestStats.key() });
      qc.invalidateQueries({ queryKey: orpc.warehouse.getConnectedStores.key() });
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to approve store");
    },
  });
}

/** Reject/Disconnect a store request */
export function useRejectStoreRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { connectionId: number; isDisconnection?: boolean }) =>
      orpc.warehouse.rejectStoreRequest.call(input),
    onSuccess: (data, variables) => {
      toast.success(
        data.message || (variables.isDisconnection ? "Store disconnected" : "Request rejected")
      );
      qc.invalidateQueries({ queryKey: orpc.warehouse.getStoreRequests.key() });
      qc.invalidateQueries({ queryKey: orpc.warehouse.getStoreRequestStats.key() });
      qc.invalidateQueries({ queryKey: orpc.warehouse.getConnectedStores.key() });
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to process request");
    },
  });
}
