"use client";

import { Loader2, Send, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
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
import { client } from "@/utils/orpc";

interface EstimateCustomer {
  name?: string | null;
  shopName?: string | null;
  warehouseName?: string | null;
  phoneNumber?: string | null;
}

interface EstimateActionInput {
  id: number;
  discount?: string | number | null;
  status: string;
  customer?: EstimateCustomer | null;
}

interface EstimateActionButtonsProps {
  estimate: EstimateActionInput;
}

export function EstimateActionButtons({
  estimate,
}: EstimateActionButtonsProps) {
  const router = useRouter();

  const [loading, setLoading] = React.useState(false);

  const handleSend = async () => {
    setLoading(true);
    try {
      await client.salesman.sendEstimate({ id: estimate.id });
      toast.success("Estimate sent for review");
      router.refresh();
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : "Failed to send estimate",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    setLoading(true);
    try {
      await client.salesman.deleteEstimate({ id: estimate.id });
      toast.success("Estimate deleted");

      const finalRedirectPath = window.location.pathname.includes("/admin")
        ? "/dashboard/admin/estimates"
        : "/employee/estimates";

      router.push(finalRedirectPath);
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete estimate",
      );
    } finally {
      setLoading(false);
    }
  };

  if (estimate.status === "draft") {
    return (
      <div className="flex gap-2">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" size="sm" disabled={loading}>
              <Trash2 className="mr-2 size-4" />
              Delete
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the
                estimate.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete}>
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Button size="sm" onClick={handleSend} disabled={loading}>
          {loading ? (
            <Loader2 className="mr-2 size-4 animate-spin" />
          ) : (
            <Send className="mr-2 size-4" />
          )}
          {Number(estimate.discount) > 0
            ? "Send For Admin Approval"
            : "Send to Customer"}
        </Button>
      </div>
    );
  }

  if (estimate.status === "pending_admin_approval") {
    return (
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled>
          <Loader2 className="mr-2 size-4 animate-spin" />
          Waiting for Admin Approval
        </Button>
      </div>
    );
  }

  if (estimate.status === "approved" || estimate.status === "sent") {
    return (
      <Button variant="outline" size="sm" disabled>
        Waiting for customer acceptance
      </Button>
    );
  }

  return null;
}
