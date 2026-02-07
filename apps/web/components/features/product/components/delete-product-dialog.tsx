"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Loader, Trash2 } from "lucide-react";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { orpc } from "@/utils/orpc";

interface DeleteProductDialogProps {
  productId: number;
  productName: string;
  onSuccess?: () => void;
  compact?: boolean;
}

export default function DeleteProductDialog({
  productId,
  productName,
  onSuccess,
  compact,
}: DeleteProductDialogProps) {
  const [open, setOpen] = React.useState(false);
  const queryClient = useQueryClient();

  const mutation = useMutation({
    ...orpc.product.delete.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      toast.success("Product deleted successfully");
      setOpen(false);
      onSuccess?.();
    },
    onError: () => {
      toast.error("An unexpected error occurred while deleting the product.");
    },
  });

  const handleDelete = () => {
    mutation.mutate({ id: productId });
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size={compact ? "icon" : "sm"}
          className={
            compact
              ? "text-destructive hover:text-destructive"
              : "w-full justify-start text-destructive hover:text-destructive"
          }
          title="Delete"
        >
          <Trash2 className={compact ? "h-4 w-4" : "h-4 w-4 mr-2"} />
          {!compact && "Delete"}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-destructive" />
            Delete {productName}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete the
            product from your inventory.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="flex items-start gap-3 rounded-lg border border-destructive/50 bg-destructive/10 p-4">
          <AlertTriangle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
          <div className="text-sm">
            <p className="font-semibold text-destructive mb-1">Warning</p>
            <p className="text-muted-foreground">
              All associated product data, including images, will be permanently
              deleted.
            </p>
          </div>
        </div>

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
              <Loader className="mr-2 h-4 w-4 animate-spin" />
            )}
            Delete Product
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
