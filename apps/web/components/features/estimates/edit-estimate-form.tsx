"use client";

import { useForm } from "@tanstack/react-form";
import { format } from "date-fns";
import { CalendarIcon, FileText, Loader2, Package, User } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { updateEstimate } from "@/actions/estimate/update-estimate";
import { CustomerSelect } from "@/components/features/estimates/customer-select";
import { EstimateItemsTable } from "@/components/features/estimates/estimate-items-table";
import { EstimateSummary } from "@/components/features/estimates/estimate-summary";
import { ProductPicker } from "@/components/features/estimates/product-picker";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { SALES_BASE } from "@/lib/routes";
import { cn } from "@/lib/utils";
import type { FormEstimateItem } from "@/types/estimate";

interface EditEstimateFormProps {
  estimate: any;
  isReadOnly?: boolean;
}

export function EditEstimateForm({
  estimate,
  isReadOnly = false,
}: EditEstimateFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [items, setItems] = useState<FormEstimateItem[]>(
    estimate.items.map((item: any) => ({
      productId: item.productId,
      productName: item.productName,
      productImage: item.productImage,
      quantity: Number(item.quantity),
      unitPrice: Number(item.unitPrice),
      discount: Number(item.discount),
      totalPrice: Number(item.totalPrice),
    })),
  );

  const form = useForm({
    defaultValues: {
      id: estimate.id as number,
      customerId: (estimate.customerId || "") as string,
      discount: Number(estimate.discount || 0),
      notes: (estimate.notes || "") as string | null,
      validUntil: estimate.validUntil
        ? new Date(estimate.validUntil)
        : (null as Date | null),
      status: estimate.status as string | undefined,
    },
    onSubmit: async ({ value }) => {
      if (!value.customerId) {
        toast.error("No customer selected", {
          description: "Please select a customer",
        });
        return;
      }

      if (items.length === 0) {
        toast.error("No items added", {
          description: "Please add at least one item to the estimate",
        });
        return;
      }

      startTransition(async () => {
        try {
          const updateData = { ...value, items, id: estimate.id } as Parameters<
            typeof updateEstimate
          >[0];
          const result = await updateEstimate(updateData);

          if (result.success) {
            toast.success("Estimate updated successfully");
            router.push(`${SALES_BASE}/estimates`);
            router.refresh();
          } else {
            toast.error(result.error || "Failed to update estimate");
          }
        } catch (_error) {
          toast.error("Something went wrong");
        }
      });
    },
  });

  const subtotal = items.reduce((sum, item) => sum + item.totalPrice, 0);

  const handleAddItem = (product: any) => {
    const existingItem = items.find((item) => item.productId === product.id);

    if (existingItem) {
      toast.error("Item already added", {
        description: "You can increase the quantity in the table.",
      });
      return;
    }

    const newItem: FormEstimateItem = {
      productId: product.id,
      productName: product.name,
      productImage: product.image,
      quantity: 1,
      unitPrice: Number(product.price),
      discount: 0,
      totalPrice: Number(product.price),
    };

    setItems((prev) => [...prev, newItem]);
  };

  const handleUpdateItem = (
    index: number,
    field: keyof FormEstimateItem,
    value: number,
  ) => {
    setItems((prev) => {
      const newItems = [...prev];
      const item = { ...newItems[index] };

      if (field === "quantity") {
        item.quantity = value;
      } else if (field === "discount") {
        item.discount = value;
      }

      item.totalPrice = item.quantity * item.unitPrice - item.discount;
      if (item.totalPrice < 0) item.totalPrice = 0;

      newItems[index] = item;
      return newItems;
    });
  };

  const handleRemoveItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        form.handleSubmit();
      }}
    >
      {/* Desktop: 2-column layout, Mobile: single column */}
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        {/* Left Column - Products */}
        <div className="space-y-4">
          {/* Products */}
          <div className="border rounded-lg">
            <div className="flex items-center gap-2 p-3 border-b">
              <Package className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold">Products</span>
            </div>
            <div className="p-3">
              <ProductPicker
                onSelect={handleAddItem}
                selectedProductIds={items.map((item) => item.productId)}
              />
              <div className="mt-3">
                <EstimateItemsTable
                  items={items}
                  onUpdate={handleUpdateItem}
                  onRemove={handleRemoveItem}
                />
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="border rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold">Notes</span>
            </div>
            <form.Field name="notes">
              {(field) => {
                const isInvalid =
                  field.state.meta.isTouched && !field.state.meta.isValid;
                return (
                  <Field data-invalid={isInvalid}>
                    <Textarea
                      id={field.name}
                      name={field.name}
                      placeholder="Add notes for the customer..."
                      className="min-h-[80px] text-sm"
                      value={field.state.value ?? ""}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      aria-invalid={isInvalid}
                    />
                    {isInvalid && (
                      <FieldError errors={field.state.meta.errors} />
                    )}
                  </Field>
                );
              }}
            </form.Field>
          </div>
        </div>

        {/* Right Column - Customer & Summary */}
        <div className="space-y-4">
          {/* Customer Selection */}
          <div className="border rounded-lg p-3">
            <div className="flex items-center gap-2 mb-3">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold">Customer</span>
            </div>
            <form.Field name="customerId">
              {(field) => {
                const isInvalid =
                  field.state.meta.isTouched && !field.state.meta.isValid;
                return (
                  <Field data-invalid={isInvalid}>
                    <CustomerSelect
                      value={field.state.value}
                      onSelect={(customerId) => {
                        field.handleChange(customerId);
                      }}
                    />
                    {isInvalid && (
                      <FieldError errors={field.state.meta.errors} />
                    )}
                  </Field>
                );
              }}
            </form.Field>

            <div className="mt-3">
              <form.Field name="validUntil">
                {(field) => {
                  const isInvalid =
                    field.state.meta.isTouched && !field.state.meta.isValid;
                  return (
                    <Field data-invalid={isInvalid}>
                      <FieldLabel htmlFor={field.name} className="text-xs">
                        Valid Until
                      </FieldLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !field.state.value && "text-muted-foreground",
                            )}
                          >
                            {field.state.value ? (
                              format(field.state.value, "PPP")
                            ) : (
                              <span>Pick a date</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.state.value ?? undefined}
                            onSelect={(date) =>
                              field.handleChange(date ?? null)
                            }
                            disabled={(date) => date < new Date()}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      {isInvalid && (
                        <FieldError errors={field.state.meta.errors} />
                      )}
                    </Field>
                  );
                }}
              </form.Field>
            </div>
          </div>

          {/* Summary */}
          <form.Field name="discount">
            {(field) => (
              <EstimateSummary
                subtotal={subtotal}
                discount={field.state.value}
                onDiscountChange={(value) => field.handleChange(value)}
              />
            )}
          </form.Field>

          {/* Submit Button */}
          <form.Subscribe
            selector={(state) => [state.canSubmit, state.isSubmitting]}
          >
            {([canSubmit, isSubmitting]) => (
              <Button
                type="submit"
                className="w-full"
                disabled={!canSubmit || isSubmitting || isPending || isReadOnly}
              >
                {(isSubmitting || isPending) && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {isReadOnly ? "Cannot Update (Read-only)" : "Update Estimate"}
              </Button>
            )}
          </form.Subscribe>
        </div>
      </div>
    </form>
  );
}
