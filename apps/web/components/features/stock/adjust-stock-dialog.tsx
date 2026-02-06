"use client";

import { History, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { adjustStockWithReason } from "@/actions/product/adjust-stock-with-reason";
import { StockChangeLogsSheet } from "@/components/features/stock/stock-change-logs-sheet";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface AdjustStockDialogProps {
  product: { id: number; name: string; stockQuantity: number };
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

type Mode = "add" | "reduce" | null;

export function AdjustStockDialog({
  product,
  open,
  onOpenChange,
  onSuccess,
}: AdjustStockDialogProps) {
  const [mode, setMode] = useState<Mode>(null);
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [logsOpen, setLogsOpen] = useState(false);

  const resetForm = () => {
    setMode(null);
    setQuantity("");
    setReason("");
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) resetForm();
    onOpenChange(next);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseInt(quantity, 10);
    if (Number.isNaN(num) || num < 1) {
      toast.error("Enter a valid quantity (1 or more)");
      return;
    }
    if (mode === "reduce" && num > product.stockQuantity) {
      toast.error("Quantity cannot exceed current stock");
      return;
    }
    if (!mode) return;

    setIsSubmitting(true);
    try {
      const result = await adjustStockWithReason(
        product.id,
        mode,
        num,
        reason.trim() || undefined,
      );
      if (result.success) {
        toast.success(mode === "add" ? "Stock added" : "Stock reduced");
        resetForm();
        onOpenChange(false);
        onSuccess?.();
      } else {
        toast.error(result.error || "Failed to update stock");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Adjust Stock</DialogTitle>
            <DialogDescription>
              Add or reduce stock for <strong>{product.name}</strong> (current:{" "}
              {product.stockQuantity})
            </DialogDescription>
          </DialogHeader>

          {!mode ? (
            <div className="flex flex-col gap-3 py-2">
              <Button
                type="button"
                variant="outline"
                className="justify-start"
                onClick={() => setMode("add")}
              >
                Add Stock
              </Button>
              <Button
                type="button"
                variant="outline"
                className="justify-start"
                onClick={() => setMode("reduce")}
              >
                Reduce Stock
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {mode === "add" ? "Add" : "Reduce"} stock
              </p>
              <div className="space-y-2">
                <Label htmlFor="qty">Quantity</Label>
                <Input
                  id="qty"
                  type="number"
                  min={1}
                  max={mode === "reduce" ? product.stockQuantity : undefined}
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  disabled={isSubmitting}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reason">Reason (optional)</Label>
                <Textarea
                  id="reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  disabled={isSubmitting}
                  placeholder="e.g. Restock from supplier"
                  rows={2}
                />
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={resetForm}
                  disabled={isSubmitting}
                >
                  Back
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && (
                    <Loader2 className="mr-2 size-4 animate-spin" />
                  )}
                  {mode === "add" ? "Add" : "Reduce"} Stock
                </Button>
              </DialogFooter>
            </form>
          )}

          <div className="border-t pt-3 mt-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-foreground"
              onClick={() => setLogsOpen(true)}
            >
              <History className="mr-2 size-4" />
              Stock Change Logs
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <StockChangeLogsSheet
        productId={product.id}
        productName={product.name}
        open={logsOpen}
        onOpenChange={setLogsOpen}
      />
    </>
  );
}
