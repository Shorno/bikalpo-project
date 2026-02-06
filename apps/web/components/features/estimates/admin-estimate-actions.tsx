"use client";

import { CheckCircle2, Loader2, Pencil, XCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { reviewEstimate } from "@/actions/estimate/admin-estimate-actions";
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
import { Textarea } from "@/components/ui/textarea";

interface AdminEstimateActionsProps {
  estimateId: number;
  status: string;
}

export function AdminEstimateActions({
  estimateId,
  status,
}: AdminEstimateActionsProps) {
  const router = useRouter();

  const [loading, setLoading] = React.useState(false);
  const [notes, setNotes] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const [action, setAction] = React.useState<"approve" | "reject" | null>(null);

  const handleReview = async () => {
    if (!action) return;

    setLoading(true);
    try {
      const result = await reviewEstimate({
        estimateId,
        action,
        notes: notes || undefined,
      });

      if (result.success) {
        toast.success(
          `Estimate ${action === "approve" ? "approved" : "rejected"}`,
        );
        setOpen(false);
        router.refresh();
      } else {
        toast.error(result.error || "Failed to review estimate");
      }
    } catch (_error) {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  // Only show approve/reject for estimates that need admin approval (pending status)
  // "sent" status means it was directly sent to customer (no discount), doesn't need approval
  if (status !== "pending") {
    return null;
  }

  return (
    <div className="flex gap-2">
      <Button variant="secondary" asChild>
        <Link href={`/dashboard/admin/estimates/${estimateId}/edit`}>
          <Pencil className="mr-2 size-4" />
          Edit
        </Link>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <div className="flex gap-2">
          <DialogTrigger asChild>
            <Button
              variant="outline"
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
              onClick={() => setAction("reject")}
              disabled={loading}
            >
              <XCircle className="mr-2 size-4" />
              Reject
            </Button>
          </DialogTrigger>

          <DialogTrigger asChild>
            <Button
              className="bg-green-600 hover:bg-green-700 text-white"
              onClick={() => setAction("approve")}
              disabled={loading}
            >
              <CheckCircle2 className="mr-2 size-4" />
              Approve & Send
            </Button>
          </DialogTrigger>
        </div>

        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {action === "approve" ? "Approve Estimate" : "Reject Estimate"}
            </DialogTitle>
            <DialogDescription>
              {action === "approve"
                ? "Are you sure you want to approve this estimate? It will be sent to the customer for confirmation."
                : "Are you sure you want to reject this estimate? Please provide a reason below."}
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <Textarea
              placeholder="Add internal notes or reason (optional)..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              variant={action === "reject" ? "destructive" : "default"}
              className={
                action === "approve"
                  ? "bg-green-600 hover:bg-green-700 text-white"
                  : ""
              }
              onClick={handleReview}
              disabled={loading}
            >
              {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
              Confirm {action === "approve" ? "Approval" : "Rejection"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
