"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/utils/orpc";

export function useShopStaffFunctions() {
  return useQuery(orpc.shopStaff.listFunctions.queryOptions());
}

export function useShopStaffMembers() {
  return useQuery(orpc.shopStaff.list.queryOptions());
}

export function useShopStaffMember(staffId: string | undefined) {
  return useQuery(
    orpc.shopStaff.getById.queryOptions({
      input: { staffId: staffId ?? "" },
      enabled: Boolean(staffId),
    }),
  );
}

export function useCreateShopStaff() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.shopStaff.create.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({
          queryKey: orpc.shopStaff.list.key(),
        });
        void queryClient.invalidateQueries({
          queryKey: orpc.shopStaff.getById.key(),
        });
      },
    }),
  );
}

export function useAssignShopStaffFunction() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.shopStaff.assignFunction.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({
          queryKey: orpc.shopStaff.list.key(),
        });
        void queryClient.invalidateQueries({
          queryKey: orpc.shopStaff.getById.key(),
        });
      },
    }),
  );
}
