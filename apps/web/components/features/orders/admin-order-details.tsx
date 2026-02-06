"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  ArrowLeft,
  Ban,
  CheckCircle,
  Loader2,
  MapPin,
  Minus,
  Package,
  Phone,
  Plus,
  Trash2,
  User,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import {
  approveOrder,
  getOrderById,
  rejectOrder,
  updateOrderItems,
} from "@/actions/order/admin-order-actions";
import { ItemReplacePicker } from "@/components/features/orders/item-replace-picker";
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
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { ADMIN_BASE } from "@/lib/routes";

interface EditableItem {
  itemId: number;
  productId: number;
  productName: string;
  productImage: string;
  productSize: string;
  quantity: number;
  unitPrice: number;
  remove?: boolean;
  replaced?: boolean; // true if this item was replaced
  originalProductName?: string; // original product name before replacement
}

function formatPrice(price: string | number) {
  return `৳${Number(price).toLocaleString()}`;
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-96 w-full" />
    </div>
  );
}

export default function AdminOrderDetailsClient({
  orderId,
}: {
  orderId: number;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [rejectionReason, setRejectionReason] = React.useState("");
  const [isRejectDialogOpen, setIsRejectDialogOpen] = React.useState(false);
  const [isEditMode, setIsEditMode] = React.useState(false);
  const [editableItems, setEditableItems] = React.useState<EditableItem[]>([]);
  const [editNote, setEditNote] = React.useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-order", orderId],
    queryFn: async () => {
      const result = await getOrderById(orderId);
      if (!result.success || !result.order) {
        throw new Error(result.error || "Order not found");
      }
      return result.order;
    },
  });

  const approveMutation = useMutation({
    mutationFn: () => approveOrder(orderId),
    onSuccess: (result) => {
      if (result.success) {
        toast.success("Order approved successfully");
        queryClient.invalidateQueries({ queryKey: ["admin-order", orderId] });
        queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
        router.push(`${ADMIN_BASE}/orders`);
      } else {
        toast.error(result.error || "Failed to approve order");
      }
    },
    onError: () => {
      toast.error("Failed to approve order");
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (reason: string) => rejectOrder(orderId, reason),
    onSuccess: (result) => {
      if (result.success) {
        toast.success("Order rejected");
        setIsRejectDialogOpen(false);
        setRejectionReason("");
        queryClient.invalidateQueries({ queryKey: ["admin-order", orderId] });
        queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
        router.push(`${ADMIN_BASE}/orders`);
      } else {
        toast.error(result.error || "Failed to reject order");
      }
    },
    onError: () => {
      toast.error("Failed to reject order");
    },
  });

  const updateMutation = useMutation({
    mutationFn: () => {
      const updates = editableItems.map((item) => ({
        itemId: item.itemId,
        productId: item.productId,
        quantity: item.quantity,
        remove: item.remove,
      }));
      return updateOrderItems(orderId, updates, editNote || undefined);
    },
    onSuccess: (result) => {
      if (result.success) {
        toast.success("Order updated successfully");
        setIsEditMode(false);
        setEditNote("");
        queryClient.invalidateQueries({ queryKey: ["admin-order", orderId] });
        queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      } else {
        toast.error(result.error || "Failed to update order");
      }
    },
    onError: () => {
      toast.error("Failed to update order");
    },
  });

  const enterEditMode = () => {
    if (data) {
      setEditableItems(
        data.items.map((item) => ({
          itemId: item.id,
          productId: item.productId,
          productName: item.productName,
          productImage: item.productImage,
          productSize: item.productSize,
          quantity: item.quantity,
          unitPrice: Number(item.unitPrice),
          remove: false,
        })),
      );
      setIsEditMode(true);
    }
  };

  const cancelEdit = () => {
    setIsEditMode(false);
    setEditableItems([]);
    setEditNote("");
  };

  const updateQuantity = (itemId: number, delta: number) => {
    setEditableItems((prev) =>
      prev.map((item) =>
        item.itemId === itemId
          ? { ...item, quantity: Math.max(1, item.quantity + delta) }
          : item,
      ),
    );
  };

  const toggleRemoveItem = (itemId: number) => {
    setEditableItems((prev) =>
      prev.map((item) =>
        item.itemId === itemId ? { ...item, remove: !item.remove } : item,
      ),
    );
  };

  const replaceItem = (
    itemId: number,
    newProduct: {
      id: number;
      name: string;
      image: string;
      size: string;
      price: string;
    },
  ) => {
    setEditableItems((prev) =>
      prev.map((item) =>
        item.itemId === itemId
          ? {
              ...item,
              productId: newProduct.id,
              productName: newProduct.name,
              productImage: newProduct.image,
              productSize: newProduct.size,
              unitPrice: Number(newProduct.price),
              replaced: true,
              originalProductName: item.originalProductName || item.productName,
            }
          : item,
      ),
    );
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <LoadingSkeleton />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6 text-center">
        <p className="text-muted-foreground">Order not found</p>
        <Button variant="link" onClick={() => router.back()}>
          Go back
        </Button>
      </div>
    );
  }

  const order = data;
  const isPending = order.status === "pending";

  // Calculate totals for edit mode
  const editSubtotal = editableItems
    .filter((item) => !item.remove)
    .reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const editTotal =
    editSubtotal - Number(order.discount) + Number(order.shippingCost);

  return (
    <div className="flex flex-col gap-6">
      {/* Header Row */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="shrink-0" asChild>
            <Link href={`${ADMIN_BASE}/orders`}>
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-xl font-semibold">{order.orderNumber}</h1>
            <p className="text-sm text-muted-foreground">
              {format(new Date(order.createdAt), "MMM d, yyyy 'at' h:mm a")}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        {isPending && !isEditMode && (
          <div className="flex flex-wrap items-center gap-2 shrink-0 self-end sm:self-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={enterEditMode}
              className="w-full sm:w-auto order-last sm:order-first"
            >
              Suggest Alternatives
            </Button>

            <AlertDialog
              open={isRejectDialogOpen}
              onOpenChange={setIsRejectDialogOpen}
            >
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-red-600 border-red-200 hover:bg-red-50"
                  disabled={rejectMutation.isPending}
                >
                  {rejectMutation.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Ban className="size-4 mr-1.5" />
                  )}
                  Reject
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Reject Order?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will cancel the order and restore stock.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <Textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Reason for rejection..."
                  rows={2}
                  className="mt-2"
                />
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => rejectMutation.mutate(rejectionReason)}
                    disabled={!rejectionReason.trim()}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    Reject
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700"
                  disabled={approveMutation.isPending}
                >
                  {approveMutation.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <CheckCircle className="size-4 mr-1.5" />
                  )}
                  Approve
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Approve Order?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will confirm the order and generate an invoice.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => approveMutation.mutate()}
                    className="bg-emerald-600 hover:bg-emerald-700"
                  >
                    Approve
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}

        {/* Edit Mode Actions */}
        {isEditMode && (
          <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
            <Button variant="outline" size="sm" onClick={cancelEdit}>
              <X className="size-4 mr-1.5" />
              Cancel
            </Button>
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={() => updateMutation.mutate()}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? (
                <Loader2 className="size-4 animate-spin mr-1.5" />
              ) : (
                <CheckCircle className="size-4 mr-1.5" />
              )}
              Save Changes
            </Button>
          </div>
        )}
      </div>

      {/* Customer & Delivery Info */}
      <div className="border rounded-lg overflow-hidden text-sm">
        <div className="bg-muted/50 px-4 py-2.5 border-b">
          <span className="font-medium">Customer & Delivery</span>
        </div>
        <div className="grid sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x">
          {/* Left - Customer Info */}
          <div className="p-4 space-y-2">
            <div className="flex items-center gap-2">
              <User className="size-4 text-muted-foreground shrink-0" />
              <span className="font-medium">{order.user?.name}</span>
              {order.user?.shopName && (
                <span className="text-muted-foreground">
                  • {order.user.shopName}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Phone className="size-4 text-muted-foreground shrink-0" />
              <span>{order.shippingPhone}</span>
            </div>
          </div>
          {/* Right - Delivery Info */}
          <div className="p-4 space-y-2">
            <div className="flex items-start gap-2">
              <MapPin className="size-4 text-muted-foreground shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">{order.shippingName}</p>
                <p className="text-muted-foreground">
                  {order.shippingAddress}
                  {order.shippingArea && `, ${order.shippingArea}`}
                </p>
                <p className="text-muted-foreground">
                  {order.shippingCity}
                  {order.shippingPostalCode && ` - ${order.shippingPostalCode}`}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Order Items */}
      <div className="border rounded-lg overflow-hidden">
        <div className="bg-muted/50 px-4 py-2.5 flex items-center gap-2 border-b">
          <Package className="size-4" />
          <span className="font-medium text-sm">
            Order Items (
            {isEditMode
              ? editableItems.filter((i) => !i.remove).length
              : order.items.length}
            )
          </span>
        </div>

        {/* View Mode */}
        {!isEditMode && (
          <div className="divide-y">
            {order.items.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 p-3 hover:bg-muted/30 transition-colors"
              >
                {item.productImage && (
                  <Image
                    src={item.productImage}
                    alt={item.productName}
                    width={40}
                    height={40}
                    className="rounded object-cover shrink-0"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">
                    {item.productName}
                  </p>
                  {item.productSize && item.productSize !== "N/A" && (
                    <p className="text-xs text-muted-foreground">
                      {item.productSize}
                    </p>
                  )}
                </div>
                <div className="text-right text-sm shrink-0">
                  <p className="text-muted-foreground">
                    {item.quantity} × {formatPrice(item.unitPrice)}
                  </p>
                  <p className="font-medium">{formatPrice(item.totalPrice)}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Edit Mode */}
        {isEditMode && (
          <div className="divide-y">
            {editableItems.map((item) => (
              <div
                key={item.itemId}
                className={`flex items-center gap-3 p-3 transition-colors ${item.remove ? "bg-red-50 opacity-50" : "hover:bg-muted/30"}`}
              >
                {item.productImage && (
                  <Image
                    src={item.productImage}
                    alt={item.productName}
                    width={40}
                    height={40}
                    className="rounded object-cover shrink-0"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p
                    className={`font-medium text-sm truncate ${item.remove ? "line-through" : ""}`}
                  >
                    {item.productName}
                  </p>
                  {item.replaced && item.originalProductName && (
                    <p className="text-xs text-amber-600">
                      Replaces: {item.originalProductName}
                    </p>
                  )}
                  {item.productSize &&
                    item.productSize !== "N/A" &&
                    !item.replaced && (
                      <p className="text-xs text-muted-foreground">
                        {item.productSize}
                      </p>
                    )}
                </div>

                {/* Quantity Controls */}
                {!item.remove && (
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => updateQuantity(item.itemId, -1)}
                      disabled={item.quantity <= 1}
                    >
                      <Minus className="size-3" />
                    </Button>
                    <Input
                      type="number"
                      value={item.quantity}
                      onChange={(e) => {
                        const val = Number.parseInt(e.target.value, 10) || 1;
                        setEditableItems((prev) =>
                          prev.map((i) =>
                            i.itemId === item.itemId
                              ? { ...i, quantity: Math.max(1, val) }
                              : i,
                          ),
                        );
                      }}
                      className="w-14 h-7 text-center text-sm"
                      min={1}
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => updateQuantity(item.itemId, 1)}
                    >
                      <Plus className="size-3" />
                    </Button>
                  </div>
                )}

                <div className="text-right text-sm shrink-0 w-24">
                  {!item.remove && (
                    <p className="font-medium">
                      {formatPrice(item.unitPrice * item.quantity)}
                    </p>
                  )}
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  className={`h-7 w-7 ${item.remove ? "text-emerald-600" : "text-red-600"}`}
                  onClick={() => toggleRemoveItem(item.itemId)}
                >
                  {item.remove ? (
                    <Plus className="size-4" />
                  ) : (
                    <Trash2 className="size-4" />
                  )}
                </Button>

                {/* Replace Button */}
                {!item.remove && (
                  <ItemReplacePicker
                    onSelect={(product) => replaceItem(item.itemId, product)}
                    excludeProductId={item.productId}
                  />
                )}
              </div>
            ))}

            {/* Edit Note */}
            <div className="p-3">
              <Textarea
                value={editNote}
                onChange={(e) => setEditNote(e.target.value)}
                placeholder="Note about changes (optional)..."
                rows={2}
                className="text-sm"
              />
            </div>
          </div>
        )}

        {/* Price change (pending only) */}
        {isPending &&
          order.previousTotal != null &&
          Number(order.previousTotal) !== Number(order.total) && (
            <div className="bg-amber-50 border-t border-amber-100 px-4 py-3">
              <p className="text-sm font-medium text-amber-800">
                Price changed (customer notified)
              </p>
              <p className="text-sm text-amber-700 mt-0.5">
                Previous total: {formatPrice(order.previousTotal)} → New total:{" "}
                {formatPrice(order.total)}
              </p>
            </div>
          )}

        {/* Totals */}
        <div className="bg-muted/50 px-4 py-3 border-t space-y-1.5">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span>
              {formatPrice(isEditMode ? editSubtotal : order.subtotal)}
            </span>
          </div>
          {Number(order.discount) > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Discount</span>
              <span className="text-emerald-600">
                -{formatPrice(order.discount)}
              </span>
            </div>
          )}
          {Number(order.shippingCost) > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Shipping</span>
              <span>{formatPrice(order.shippingCost)}</span>
            </div>
          )}
          <Separator className="my-2" />
          <div className="flex justify-between font-semibold">
            <span>Total</span>
            <span>{formatPrice(isEditMode ? editTotal : order.total)}</span>
          </div>
        </div>
      </div>

      {/* Notes & Timeline Row */}
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Notes */}
        {(order.customerNote || order.adminNote) && (
          <div className="border rounded-lg p-4 space-y-3">
            <h3 className="font-medium text-sm">Notes</h3>
            {order.customerNote && (
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">
                  Customer Note
                </p>
                <p className="text-sm">{order.customerNote}</p>
              </div>
            )}
            {order.adminNote && (
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">
                  Admin Note
                </p>
                <p className="text-sm">{order.adminNote}</p>
              </div>
            )}
          </div>
        )}

        {/* Timeline */}
        <div className="border rounded-lg p-4">
          <h3 className="font-medium text-sm mb-3">Timeline</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Created</span>
              <span>{format(new Date(order.createdAt), "MMM d, h:mm a")}</span>
            </div>
            {order.adminModifiedAt && (
              <div className="flex justify-between text-amber-600">
                <span>Modified</span>
                <span>
                  {format(new Date(order.adminModifiedAt), "MMM d, h:mm a")}
                </span>
              </div>
            )}
            {order.confirmedAt && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Confirmed</span>
                <span>
                  {format(new Date(order.confirmedAt), "MMM d, h:mm a")}
                </span>
              </div>
            )}
            {order.shippedAt && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Shipped</span>
                <span>
                  {format(new Date(order.shippedAt), "MMM d, h:mm a")}
                </span>
              </div>
            )}
            {order.deliveredAt && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Delivered</span>
                <span>
                  {format(new Date(order.deliveredAt), "MMM d, h:mm a")}
                </span>
              </div>
            )}
            {order.cancelledAt && (
              <div className="flex justify-between text-red-600">
                <span>Cancelled</span>
                <span>
                  {format(new Date(order.cancelledAt), "MMM d, h:mm a")}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
