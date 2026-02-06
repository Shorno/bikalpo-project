"use client";

import { Loader2, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { createItemRequest } from "@/actions/item-request/create-item-request";
import ImageUploader from "@/components/ImageUploader";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export interface RequestFormInitialValues {
  itemName?: string;
  brand?: string;
  category?: string;
  quantity?: number;
  image?: string;
}

interface RequestFormModalProps {
  onSuccess?: () => void;
  /** Controlled mode: parent controls open state. No default trigger. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Pre-fill form when modal opens (e.g. when requesting an out-of-stock product). */
  initialValues?: RequestFormInitialValues;
}

export function RequestFormModal({
  onSuccess,
  open: controlledOpen,
  onOpenChange,
  initialValues,
}: RequestFormModalProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined && onOpenChange != null;
  const isOpen = isControlled ? controlledOpen : internalOpen;
  const setIsOpen = isControlled
    ? (v: boolean) => onOpenChange!(v)
    : setInternalOpen;

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [itemName, setItemName] = useState("");
  const [brand, setBrand] = useState("");
  const [category, setCategory] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [description, setDescription] = useState("");
  const [image, setImage] = useState("");
  const [error, setError] = useState("");

  const resetForm = () => {
    setItemName("");
    setBrand("");
    setCategory("");
    setQuantity(1);
    setDescription("");
    setImage("");
    setError("");
  };

  // Pre-fill when opened with initialValues (e.g. out-of-stock product)
  useEffect(() => {
    if (!isOpen) return;
    if (initialValues) {
      setItemName(initialValues.itemName ?? "");
      setBrand(initialValues.brand ?? "");
      setCategory(initialValues.category ?? "");
      setQuantity(initialValues.quantity ?? 1);
      setImage(initialValues.image ?? "");
    }
  }, [isOpen, initialValues]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (itemName.length < 2) {
      setError("Item name must be at least 2 characters");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const result = await createItemRequest({
        itemName,
        brand: brand || undefined,
        category: category || undefined,
        quantity,
        description: description || undefined,
        image: image || undefined,
      });

      if (result.success) {
        toast.success("Request submitted!", {
          description: "We'll review your request and get back to you soon.",
        });
        resetForm();
        setIsOpen(false);
        onSuccess?.();
      } else {
        toast.error("Failed to submit request", {
          description: result.error,
        });
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(next) => {
        setIsOpen(next);
        if (!next) resetForm();
      }}
    >
      {!isControlled && (
        <DialogTrigger asChild>
          <Button className="bg-emerald-600 hover:bg-emerald-700">
            <Plus className="mr-2 size-4" />
            Request New Item
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Request a New Item</DialogTitle>
          <DialogDescription>
            Can't find a product? Let us know what you're looking for and we'll
            try to add it.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="itemName">Item Name *</Label>
            <Input
              id="itemName"
              placeholder="e.g., Premium Olive Oil 5L"
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              required
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="brand">Brand</Label>
              <Input
                id="brand"
                placeholder="e.g., Bertolli"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="quantity">Quantity Needed</Label>
              <Input
                id="quantity"
                type="number"
                min={1}
                placeholder="1"
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value) || 1)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <Input
              id="category"
              placeholder="e.g., Cooking Oil"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Additional Details</Label>
            <Textarea
              id="description"
              placeholder="Any specific requirements, packaging preferences, or other details..."
              className="resize-none"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Reference Image (Optional)</Label>
            <p className="text-sm text-muted-foreground mb-2">
              Upload an image of the product to help us identify it
            </p>
            <ImageUploader
              value={image}
              onChange={setImage}
              folder="item-requests"
              maxSizeMB={5}
              disabled={isSubmitting}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {isSubmitting && <Loader2 className="mr-2 size-4 animate-spin" />}
              Submit Request
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
