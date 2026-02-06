"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader, Trash2 } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import deleteSubcategory from "@/actions/subcategory/delete-subcategory";
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
import type { SubCategory } from "@/db/schema";

interface DeleteSubcategoryDialogProps {
  subcategory: SubCategory;
  variant?: "default" | "icon";
}

export default function DeleteSubcategoryDialog({
  subcategory,
  variant = "default",
}: DeleteSubcategoryDialogProps) {
  const [open, setOpen] = React.useState(false);
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (id: number) => deleteSubcategory(id),
    onSuccess: (result) => {
      if (!result.success) {
        switch (result.status) {
          case 401:
            toast.error("You are not authorized to perform this action.");
            break;
          case 404:
            toast.error("Subcategory not found.");
            break;
          default:
            toast.error(result.error || "Failed to delete subcategory.");
        }
        return;
      }
      queryClient.invalidateQueries({
        queryKey: ["admin-subcategories", subcategory.categoryId],
      });
      queryClient.invalidateQueries({ queryKey: ["admin-categories"] });
      toast.success(result.message);
      setOpen(false);
    },
    onError: () => {
      toast.error(
        "An unexpected error occurred while deleting the subcategory.",
      );
    },
  });

  const handleDelete = () => {
    mutation.mutate(subcategory.id);
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        {variant === "icon" ? (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </Button>
        )}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-destructive" />
            Delete {subcategory.name}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete the
            subcategory and all associated products.
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
            Delete Subcategory
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
