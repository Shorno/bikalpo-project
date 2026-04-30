"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Minus,
  Plus,
  Package,
  Truck,
  ShoppingCart,
  CheckCircle2,
  Calculator,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { client } from "@/utils/orpc";

interface OrderProduct {
  inventoryId: number;
  variantId: number;
  productName: string;
  unit: string;
  pricePerUnit: string;
  availableQty: number;
  moq: number;
  weightKg?: number;
  innerPackSizeKg?: number;
  packType?: string;
}

interface WarehouseOrderDialogProps {
  product: OrderProduct | null;
  warehouseSlug: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function calcPackBreakdown(
  qty: number,
  weightKg: number,
  innerPackSizeKg: number,
  packType: string
) {
  if (weightKg <= 0 || qty <= 0) return null;
  const totalWeight = qty * weightKg;

  if (innerPackSizeKg > 0) {
    const piecesPerUnit = Math.floor(weightKg / innerPackSizeKg);
    const totalPieces = qty * piecesPerUnit;
    return {
      label: `${totalWeight}kg (${innerPackSizeKg}kg × ${totalPieces} pcs) — ${qty} ${packType}`,
      totalWeight,
      totalPieces,
      piecesPerUnit,
    };
  }

  return {
    label: `${totalWeight}kg — ${qty} ${packType || "unit"}`,
    totalWeight,
    totalPieces: qty,
    piecesPerUnit: 1,
  };
}

export function WarehouseOrderDialog({
  product,
  warehouseSlug,
  open,
  onOpenChange,
}: WarehouseOrderDialogProps) {
  const [quantity, setQuantity] = useState(1);
  const [step, setStep] = useState<"quantity" | "shipping" | "success">("quantity");

  // Shipping form
  const [shippingName, setShippingName] = useState("");
  const [shippingPhone, setShippingPhone] = useState("");
  const [shippingAddress, setShippingAddress] = useState("");
  const [shippingCity, setShippingCity] = useState("");
  const [customerNote, setCustomerNote] = useState("");

  const orderMutation = useMutation({
    mutationFn: (input: any) => client.shopOwner.placeWarehouseOrder(input),
    onSuccess: (data: any) => {
      setStep("success");
      toast.success(data.message || "Order placed successfully!");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to place order");
    },
  });

  if (!product) return null;

  const moq = product.moq || 1;
  const maxQty = product.availableQty;
  const unitPrice = Number(product.pricePerUnit) || 0;
  const totalPrice = (unitPrice * quantity).toFixed(2);

  const breakdown = calcPackBreakdown(
    quantity,
    product.weightKg || 0,
    product.innerPackSizeKg || 0,
    product.packType || product.unit
  );

  const handleQuantityChange = (delta: number) => {
    setQuantity((prev) => Math.max(moq, Math.min(maxQty, prev + delta)));
  };

  const handlePlaceOrder = () => {
    if (!shippingName || !shippingPhone || !shippingAddress || !shippingCity) {
      toast.error("Please fill in all shipping details");
      return;
    }

    const isLoose = (product.packType || "").toLowerCase() === "loose";

    orderMutation.mutate({
      warehouseSlug,
      items: [{
        variantId: product.variantId,
        quantity,
        supplyMode: isLoose ? "loose" as const : "pack" as const,
        targetVariantId: isLoose ? undefined : product.variantId,
      }],
      shippingName,
      shippingPhone,
      shippingAddress,
      shippingCity,
      customerNote: customerNote || undefined,
      paymentMethod: "cash_on_delivery" as const,
    });
  };

  const handleClose = () => {
    setStep("quantity");
    setQuantity(moq);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        {step === "success" ? (
          /* ───── SUCCESS ───── */
          <div className="text-center py-6 space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">Order Placed!</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Your order has been sent to the warehouse for processing.
              </p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 text-left space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Product</span>
                <span className="font-medium">{product.productName}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Quantity</span>
                <span className="font-medium">
                  {quantity} {product.unit}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total</span>
                <span className="font-bold text-gray-900">৳ {totalPrice}</span>
              </div>
            </div>
            <Button onClick={handleClose} className="w-full">
              Done
            </Button>
          </div>
        ) : step === "shipping" ? (
          /* ───── SHIPPING ───── */
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Truck className="w-5 h-5 text-blue-600" />
                Shipping Details
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-3 mt-2">
              {/* Order Summary Bar */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex justify-between items-center">
                <div>
                  <p className="text-xs text-blue-600 font-medium">Order Summary</p>
                  <p className="text-sm font-semibold text-gray-900">
                    {quantity} × {product.unit} — {product.productName}
                  </p>
                </div>
                <p className="text-lg font-bold text-blue-700">৳ {totalPrice}</p>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">
                  Full Name *
                </label>
                <Input
                  value={shippingName}
                  onChange={(e) => setShippingName(e.target.value)}
                  placeholder="Your shop name or contact name"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">
                  Phone *
                </label>
                <Input
                  value={shippingPhone}
                  onChange={(e) => setShippingPhone(e.target.value)}
                  placeholder="01XXXXXXXXX"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">
                  Delivery Address *
                </label>
                <Input
                  value={shippingAddress}
                  onChange={(e) => setShippingAddress(e.target.value)}
                  placeholder="Full address"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">
                  City *
                </label>
                <Input
                  value={shippingCity}
                  onChange={(e) => setShippingCity(e.target.value)}
                  placeholder="e.g. Dhaka"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">
                  Note (optional)
                </label>
                <Input
                  value={customerNote}
                  onChange={(e) => setCustomerNote(e.target.value)}
                  placeholder="Special instructions..."
                />
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setStep("quantity")}
                >
                  Back
                </Button>
                <Button
                  className="flex-1 bg-blue-600 hover:bg-blue-700 gap-1.5"
                  onClick={handlePlaceOrder}
                  disabled={orderMutation.isPending}
                >
                  {orderMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <ShoppingCart className="w-4 h-4" />
                  )}
                  Place Order
                </Button>
              </div>
            </div>
          </>
        ) : (
          /* ───── QUANTITY ───── */
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Package className="w-5 h-5 text-blue-600" />
                Order: {product.productName}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 mt-2">
              {/* Price info */}
              <div className="flex items-baseline justify-between">
                <div>
                  <span className="text-2xl font-bold text-gray-900">
                    ৳ {product.pricePerUnit}
                  </span>
                  <span className="text-sm text-gray-500 ml-1">/ {product.unit}</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {product.availableQty} {product.unit} available
                </span>
              </div>

              {/* Quantity selector */}
              <div>
                <label className="text-xs font-medium text-gray-700 mb-2 block">
                  Quantity ({product.unit})
                </label>
                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-10 w-10 shrink-0"
                    onClick={() => handleQuantityChange(-1)}
                    disabled={quantity <= moq}
                  >
                    <Minus className="w-4 h-4" />
                  </Button>
                  <Input
                    type="number"
                    value={quantity}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10);
                      if (!isNaN(v) && v >= moq && v <= maxQty) setQuantity(v);
                    }}
                    className="text-center text-lg font-bold h-10"
                    min={moq}
                    max={maxQty}
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-10 w-10 shrink-0"
                    onClick={() => handleQuantityChange(1)}
                    disabled={quantity >= maxQty}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Min: {moq} {product.unit} · Max: {maxQty} {product.unit}
                </p>
              </div>

              {/* Pack breakdown */}
              {breakdown && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Calculator className="w-3.5 h-3.5 text-amber-600" />
                    <span className="text-xs font-semibold text-amber-700">
                      Pack Breakdown
                    </span>
                  </div>
                  <p className="text-sm font-medium text-amber-900">
                    {breakdown.label}
                  </p>
                </div>
              )}

              {/* Total */}
              <div className="bg-gray-50 rounded-lg p-4 flex items-center justify-between">
                <span className="text-sm text-gray-600">Total Amount</span>
                <span className="text-xl font-bold text-gray-900">৳ {totalPrice}</span>
              </div>

              {/* Continue */}
              <Button
                className="w-full h-11 bg-blue-600 hover:bg-blue-700 gap-1.5"
                onClick={() => setStep("shipping")}
              >
                <Truck className="w-4 h-4" />
                Continue to Shipping
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
