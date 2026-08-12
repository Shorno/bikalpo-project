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
  onDeleted?: () => void;
}

export default function DeleteSubcategoryDialog({
  subcategory,
  open,
  onOpenChange,
  onDeleted,
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
      onDeleted?.();
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
      description="This permanently deletes the Sub Category. Existing dependencies are never cascaded."
      isDeleting={mutation.isPending}
      onConfirm={handleDelete}
      onOpenChange={onOpenChange}
      open={open}
      title={`Delete ${subcategory.name}?`}
    />
  );
}
