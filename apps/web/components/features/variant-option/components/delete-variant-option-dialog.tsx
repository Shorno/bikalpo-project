"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { SetupDeleteDialog } from "@/components/features/product-setup";
import { client, orpc } from "@/utils/orpc";
import type { VariantOptionRow } from "./variant-option-columns";

interface DeleteVariantOptionDialogProps {
  variantOption: VariantOptionRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function DeleteVariantOptionDialog({
  variantOption: vo,
  open,
  onOpenChange,
}: DeleteVariantOptionDialogProps) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (id: number) => client.adminVariantOption.delete({ id }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: orpc.adminVariantOption.getAll.key(),
      });
      toast.success("Variant option deleted successfully");
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to delete variant option.");
    },
  });

  const handleDelete = () => {
    mutation.mutate(vo.id);
  };
  const usageCount = vo.productUsageCount + vo.coreIdentityUsageCount;

  return (
    <SetupDeleteDialog
      dependencyMessage={
        usageCount > 0
          ? `This Variant is used by ${vo.productUsageCount} products and ${vo.coreIdentityUsageCount} Core Identities. Disable it instead.`
          : undefined
      }
      description="This action permanently deletes the canonical Variant definition."
      isDeleting={mutation.isPending}
      onConfirm={handleDelete}
      onOpenChange={onOpenChange}
      open={open}
      title={`Delete ${vo.name}?`}
    />
  );
}
