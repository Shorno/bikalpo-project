"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ArrowLeft, Camera, Loader2, Plus, Trash2, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { toast } from "sonner";
import { uploadImageToCloudinary } from "@/actions/cloudinary";
import {
  getOrderForReturn,
  submitReturnProcessing,
} from "@/actions/returns/return-processing";
import AdditionalImagesUploader from "@/components/AdditionalImagesUploader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { DELIVERY_BASE } from "@/lib/routes";
import {
  type ReturnProcessingFormValues,
  returnProcessingFormSchema,
} from "@/schema/return.schema";

interface ReturnProcessingFormProps {
  orderId: number;
}

const REASON_OPTIONS = [
  { value: "damaged", label: "Damaged" },
  { value: "wrong_item", label: "Wrong Item" },
  { value: "defective", label: "Defective" },
  { value: "expired", label: "Expired" },
  { value: "other", label: "Other" },
];

const CONDITION_OPTIONS = [
  { value: "good", label: "Good" },
  { value: "damaged", label: "Damaged" },
  { value: "opened", label: "Opened" },
  { value: "sealed", label: "Sealed" },
];

export function ReturnProcessingForm({ orderId }: ReturnProcessingFormProps) {
  const router = useRouter();

  // Fetch order data
  const { data: orderResult, isLoading: isLoadingOrder } = useQuery({
    queryKey: ["order-for-return", orderId],
    queryFn: () => getOrderForReturn(orderId),
  });

  const form = useForm<ReturnProcessingFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(returnProcessingFormSchema) as any,
    defaultValues: {
      orderId: orderId,
      returnedItems: [],
      refundType: "cash",
      additionalCharge: "0",
      notes: "",
      attachments: [],
      isDraft: false,
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "returnedItems",
  });

  const queryClient = useQueryClient();

  const submitMutation = useMutation({
    mutationFn: submitReturnProcessing,
    onSuccess: (result) => {
      if (result.success) {
        // Invalidate the cached order data so "available" quantity updates correctly
        queryClient.invalidateQueries({
          queryKey: ["order-for-return", orderId],
        });
        queryClient.invalidateQueries({ queryKey: ["order-for-return"] });
        toast.success("Return submitted successfully");
        router.push(`${DELIVERY_BASE}/returns`);
      } else {
        toast.error(result.error || "Failed to submit return");
      }
    },
    onError: () => {
      toast.error("Something went wrong");
    },
  });

  const onSubmit = (data: ReturnProcessingFormValues) => {
    submitMutation.mutate(data);
  };

  const handleSaveDraft = () => {
    const data = form.getValues();
    data.isDraft = true;
    submitMutation.mutate(data);
  };

  const handleAddProduct = (orderItem: any) => {
    // Check if already added
    const existing = fields.find((f) => f.orderItemId === orderItem.id);
    if (existing) {
      toast.error("Product already added to return list");
      return;
    }

    // Check if any quantity is available to return
    const availableToReturn = orderItem.availableToReturn ?? orderItem.quantity;
    if (availableToReturn <= 0) {
      toast.error("No available quantity to return for this item");
      return;
    }

    append({
      orderItemId: orderItem.id,
      productId: orderItem.productId,
      sku: `SKU-${orderItem.productId}`,
      productName: orderItem.productName,
      orderedQty: orderItem.quantity,
      deliveredQty: availableToReturn, // Available to return (after subtracting previous returns)
      unitPrice: orderItem.unitPrice,
      returnQty: 1,
      reason: "damaged",
      condition: "good",
    });
  };

  // Per-item photo upload
  const [uploadingItemIndex, setUploadingItemIndex] = React.useState<
    number | null
  >(null);

  const handleItemPhotoUpload = async (index: number) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      if (file.size > 5 * 1024 * 1024) {
        toast.error("Image must be less than 5MB");
        return;
      }

      setUploadingItemIndex(index);
      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("folder", "returns/items");

        const result = await uploadImageToCloudinary(formData);
        if (result.success) {
          form.setValue(`returnedItems.${index}.attachment`, result.url);
          toast.success("Photo uploaded");
        } else {
          toast.error(result.error || "Upload failed");
        }
      } catch {
        toast.error("Failed to upload photo");
      } finally {
        setUploadingItemIndex(null);
      }
    };
    input.click();
  };

  const removeItemPhoto = (index: number) => {
    form.setValue(`returnedItems.${index}.attachment`, undefined);
  };

  // Calculate totals
  const returnedItems = form.watch("returnedItems");
  const additionalCharge = form.watch("additionalCharge");

  const totalReturnedAmount = returnedItems.reduce((sum, item) => {
    return sum + (item.returnQty || 0) * Number(item.unitPrice || 0);
  }, 0);

  const payableAmount = totalReturnedAmount - Number(additionalCharge || 0);

  if (isLoadingOrder) {
    return (
      <div className="flex items-center justify-center h-40 sm:h-64">
        <Loader2 className="h-6 w-6 sm:h-8 sm:w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!orderResult?.success || !orderResult.order) {
    return (
      <div className="flex flex-col items-center justify-center h-40 sm:h-64 gap-3 sm:gap-4">
        <p className="text-sm text-muted-foreground">Order not found</p>
        <Button asChild variant="outline" size="sm">
          <Link href={`${DELIVERY_BASE}/returns`}>Back to Returns</Link>
        </Button>
      </div>
    );
  }

  const orderData = orderResult.order;

  return (
    <div className="flex flex-col gap-3 sm:gap-6">
      {/* Compact Header */}
      <div className="flex items-start gap-2 sm:gap-4">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 sm:h-9 sm:w-9 shrink-0 mt-0.5"
          asChild
        >
          <Link href={`${DELIVERY_BASE}/returns`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg sm:text-2xl font-bold tracking-tight">
            Return Processing
          </h1>
          <p className="text-[10px] sm:text-sm text-muted-foreground">
            Order: {orderData.orderNumber}
          </p>
        </div>
        {/* Desktop Action Buttons */}
        <div className="hidden sm:flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSaveDraft}
            disabled={submitMutation.isPending}
          >
            Save Draft
          </Button>
          <Button
            size="sm"
            onClick={form.handleSubmit(onSubmit)}
            disabled={submitMutation.isPending || fields.length === 0}
          >
            {submitMutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Submit
          </Button>
        </div>
      </div>

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="space-y-3 sm:space-y-6"
        >
          {/* Customer & Order Info - Compact */}
          <Card className="p-0">
            <CardContent className="p-3 sm:p-4">
              <p className="text-xs font-semibold text-muted-foreground mb-2 sm:mb-3 uppercase tracking-wide">
                Customer & Order Info
              </p>
              <div className="grid sm:grid-cols-2 gap-3 sm:gap-4">
                {/* Customer Info */}
                <div className="space-y-1.5 sm:space-y-2 text-xs sm:text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Customer</span>
                    <span className="font-medium">
                      {orderData.user?.name || "N/A"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Phone</span>
                    <span className="font-medium">
                      {orderData.user?.phoneNumber || "N/A"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Address</span>
                    <span className="font-medium text-right max-w-[60%] truncate">
                      {orderData.shippingAddress}, {orderData.shippingCity}
                    </span>
                  </div>
                </div>
                {/* Order Info */}
                <div className="space-y-1.5 sm:space-y-2 text-xs sm:text-sm border-t sm:border-t-0 sm:border-l pt-3 sm:pt-0 sm:pl-4">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Order ID</span>
                    <span className="font-medium">{orderData.orderNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Order Date</span>
                    <span className="font-medium">
                      {format(new Date(orderData.createdAt), "MMM d, yyyy")}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Payment</span>
                    <Badge variant="outline" className="capitalize text-[10px]">
                      {orderData.paymentStatus}
                    </Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Original Order Product List */}
          <Card className="p-0">
            <CardContent className="p-3 sm:p-4">
              <p className="text-xs font-semibold text-muted-foreground mb-2 sm:mb-3 uppercase tracking-wide">
                Order Products
              </p>

              {/* Mobile: Card View */}
              <div className="sm:hidden space-y-2">
                {orderData.items.map((item: any, index: number) => {
                  const isAdded = fields.some((f) => f.orderItemId === item.id);
                  const returnedQty = item.returnedQty ?? 0;
                  const availableToReturn =
                    item.availableToReturn ?? item.quantity;
                  const isFullyReturned = availableToReturn <= 0;
                  return (
                    <div
                      key={item.id}
                      className={`border rounded-lg p-2.5 space-y-2 ${isFullyReturned ? "opacity-60 bg-muted/30" : ""}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">
                            {item.productName}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            SKU-{item.productId}
                          </p>
                        </div>
                        <p className="text-sm font-semibold shrink-0">
                          ৳{Number(item.totalPrice).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex gap-2 text-xs">
                        <span className="text-muted-foreground">
                          Ordered:{" "}
                          <span className="font-medium text-foreground">
                            {item.quantity}
                          </span>
                        </span>
                        {returnedQty > 0 && (
                          <span className="text-amber-600">
                            Returned:{" "}
                            <span className="font-medium">{returnedQty}</span>
                          </span>
                        )}
                        <span className="text-green-600">
                          Available:{" "}
                          <span className="font-medium">
                            {availableToReturn}
                          </span>
                        </span>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant={
                          isAdded
                            ? "secondary"
                            : isFullyReturned
                              ? "ghost"
                              : "outline"
                        }
                        className="w-full h-7 text-xs"
                        onClick={() => handleAddProduct(item)}
                        disabled={isAdded || isFullyReturned}
                      >
                        {isAdded ? (
                          "Added"
                        ) : isFullyReturned ? (
                          "Fully Returned"
                        ) : (
                          <>
                            <Plus className="h-3 w-3 mr-1" />
                            Add to Return
                          </>
                        )}
                      </Button>
                    </div>
                  );
                })}
              </div>

              {/* Desktop: Table View */}
              <div className="hidden sm:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">#</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead className="text-center">Ordered</TableHead>
                      <TableHead className="text-center">Returned</TableHead>
                      <TableHead className="text-center">Available</TableHead>
                      <TableHead className="text-right">Price</TableHead>
                      <TableHead className="w-24"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orderData.items.map((item: any, index: number) => {
                      const returnedQty = item.returnedQty ?? 0;
                      const availableToReturn =
                        item.availableToReturn ?? item.quantity;
                      const isFullyReturned = availableToReturn <= 0;
                      const isAdded = fields.some(
                        (f) => f.orderItemId === item.id,
                      );
                      return (
                        <TableRow
                          key={item.id}
                          className={
                            isFullyReturned ? "opacity-60 bg-muted/30" : ""
                          }
                        >
                          <TableCell className="text-muted-foreground">
                            {index + 1}
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{item.productName}</p>
                              <p className="text-xs text-muted-foreground">
                                SKU-{item.productId} • ৳
                                {Number(item.unitPrice).toLocaleString()}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            {item.quantity}
                          </TableCell>
                          <TableCell className="text-center">
                            {returnedQty > 0 ? (
                              <span className="text-amber-600 font-medium">
                                {returnedQty}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">0</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            <span
                              className={
                                availableToReturn > 0
                                  ? "text-green-600 font-medium"
                                  : "text-muted-foreground"
                              }
                            >
                              {availableToReturn}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            ৳{Number(item.unitPrice).toLocaleString()}
                          </TableCell>
                          <TableCell>
                            <Button
                              type="button"
                              size="sm"
                              variant={isFullyReturned ? "ghost" : "outline"}
                              className="h-7 text-xs"
                              onClick={() => handleAddProduct(item)}
                              disabled={isAdded || isFullyReturned}
                            >
                              {isAdded ? (
                                "Added"
                              ) : isFullyReturned ? (
                                "—"
                              ) : (
                                <>
                                  <Plus className="h-3 w-3 mr-1" />
                                  Add
                                </>
                              )}
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Returned Product List */}
          <Card className="p-0">
            <CardContent className="p-3 sm:p-4">
              <p className="text-xs font-semibold text-muted-foreground mb-2 sm:mb-3 uppercase tracking-wide">
                Return Items ({fields.length})
              </p>

              {fields.length === 0 ? (
                <div className="text-center py-6 sm:py-8 text-muted-foreground border rounded-lg bg-muted/30">
                  <p className="text-sm">No products added to return</p>
                  <p className="text-xs mt-1">Click "Add" on products above</p>
                </div>
              ) : (
                <>
                  {/* Mobile: Card View */}
                  <div className="sm:hidden space-y-2">
                    {fields.map((field, index) => (
                      <div
                        key={field.id}
                        className="border rounded-lg p-2.5 space-y-2"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">
                              {field.productName}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              {field.sku}
                            </p>
                          </div>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-destructive shrink-0"
                            onClick={() => remove(index)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                          <FormField
                            control={form.control}
                            name={`returnedItems.${index}.returnQty`}
                            render={({ field: inputField }) => (
                              <FormItem>
                                <FormLabel className="text-[10px]">
                                  Qty
                                </FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    min={1}
                                    max={field.orderedQty}
                                    className="h-8 text-sm"
                                    {...inputField}
                                    onChange={(e) =>
                                      inputField.onChange(
                                        parseInt(e.target.value, 10) || 1,
                                      )
                                    }
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name={`returnedItems.${index}.reason`}
                            render={({ field: selectField }) => (
                              <FormItem>
                                <FormLabel className="text-[10px]">
                                  Reason
                                </FormLabel>
                                <Select
                                  value={selectField.value}
                                  onValueChange={selectField.onChange}
                                >
                                  <FormControl>
                                    <SelectTrigger className="h-8 text-xs">
                                      <SelectValue />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {REASON_OPTIONS.map((opt) => (
                                      <SelectItem
                                        key={opt.value}
                                        value={opt.value}
                                      >
                                        {opt.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name={`returnedItems.${index}.condition`}
                            render={({ field: selectField }) => (
                              <FormItem>
                                <FormLabel className="text-[10px]">
                                  Condition
                                </FormLabel>
                                <Select
                                  value={selectField.value}
                                  onValueChange={selectField.onChange}
                                >
                                  <FormControl>
                                    <SelectTrigger className="h-8 text-xs">
                                      <SelectValue />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {CONDITION_OPTIONS.map((opt) => (
                                      <SelectItem
                                        key={opt.value}
                                        value={opt.value}
                                      >
                                        {opt.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </FormItem>
                            )}
                          />
                        </div>

                        {/* Photo upload for this item */}
                        <div className="flex items-center gap-2 pt-1">
                          {returnedItems[index]?.attachment ? (
                            <div className="relative w-12 h-12 rounded bg-accent mr-1 mt-1">
                              <Image
                                width={200}
                                height={200}
                                src={returnedItems[index].attachment}
                                alt="Proof"
                                className="w-full h-full object-cover rounded"
                              />
                              <button
                                type="button"
                                onClick={() => removeItemPhoto(index)}
                                className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center shadow-sm"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ) : (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => handleItemPhotoUpload(index)}
                              disabled={uploadingItemIndex === index}
                            >
                              {uploadingItemIndex === index ? (
                                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                              ) : (
                                <Camera className="w-3 h-3 mr-1" />
                              )}
                              Add Photo
                            </Button>
                          )}
                        </div>

                        <div className="flex justify-between items-center text-xs pt-1 border-t">
                          <span className="text-muted-foreground">
                            Subtotal
                          </span>
                          <span className="font-semibold">
                            ৳
                            {(
                              (returnedItems[index]?.returnQty || 0) *
                              Number(field.unitPrice)
                            ).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Desktop: Table View */}
                  <div className="hidden sm:block">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-10">#</TableHead>
                          <TableHead>Product</TableHead>
                          <TableHead className="w-20">Qty</TableHead>
                          <TableHead className="w-28">Reason</TableHead>
                          <TableHead className="w-24">Condition</TableHead>
                          <TableHead className="w-20">Photo</TableHead>
                          <TableHead className="text-right">Subtotal</TableHead>
                          <TableHead className="w-12"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {fields.map((field, index) => (
                          <TableRow key={field.id}>
                            <TableCell className="text-muted-foreground">
                              {index + 1}
                            </TableCell>
                            <TableCell>
                              <div>
                                <p className="font-medium">
                                  {field.productName}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {field.sku}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <FormField
                                control={form.control}
                                name={`returnedItems.${index}.returnQty`}
                                render={({ field: inputField }) => (
                                  <FormItem>
                                    <FormControl>
                                      <Input
                                        type="number"
                                        min={1}
                                        max={field.orderedQty}
                                        className="h-8 w-16"
                                        {...inputField}
                                        onChange={(e) =>
                                          inputField.onChange(
                                            parseInt(e.target.value, 10) || 1,
                                          )
                                        }
                                      />
                                    </FormControl>
                                  </FormItem>
                                )}
                              />
                            </TableCell>
                            <TableCell>
                              <FormField
                                control={form.control}
                                name={`returnedItems.${index}.reason`}
                                render={({ field: selectField }) => (
                                  <FormItem>
                                    <Select
                                      value={selectField.value}
                                      onValueChange={selectField.onChange}
                                    >
                                      <FormControl>
                                        <SelectTrigger className="h-8">
                                          <SelectValue />
                                        </SelectTrigger>
                                      </FormControl>
                                      <SelectContent>
                                        {REASON_OPTIONS.map((opt) => (
                                          <SelectItem
                                            key={opt.value}
                                            value={opt.value}
                                          >
                                            {opt.label}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </FormItem>
                                )}
                              />
                            </TableCell>
                            <TableCell>
                              <FormField
                                control={form.control}
                                name={`returnedItems.${index}.condition`}
                                render={({ field: selectField }) => (
                                  <FormItem>
                                    <Select
                                      value={selectField.value}
                                      onValueChange={selectField.onChange}
                                    >
                                      <FormControl>
                                        <SelectTrigger className="h-8">
                                          <SelectValue />
                                        </SelectTrigger>
                                      </FormControl>
                                      <SelectContent>
                                        {CONDITION_OPTIONS.map((opt) => (
                                          <SelectItem
                                            key={opt.value}
                                            value={opt.value}
                                          >
                                            {opt.label}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </FormItem>
                                )}
                              />
                            </TableCell>
                            <TableCell>
                              {returnedItems[index]?.attachment ? (
                                <div className="relative w-10 h-10 rounded bg-accent m-0.5">
                                  <Image
                                    src={returnedItems[index].attachment}
                                    alt="Proof"
                                    className="w-full h-full object-cover rounded"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => removeItemPhoto(index)}
                                    className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center shadow-sm"
                                  >
                                    <X className="w-2.5 h-2.5" />
                                  </button>
                                </div>
                              ) : (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-8 text-xs"
                                  onClick={() => handleItemPhotoUpload(index)}
                                  disabled={uploadingItemIndex === index}
                                >
                                  {uploadingItemIndex === index ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <Camera className="w-3 h-3" />
                                  )}
                                </Button>
                              )}
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              ৳
                              {(
                                (returnedItems[index]?.returnQty || 0) *
                                Number(field.unitPrice)
                              ).toLocaleString()}
                            </TableCell>
                            <TableCell>
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-destructive"
                                onClick={() => remove(index)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
              <FormMessage>
                {form.formState.errors.returnedItems?.message}
              </FormMessage>
            </CardContent>
          </Card>

          {/* Return Summary */}
          <Card className="p-0">
            <CardContent className="p-3 sm:p-4">
              <p className="text-xs font-semibold text-muted-foreground mb-2 sm:mb-3 uppercase tracking-wide">
                Return Summary
              </p>

              <div className="grid sm:grid-cols-2 gap-4 sm:gap-6">
                <div className="space-y-3">
                  {/* Totals */}
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        Total Return Amount
                      </span>
                      <span className="font-medium">
                        ৳{totalReturnedAmount.toLocaleString()}
                      </span>
                    </div>
                    <FormField
                      control={form.control}
                      name="additionalCharge"
                      render={({ field }) => (
                        <FormItem>
                          <div className="flex justify-between items-center">
                            <FormLabel className="text-sm text-muted-foreground">
                              Additional Charge
                            </FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min="0"
                                className="w-24 sm:w-28 h-8 text-sm"
                                {...field}
                              />
                            </FormControl>
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="flex justify-between pt-2 border-t">
                      <span className="font-medium">Payable Amount</span>
                      <span className="font-bold text-base sm:text-lg text-primary">
                        ৳{payableAmount.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {/* Refund Type */}
                  <FormField
                    control={form.control}
                    name="refundType"
                    render={({ field }) => (
                      <FormItem className="space-y-2">
                        <FormLabel className="text-xs font-semibold text-muted-foreground uppercase">
                          Refund Type
                        </FormLabel>
                        <FormControl>
                          <RadioGroup
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                            className="flex flex-wrap gap-3"
                          >
                            <div className="flex items-center space-x-1.5">
                              <RadioGroupItem
                                value="cash"
                                id="cash"
                                className="h-4 w-4"
                              />
                              <Label htmlFor="cash" className="text-sm">
                                Cash
                              </Label>
                            </div>
                            <div className="flex items-center space-x-1.5">
                              <RadioGroupItem
                                value="wallet"
                                id="wallet"
                                className="h-4 w-4"
                              />
                              <Label htmlFor="wallet" className="text-sm">
                                Wallet
                              </Label>
                            </div>
                            <div className="flex items-center space-x-1.5">
                              <RadioGroupItem
                                value="adjustment"
                                id="adjustment"
                                className="h-4 w-4"
                              />
                              <Label htmlFor="adjustment" className="text-sm">
                                Adjustment
                              </Label>
                            </div>
                          </RadioGroup>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Notes */}
                <div>
                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-semibold text-muted-foreground uppercase">
                          Notes
                        </FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Additional notes..."
                            className="min-h-[100px] sm:min-h-[120px] text-sm"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Attachments */}
          <Card className="p-0">
            <CardContent className="p-3 sm:p-4">
              <p className="text-xs font-semibold text-muted-foreground mb-2 sm:mb-3 uppercase tracking-wide">
                Attachments
              </p>
              <FormField
                control={form.control}
                name="attachments"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <AdditionalImagesUploader
                        value={field.value || []}
                        onChange={field.onChange}
                        folder="returns"
                        maxFiles={10}
                        maxSizeMB={5}
                        hideTitle
                        compact
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Mobile: Fixed Bottom Action Buttons */}
          <div className="sm:hidden fixed bottom-0 left-0 right-0 p-3 bg-background border-t shadow-lg z-50">
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1 h-10"
                onClick={handleSaveDraft}
                disabled={submitMutation.isPending}
              >
                Save Draft
              </Button>
              <Button
                type="submit"
                className="flex-1 h-10"
                disabled={submitMutation.isPending || fields.length === 0}
              >
                {submitMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Submit Return
              </Button>
            </div>
          </div>

          {/* Desktop: Footer Actions */}
          <div className="hidden sm:flex justify-end gap-3 pb-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleSaveDraft}
              disabled={submitMutation.isPending}
            >
              Save Draft
            </Button>
            <Button
              type="submit"
              disabled={submitMutation.isPending || fields.length === 0}
            >
              {submitMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Submit Return
            </Button>
          </div>

          {/* Spacer for mobile fixed bottom bar */}
          <div className="sm:hidden h-16" />
        </form>
      </Form>
    </div>
  );
}
