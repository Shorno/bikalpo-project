"use client";

import type { Brand } from "@bikalpo-project/db/schema";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { SetupDeleteDialog } from "@/components/features/product-setup";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { orpc } from "@/utils/orpc";

interface DeleteBrandDialogProps {
  brand: Brand & { productCount?: number; variantCount?: number };
}

export default function DeleteBrandDialog({ brand }: DeleteBrandDialogProps) {
  const [open, setOpen] = React.useState(false);
  const queryClient = useQueryClient();

  const mutation = useMutation(
    orpc.brand.delete.mutationOptions({
      onSuccess: (result) => {
        queryClient.invalidateQueries({ queryKey: orpc.brand.getAll.key() });
        toast.success(result.message);
        setOpen(false);
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
      onOpenChange={setOpen}
      open={open}
      title={`Delete ${brand.name}?`}
      trigger={
        <DropdownMenuItem className="text-destructive focus:text-destructive">
          <Trash2 className="h-4 w-4 mr-2" />
          Delete
        </DropdownMenuItem>
      }
    />
  );
}
