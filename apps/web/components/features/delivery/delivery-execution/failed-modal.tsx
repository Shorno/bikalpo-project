"use client";

import { Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface FailedModalProps {
  open: boolean;
  isLoading: boolean;
  reason: string;
  onReasonChange: (value: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}

export function FailedModal({
  open,
  isLoading,
  reason,
  onReasonChange,
  onClose,
  onConfirm,
}: FailedModalProps) {
  const canConfirm = reason.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-center sm:text-center">
          <div className="mx-auto mb-4">
            <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
              <XCircle className="w-6 h-6 text-destructive" />
            </div>
          </div>
          <DialogTitle>Report Failed Delivery</DialogTitle>
          <DialogDescription>
            Please explain why this delivery could not be completed.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <Label className="mb-2 block">Reason for failure</Label>
          <Textarea
            placeholder="e.g., Customer not available, Wrong address..."
            value={reason}
            onChange={(e) => onReasonChange(e.target.value)}
            rows={3}
            autoFocus
          />
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={isLoading || !canConfirm}
          >
            {isLoading && <Loader2 className="mr-2 size-4 animate-spin" />}
            Mark as Failed
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
