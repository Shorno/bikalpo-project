"use client";

import type { Brand } from "@bikalpo-project/db/schema";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as React from "react";
import { toast } from "sonner";
import { SetupDeleteDialog } from "@/components/features/product-setup";
import { orpc } from "@/utils/orpc";

interface DeleteBrandDialogProps {
  brand: Brand & { productCount?: number; variantCount?: number };
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onDeleted?: () => void;
  trigger?: React.ReactNode;
}

export default function DeleteBrandDialog({
  brand,
  open,
  onOpenChange,
  onDeleted,
  trigger,
}: DeleteBrandDialogProps) {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const dialogOpen = open ?? internalOpen;
  const queryClient = useQueryClient();
  const setDialogOpen = React.useCallback(
    (nextOpen: boolean) => {
      setInternalOpen(nextOpen);
      onOpenChange?.(nextOpen);
    },
    [onOpenChange],
  );

  const mutation = useMutation(
    orpc.brand.delete.mutationOptions({
      onSuccess: (result) => {
        void queryClient.invalidateQueries({
          queryKey: orpc.brand.getAll.key(),
        });
        void queryClient.invalidateQueries({
          queryKey: orpc.brand.getAdminAll.key(),
        });
        toast.success(result.message);
        setDialogOpen(false);
        onDeleted?.();
      },
      onError: (error) => {
        toast.error(
          error.message ||
            "An unexpected error occurred while deleting the brand.",
        );
      },
    }),
  );

  const handleDelete = () => {
    mutation.mutate({ id: brand.id });
  };
  const usageCount = (brand.productCount ?? 0) + (brand.variantCount ?? 0);

  return (
    <SetupDeleteDialog
      dependencyMessage={
        usageCount > 0
          ? `This brand is used by ${brand.productCount ?? 0} products and ${brand.variantCount ?? 0} Variants. Disable it instead.`
          : undefined
      }
      description="This action permanently deletes the brand. Brands referenced by configured products or variants are protected by the server."
      isDeleting={mutation.isPending}
      onConfirm={handleDelete}
      onOpenChange={setDialogOpen}
      open={dialogOpen}
      title={`Delete ${brand.name}?`}
      trigger={trigger}
    />
  );
}
