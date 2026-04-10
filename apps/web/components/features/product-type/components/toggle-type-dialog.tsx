"use client";

import type { ProductTypeRow } from "./product-type-columns";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader, Power } from "lucide-react";
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

interface ToggleTypeDialogProps {
  type: ProductTypeRow;
}

export default function ToggleTypeDialog({ type }: ToggleTypeDialogProps) {
  const [open, setOpen] = React.useState(false);
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (id: number) =>
      orpc.adminProductType.toggleActive.call({ id }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["adminProductType"] });
      toast.success(result.message);
      setOpen(false);
    },
    onError: (error) => {
      toast.error(
        error.message || "An error occurred while toggling the type.",
      );
    },
  });

  const willBeActive = !type.isActive;

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="sm" className="w-full justify-start">
          <Power className="h-4 w-4 mr-2" />
          {type.isActive ? "Disable" : "Enable"}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {willBeActive ? "Enable" : "Disable"} {type.name}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            {willBeActive
              ? "This type will become active and visible to sellers."
              : "This type will be set to draft and hidden from sellers."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={mutation.isPending}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              mutation.mutate(type.id);
            }}
            disabled={mutation.isPending}
          >
            {mutation.isPending && (
              <Loader className="mr-2 h-4 w-4 animate-spin" />
            )}
            {willBeActive ? "Enable" : "Disable"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
