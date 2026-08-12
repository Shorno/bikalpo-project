"use client";

import type { ReactNode } from "react";
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

export function SetupDeleteDialog({
  open,
  onOpenChange,
  title,
  description,
  dependencyMessage,
  onConfirm,
  isDeleting = false,
  trigger,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  dependencyMessage?: ReactNode;
  onConfirm: () => void;
  isDeleting?: boolean;
  trigger?: ReactNode;
}) {
  const blocked = Boolean(dependencyMessage);
  return (
    <AlertDialog onOpenChange={onOpenChange} open={open}>
      {trigger && <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>}
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>{description}</p>
              {dependencyMessage && (
                <p className="rounded-md border bg-muted px-3 py-2 text-foreground">
                  {dependencyMessage}
                </p>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="h-11 sm:h-9">Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="h-11 sm:h-9"
            disabled={blocked || isDeleting}
            onClick={(event) => {
              event.preventDefault();
              onConfirm();
            }}
            variant="destructive"
          >
            {isDeleting ? "Deleting…" : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
