"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { SetupDeleteDialog } from "@/components/features/product-setup";
import { orpc } from "@/utils/orpc";
import type { CoreProductWithRelations } from "./core-product-columns";

interface DeleteCoreProductDialogProps {
  coreProduct: CoreProductWithRelations;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function DeleteCoreProductDialog({
  coreProduct,
  open,
  onOpenChange,
}: DeleteCoreProductDialogProps) {
  const queryClient = useQueryClient();
  const deletionBlocked = coreProduct.hasConfiguration === true;

  const mutation = useMutation(
    orpc.adminCoreProduct.delete.mutationOptions({
      onSuccess: (result: any) => {
        queryClient.invalidateQueries({
          queryKey: orpc.adminCoreProduct.getAll.key(),
        });
        toast.success(result.message || "Core product deleted successfully");
        onOpenChange(false);
      },
      onError: (error: any) => {
        toast.error(error.message || "Failed to delete core product");
      },
    }),
  );

  return (
    <SetupDeleteDialog
      dependencyMessage={
        deletionBlocked
          ? "This Core Identity already has configured products. Keep it so stock and order history remain linked, and disable it instead."
          : undefined
      }
      description={`Permanently delete ${coreProduct.name}. This action cannot be undone.`}
      isDeleting={mutation.isPending}
      onConfirm={() => mutation.mutate({ id: coreProduct.id })}
      onOpenChange={onOpenChange}
      open={open}
      title={
        deletionBlocked
          ? "Core Identity cannot be deleted"
          : `Delete ${coreProduct.name}?`
      }
    />
  );
}
