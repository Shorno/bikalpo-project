"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader } from "lucide-react";
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
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {deletionBlocked
              ? "Core product cannot be deleted"
              : "Delete Core Product"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {deletionBlocked ? (
              <>
                <strong>&quot;{coreProduct.name}&quot;</strong> already has
                generated brand products. The core identity must remain so
                existing products, stock, and order history stay linked
                correctly. Deactivate unwanted brand products from the Product
                editor instead.
              </>
            ) : (
              <>
                Are you sure you want to delete{" "}
                <strong>&quot;{coreProduct.name}&quot;</strong>? This action
                cannot be undone.
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={mutation.isPending}>
            {deletionBlocked ? "Close" : "Cancel"}
          </AlertDialogCancel>
          {!deletionBlocked && (
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                mutation.mutate({ id: coreProduct.id });
              }}
              disabled={mutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {mutation.isPending && (
                <Loader className="mr-2 h-4 w-4 animate-spin" />
              )}
              Delete
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
