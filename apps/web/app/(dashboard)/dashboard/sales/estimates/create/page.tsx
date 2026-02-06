"use client";

import { useForm } from "@tanstack/react-form";
import { format } from "date-fns";
import {
  ArrowLeft,
  CalendarIcon,
  FileText,
  Loader2,
  Package,
  User,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createEstimate } from "@/actions/estimate/create-estimate";
import { EstimateItemsTable } from "@/components/features/estimates/estimate-items-table";
import { EstimateSummary } from "@/components/features/estimates/estimate-summary";
import { MultiCustomerSelect } from "@/components/features/estimates/multi-customer-select";
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

export default function CreateEstimatePage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [items, setItems] = useState<FormEstimateItem[]>([]);

  const form = useForm({
    defaultValues: {
      customerIds: [] as string[],
      discount: 0,
      notes: "" as string | null,
      validUntil: null as Date | null,
    },
    onSubmit: async ({ value }) => {
      if (value.customerIds.length === 0) {
        toast.error("No customers selected", {
          description: "Please select at least one customer",
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
          const submitData = { ...value, items };
          const result = await createEstimate(submitData);

          if (result.success) {
            toast.success(result.message);
            router.push(`${SALES_BASE}/estimates`);
          } else {
            toast.error(result.error, {
              description: result.details?.join(", "),
            });
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
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-9 w-9" asChild>
          <Link href={`${SALES_BASE}/estimates`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-lg sm:text-xl font-bold">Create Estimate</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Generate a new sales estimate for your customers.
          </p>
        </div>
      </div>

      <form
        id="estimate-form"
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
              <form.Field name="customerIds">
                {(field) => {
                  const isInvalid =
                    field.state.meta.isTouched && !field.state.meta.isValid;
                  return (
                    <Field data-invalid={isInvalid}>
                      <MultiCustomerSelect
                        value={field.state.value || []}
                        onSelect={(customerIds) => {
                          field.handleChange(customerIds);
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
                  disabled={!canSubmit || isSubmitting || isPending}
                >
                  {(isSubmitting || isPending) && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Create Estimate
                </Button>
              )}
            </form.Subscribe>
          </div>
        </div>
      </form>
    </div>
  );
}
