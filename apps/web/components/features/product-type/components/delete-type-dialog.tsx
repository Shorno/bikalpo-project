"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { SetupDeleteDialog } from "@/components/features/product-setup";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { orpc } from "@/utils/orpc";
import type { ProductTypeRow } from "./product-type-columns";

interface DeleteTypeDialogProps {
  type: ProductTypeRow;
}

export default function DeleteTypeDialog({ type }: DeleteTypeDialogProps) {
  const [open, setOpen] = React.useState(false);
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (id: number) => orpc.adminProductType.delete.call({ id }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["adminProductType"] });
      toast.success(result.message);
      setOpen(false);
    },
    onError: (error) => {
      toast.error(
        error.message || "An error occurred while deleting the type.",
      );
    },
  });

  const handleDelete = () => {
    mutation.mutate(type.id);
  };

  return (
    <SetupDeleteDialog
      dependencyMessage={
        type.categoryCount > 0
          ? `This type has ${type.categoryCount} categories. Remove or reassign them before deleting it.`
          : undefined
      }
      description="This action cannot be undone. This permanently deletes the Product Type."
      isDeleting={mutation.isPending}
      onConfirm={handleDelete}
      onOpenChange={setOpen}
      open={open}
      title={`Delete ${type.name}?`}
      trigger={
        <DropdownMenuItem className="text-destructive focus:text-destructive">
          <Trash2 className="h-4 w-4 mr-2" />
          Delete
        </DropdownMenuItem>
      }
    />
  );
}
