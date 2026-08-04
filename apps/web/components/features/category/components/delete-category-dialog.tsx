"use client";

import type { Category, SubCategory } from "@bikalpo-project/db/schema";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { SetupDeleteDialog } from "@/components/features/product-setup";
import { orpc } from "@/utils/orpc";

interface DeleteCategoryDialogProps {
  category: Category & { subCategory?: SubCategory[] };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function DeleteCategoryDialog({
  category,
  open,
  onOpenChange,
}: DeleteCategoryDialogProps) {
  const queryClient = useQueryClient();
  const hasSubcategories =
    category.subCategory && category.subCategory.length > 0;
  const subcategoryCount = category.subCategory?.length || 0;

  const mutation = useMutation(
    orpc.category.delete.mutationOptions({
      onSuccess: (result) => {
        queryClient.invalidateQueries({ queryKey: orpc.category.getAll.key() });
        toast.success(result.message);
        onOpenChange(false);
      },
      onError: (error) => {
        toast.error(
          error.message ||
            "An unexpected error occurred while deleting the category.",
        );
      },
    }),
  );

  const handleDelete = () => {
    mutation.mutate({ id: category.id });
  };

  return (
    <SetupDeleteDialog
      dependencyMessage={
        hasSubcategories
          ? `This category has ${subcategoryCount} Sub Categories. Remove or reassign them before deleting it.`
          : undefined
      }
      description="This action cannot be undone. Products referencing this category are also protected by the server."
      isDeleting={mutation.isPending}
      onConfirm={handleDelete}
      onOpenChange={onOpenChange}
      open={open}
      title={`Delete ${category.name}?`}
    />
  );
}
