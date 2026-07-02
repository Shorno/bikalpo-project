"use client";

import { Loader2 } from "lucide-react";
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

type KycVerifyDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subjectName: string;
  notes: string;
  onNotesChange: (value: string) => void;
  onConfirm: () => void;
  isPending: boolean;
};

export function KycVerifyDialog({
  open,
  onOpenChange,
  subjectName,
  notes,
  onNotesChange,
  onConfirm,
  isPending,
}: KycVerifyDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Verify KYC</DialogTitle>
          <DialogDescription>
            Mark identity and business documents for{" "}
            <strong>{subjectName}</strong> as verified. This does not approve
            their application.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label>Admin note (optional)</Label>
          <Textarea
            placeholder="Optional verification note..."
            value={notes}
            onChange={(e) => onNotesChange(e.target.value)}
            rows={3}
          />
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            className="bg-green-600 hover:bg-green-700"
            onClick={onConfirm}
            disabled={isPending}
          >
            {isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
            Verify KYC
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export const KYC_STATUS_CONFIG = {
  verified: {
    label: "Verified",
    bg: "bg-green-50",
    color: "text-green-700",
    border: "border-green-200",
  },
  pending: {
    label: "Pending",
    bg: "bg-amber-50",
    color: "text-amber-700",
    border: "border-amber-200",
  },
  failed: {
    label: "Failed",
    bg: "bg-red-50",
    color: "text-red-700",
    border: "border-red-200",
  },
  unverified: {
    label: "Unverified",
    bg: "bg-gray-50",
    color: "text-gray-600",
    border: "border-gray-200",
  },
} as const;

export type KycStatusKey = keyof typeof KYC_STATUS_CONFIG;
