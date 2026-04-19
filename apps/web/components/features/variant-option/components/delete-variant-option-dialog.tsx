"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader, Trash2 } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { client, orpc } from "@/utils/orpc";
import { type VariantOptionRow } from "./variant-option-columns";

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
    mutationFn: (id: number) =>
      client.adminVariantOption.delete({ id }),
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

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-destructive" />
            Delete &quot;{vo.name}&quot;?
          </AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete the
            variant option.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={mutation.isPending}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              handleDelete();
            }}
            disabled={mutation.isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {mutation.isPending && (
              <Loader className="h-4 w-4 mr-2 animate-spin" />
            )}
            Delete Variant
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
