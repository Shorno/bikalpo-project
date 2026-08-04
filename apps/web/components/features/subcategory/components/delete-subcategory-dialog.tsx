"use client";

import type { SubCategory } from "@bikalpo-project/db/schema";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { SetupDeleteDialog } from "@/components/features/product-setup";
import { client } from "@/utils/orpc";

interface DeleteSubcategoryDialogProps {
  subcategory: SubCategory;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function DeleteSubcategoryDialog({
  subcategory,
  open,
  onOpenChange,
}: DeleteSubcategoryDialogProps) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (id: number) =>
      client.adminSubcategory.delete({ subcategoryId: id }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["admin-subcategories", subcategory.categoryId],
      });
      queryClient.invalidateQueries({ queryKey: ["admin-categories"] });
      queryClient.invalidateQueries({ queryKey: ["adminSubcategory"] });
      toast.success("Subcategory deleted successfully");
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to delete subcategory.");
    },
  });

  const handleDelete = () => {
    mutation.mutate(subcategory.id);
  };

  return (
    <SetupDeleteDialog
      description="This action permanently deletes the Sub Category. Core Identities and products referencing it are protected by the server."
      isDeleting={mutation.isPending}
      onConfirm={handleDelete}
      onOpenChange={onOpenChange}
      open={open}
      title={`Delete ${subcategory.name}?`}
    />
  );
}
