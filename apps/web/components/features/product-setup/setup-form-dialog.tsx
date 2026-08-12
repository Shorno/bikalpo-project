"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export function SetupFormDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  onSubmit,
  submitLabel = "Save",
  isSubmitting = false,
  size = "default",
  trigger,
  formId,
  hasUnsavedChanges = false,
  footerActions,
  submitDisabled = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  children: ReactNode;
  onSubmit: () => void;
  submitLabel?: string;
  isSubmitting?: boolean;
  size?: "default" | "large";
  trigger?: ReactNode;
  formId?: string;
  hasUnsavedChanges?: boolean | (() => boolean);
  footerActions?: ReactNode;
  submitDisabled?: boolean;
}) {
  const requestOpenChange = (nextOpen: boolean) => {
    const isDirty =
      typeof hasUnsavedChanges === "function"
        ? hasUnsavedChanges()
        : hasUnsavedChanges;
    if (
      !nextOpen &&
      !isSubmitting &&
      isDirty &&
      !window.confirm("Discard your unsaved changes?")
    ) {
      return;
    }
    onOpenChange(nextOpen);
  };

  return (
    <Dialog onOpenChange={requestOpenChange} open={open}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent
        className={cn(
          "gap-0 overflow-hidden p-0",
          size === "large" && "sm:max-w-3xl",
        )}
      >
        <DialogHeader className="border-b px-6 py-4 text-left">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="max-h-[70vh] overflow-y-auto px-6 py-5">{children}</div>
        <DialogFooter className="border-t bg-muted/30 px-6 py-4">
          <Button
            className="h-11 sm:h-9"
            disabled={isSubmitting}
            onClick={() => requestOpenChange(false)}
            type="button"
            variant="outline"
          >
            Cancel
          </Button>
          {footerActions}
          <Button
            className="h-11 sm:h-9"
            disabled={isSubmitting || submitDisabled}
            form={formId}
            onClick={formId ? undefined : onSubmit}
            type={formId ? "submit" : "button"}
          >
            {isSubmitting ? "Saving…" : submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
