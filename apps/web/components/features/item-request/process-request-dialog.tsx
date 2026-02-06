"use client";

import { Check, Lightbulb, Loader2, X } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { toast } from "sonner";
import {
  approveItemRequest,
  rejectItemRequest,
  suggestAlternativeProduct,
} from "@/actions/item-request/admin-item-request-actions";
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
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type { ItemRequestWithRelations } from "@/db/schema/item-request";
import { ProductSelect } from "./product-select";
import { RequestStatusBadge } from "./request-status-badge";

interface ProcessRequestDialogProps {
  request: ItemRequestWithRelations;
}

export function ProcessRequestDialog({ request }: ProcessRequestDialogProps) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState("approve");

  const [approveResponse, setApproveResponse] = useState("");
  const [rejectResponse, setRejectResponse] = useState("");
  const [suggestResponse, setSuggestResponse] = useState("");
  const [suggestedProductId, setSuggestedProductId] = useState<number | null>(
    null,
  );
  const [addToProductId, setAddToProductId] = useState<number | null>(null);

  const handleApprove = async () => {
    setIsSubmitting(true);
    try {
      const result = await approveItemRequest(
        request.id,
        approveResponse,
        addToProductId ?? undefined,
      );
      if (result.success) {
        toast.success("Request approved!");
        setOpen(false);
      } else {
        toast.error(result.error || "Failed to approve");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async () => {
    setIsSubmitting(true);
    try {
      const result = await rejectItemRequest(request.id, rejectResponse);
      if (result.success) {
        toast.success("Request rejected");
        setOpen(false);
      } else {
        toast.error(result.error || "Failed to reject");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSuggest = async () => {
    if (!suggestedProductId) {
      toast.error("Please select a product to suggest");
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await suggestAlternativeProduct(
        request.id,
        suggestedProductId,
        suggestResponse,
      );
      if (result.success) {
        toast.success("Alternative suggested!");
        setOpen(false);
      } else {
        toast.error(result.error || "Failed to suggest");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setAddToProductId(null);
      setSuggestedProductId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Process
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-150">
        <DialogHeader>
          <DialogTitle>Process Item Request</DialogTitle>
          <DialogDescription>
            Review and take action on this customer request.
          </DialogDescription>
        </DialogHeader>

        {/* Request Details */}
        <div className="bg-muted/50 rounded-lg p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {request.requestNumber}
            </span>
            <RequestStatusBadge status={request.status} />
          </div>
          <h3 className="font-semibold text-lg">{request.itemName}</h3>
          <div className="grid grid-cols-3 gap-4 text-sm">
            {request.brand && (
              <div>
                <span className="text-muted-foreground">Brand:</span>{" "}
                {request.brand}
              </div>
            )}
            {request.category && (
              <div>
                <span className="text-muted-foreground">Category:</span>{" "}
                {request.category}
              </div>
            )}
            <div>
              <span className="text-muted-foreground">Qty:</span>{" "}
              {request.quantity}
            </div>
          </div>
          {request.description && (
            <p className="text-sm text-muted-foreground mt-2">
              {request.description}
            </p>
          )}
          {request.customer && (
            <div className="text-sm mt-2 pt-2 border-t">
              <span className="text-muted-foreground">Customer:</span>{" "}
              <span className="font-medium">{request.customer.name}</span>
              {request.customer.shopName && (
                <span className="text-muted-foreground">
                  {" "}
                  ({request.customer.shopName})
                </span>
              )}
            </div>
          )}
          {request.image && (
            <div className="mt-3 pt-3 border-t">
              <span className="text-sm text-muted-foreground block mb-2">
                Reference Image:
              </span>
              <div className="relative w-24 h-24 rounded-lg overflow-hidden border">
                <Image
                  width={100}
                  height={100}
                  src={request.image}
                  alt="Reference"
                  className="size-full object-cover"
                />
              </div>
            </div>
          )}
        </div>

        {/* Action Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full grid grid-cols-3">
            <TabsTrigger value="approve" className="gap-2">
              <Check className="size-4" />
              Approve
            </TabsTrigger>
            <TabsTrigger value="reject" className="gap-2">
              <X className="size-4" />
              Reject
            </TabsTrigger>
            <TabsTrigger value="suggest" className="gap-2">
              <Lightbulb className="size-4" />
              Suggest
            </TabsTrigger>
          </TabsList>

          <TabsContent value="approve" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Add to product stock (required)</Label>
              <p className="text-xs text-muted-foreground">
                Select a product to add the requested quantity (
                {request.quantity}) to its inventory. Stock will be updated
                automatically when you approve.
              </p>
              <ProductSelect
                onSelect={(id) => setAddToProductId(id)}
                selectedId={addToProductId}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="approveResponse">
                Response Message (Optional)
              </Label>
              <Textarea
                id="approveResponse"
                placeholder="Your request has been approved. The item has been added to stock."
                value={approveResponse}
                onChange={(e) => setApproveResponse(e.target.value)}
                className="resize-none"
                rows={3}
              />
            </div>
            <Button
              onClick={handleApprove}
              disabled={isSubmitting || !addToProductId}
              className="w-full"
            >
              {isSubmitting && <Loader2 className="mr-2 size-4 animate-spin" />}
              Approve Request
            </Button>
          </TabsContent>

          <TabsContent value="reject" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="rejectResponse">Reason for Rejection</Label>
              <Textarea
                id="rejectResponse"
                placeholder="Explain why this request cannot be fulfilled..."
                value={rejectResponse}
                onChange={(e) => setRejectResponse(e.target.value)}
                className="resize-none"
                rows={3}
              />
            </div>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={isSubmitting}
              className="w-full"
            >
              {isSubmitting && <Loader2 className="mr-2 size-4 animate-spin" />}
              Reject Request
            </Button>
          </TabsContent>

          <TabsContent value="suggest" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Select Alternative Product</Label>
              <ProductSelect
                onSelect={(productId) => setSuggestedProductId(productId)}
                selectedId={suggestedProductId}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="suggestResponse">Message (Optional)</Label>
              <Textarea
                id="suggestResponse"
                placeholder="Explain why this product is a good alternative..."
                value={suggestResponse}
                onChange={(e) => setSuggestResponse(e.target.value)}
                className="resize-none"
                rows={3}
              />
            </div>
            <Button
              onClick={handleSuggest}
              disabled={isSubmitting || !suggestedProductId}
              className="w-full"
            >
              {isSubmitting && <Loader2 className="mr-2 size-4 animate-spin" />}
              Suggest Alternative
            </Button>
          </TabsContent>
        </Tabs>

        <DialogFooter className="sm:justify-start">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setOpen(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
