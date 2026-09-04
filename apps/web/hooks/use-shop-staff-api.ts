"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/utils/orpc";

export function useShopStaffFunctions() {
  return useQuery(orpc.shopStaff.listFunctions.queryOptions());
}

export function useShopMyAccess() {
  return useQuery(orpc.shopStaff.myAccess.queryOptions());
}

export function useShopRoleCatalog() {
  return useQuery(orpc.shopRole.catalog.queryOptions());
}

export function useShopRoles() {
  return useQuery(orpc.shopRole.list.queryOptions());
}

function useInvalidateShopRoles() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: orpc.shopRole.list.key() });
    void queryClient.invalidateQueries({ queryKey: orpc.shopStaff.list.key() });
    void queryClient.invalidateQueries({
      queryKey: orpc.shopStaff.myAccess.key(),
    });
  };
}

export function useCreateShopRole() {
  const invalidate = useInvalidateShopRoles();
  return useMutation(
    orpc.shopRole.create.mutationOptions({ onSuccess: invalidate }),
  );
}

export function useUpdateShopRole() {
  const invalidate = useInvalidateShopRoles();
  return useMutation(
    orpc.shopRole.update.mutationOptions({ onSuccess: invalidate }),
  );
}

export function useDeleteShopRole() {
  const invalidate = useInvalidateShopRoles();
  return useMutation(
    orpc.shopRole.remove.mutationOptions({ onSuccess: invalidate }),
  );
}

export function useAssignShopRole() {
  const invalidate = useInvalidateShopRoles();
  return useMutation(
    orpc.shopRole.assign.mutationOptions({ onSuccess: invalidate }),
  );
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
