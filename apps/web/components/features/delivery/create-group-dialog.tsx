"use client";

import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  CalendarIcon,
  FileText,
  Loader2,
  MapPin,
  Plus,
  Truck,
  User,
} from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import {
  createDeliveryGroup,
  getDeliverymenForAssignmentByInvoiceIds,
  getUnassignedInvoices,
} from "@/actions/delivery/delivery-management";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";

const VEHICLE_OPTIONS = [
  { value: "bike", label: "Bike" },
  { value: "car", label: "Car" },
  { value: "van", label: "Van" },
  { value: "truck", label: "Truck" },
] as const;

export function CreateGroupDialog() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [open, setOpen] = React.useState(false);
  const [invoiceIdsForDeliverymen, setInvoiceIdsForDeliverymen] =
    React.useState<number[]>([]);

  const { data: invoicesData, isLoading: isLoadingInvoices } = useQuery({
    queryKey: ["unassigned-invoices"],
    queryFn: async () => {
      const result = await getUnassignedInvoices();
      if (!result.success) throw new Error(result.error);
      return result.invoices ?? [];
    },
    enabled: open,
    staleTime: 0,
  });

  const { data: deliverymenData, isLoading: isLoadingDeliverymen } = useQuery({
    queryKey: [
      "deliverymen-for-assignment-by-invoices",
      invoiceIdsForDeliverymen,
    ],
    queryFn: async () => {
      const result = await getDeliverymenForAssignmentByInvoiceIds(
        invoiceIdsForDeliverymen,
      );
      if (!result.success) throw new Error(result.error);
      return result.deliverymen ?? [];
    },
    enabled: open,
    staleTime: 30000,
  });

  const invoices = invoicesData ?? [];
  const deliverymen = deliverymenData ?? [];

  // Mutation for creating delivery group
  const mutation = useMutation({
    mutationFn: createDeliveryGroup,
    onSuccess: (result) => {
      if (!result.success) {
        toast.error(result.error || "Failed to create group");
        return;
      }
      console.log(result);
      queryClient.invalidateQueries({ queryKey: ["unassigned-invoices"] });
      queryClient.invalidateQueries({ queryKey: ["delivery-groups"] });
      toast.success("Delivery group created successfully");
      form.reset();
      setOpen(false);
      router.refresh();
    },
    onError: () => {
      toast.error("An unexpected error occurred");
    },
  });

  const form = useForm({
    defaultValues: {
      groupName: "",
      invoiceIds: [] as number[],
      deliverymanId: "",
      notes: "",
      vehicleType: "",
      expectedDeliveryAt: new Date().toISOString().split("T")[0],
    },
    onSubmit: async ({ value }) => {
      if (!value.groupName.trim()) {
        toast.error("Group name is required");
        return;
      }
      if (value.invoiceIds.length === 0) {
        toast.error("At least one invoice is required");
        return;
      }
      if (!value.deliverymanId) {
        toast.error("Deliveryman is required");
        return;
      }
      mutation.mutate({
        groupName: value.groupName,
        invoiceIds: value.invoiceIds,
        deliverymanId: value.deliverymanId,
        notes: value.notes || undefined,
        vehicleType: value.vehicleType
          ? (value.vehicleType as "bike" | "car" | "van" | "truck")
          : undefined,
        expectedDeliveryAt: value.expectedDeliveryAt || undefined,
      });
    },
  });

  React.useEffect(() => {
    if (!open) {
      form.reset();
      setInvoiceIdsForDeliverymen([]);
    }
  }, [open, form]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 size-4" />
          Create Delivery Group
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Truck className="size-5" />
            Create Delivery Group
          </DialogTitle>
        </DialogHeader>

        <Separator />

        <div className="px-6 py-5">
          <form
            id="create-group-form"
            onSubmit={(e) => {
              e.preventDefault();
              e.stopPropagation();
              form.handleSubmit();
            }}
            className="space-y-6"
          >
            {/* Group Details Section */}
            <div className="grid gap-4 lg:grid-cols-2">
              {/* Group Name */}
              <form.Field name="groupName">
                {(field) => {
                  const isInvalid =
                    field.state.meta.isTouched && !field.state.meta.isValid;
                  return (
                    <Field data-invalid={isInvalid}>
                      <FieldLabel htmlFor={field.name}>Group Name</FieldLabel>
                      <Input
                        id={field.name}
                        name={field.name}
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                        placeholder="e.g., Downtown Run"
                        autoComplete="off"
                      />
                      {isInvalid && (
                        <FieldError errors={field.state.meta.errors} />
                      )}
                    </Field>
                  );
                }}
              </form.Field>

              {/* Deliveryman Select */}
              <form.Field name="deliverymanId">
                {(field) => {
                  const isInvalid =
                    field.state.meta.isTouched && !field.state.meta.isValid;
                  return (
                    <Field data-invalid={isInvalid}>
                      <FieldLabel htmlFor={field.name}>
                        Assign Deliveryman
                      </FieldLabel>
                      <Select
                        value={field.state.value}
                        onValueChange={field.handleChange}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select deliveryman" />
                        </SelectTrigger>
                        <SelectContent>
                          {isLoadingDeliverymen ? (
                            <div className="flex justify-center p-3">
                              <Loader2 className="animate-spin size-4 text-muted-foreground" />
                            </div>
                          ) : deliverymen.length === 0 ? (
                            <div className="text-center text-sm text-muted-foreground p-4">
                              No deliverymen available
                            </div>
                          ) : (
                            deliverymen.map((dm) => (
                              <SelectItem
                                key={dm.id}
                                value={dm.id}
                                disabled={dm.hasActiveGroup}
                              >
                                <div className="flex flex-col gap-0.5">
                                  <div className="flex items-center gap-2">
                                    <div className="flex items-center justify-center size-5 rounded-full bg-primary/10">
                                      <User className="size-3 text-primary" />
                                    </div>
                                    <span className="font-medium">
                                      {dm.name}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1 text-xs text-muted-foreground ml-7">
                                    {(dm as { serviceArea?: string | null })
                                      .serviceArea && (
                                      <span>
                                        {
                                          (dm as { serviceArea: string })
                                            .serviceArea
                                        }
                                      </span>
                                    )}
                                    {dm.hasActiveGroup && (
                                      <span className="text-destructive font-medium">
                                        • On Delivery
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                      {isInvalid && (
                        <FieldError errors={field.state.meta.errors} />
                      )}
                    </Field>
                  );
                }}
              </form.Field>

              {/* Vehicle type (optional) */}
              <form.Field name="vehicleType">
                {(field) => (
                  <Field>
                    <FieldLabel htmlFor={field.name}>
                      Vehicle type (optional)
                    </FieldLabel>
                    <Select
                      value={field.state.value}
                      onValueChange={field.handleChange}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="None" />
                      </SelectTrigger>
                      <SelectContent>
                        {VEHICLE_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                )}
              </form.Field>

              {/* Expected delivery date (optional) */}
              <form.Field name="expectedDeliveryAt">
                {(field) => (
                  <Field>
                    <FieldLabel htmlFor={field.name}>
                      Expected delivery date (optional)
                    </FieldLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={`w-full justify-start text-left font-normal ${
                            !field.state.value && "text-muted-foreground"
                          }`}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {field.state.value
                            ? format(new Date(field.state.value), "PPP")
                            : "Pick a date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={
                            field.state.value
                              ? new Date(field.state.value)
                              : undefined
                          }
                          onSelect={(date) =>
                            field.handleChange(
                              date ? format(date, "yyyy-MM-dd") : "",
                            )
                          }
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </Field>
                )}
              </form.Field>
            </div>

            {/* Invoices Selection Section */}
            <form.Field name="invoiceIds">
              {(field) => {
                const isInvalid =
                  field.state.meta.isTouched && !field.state.meta.isValid;
                const selectedTotal = invoices
                  .filter((inv) => field.state.value.includes(inv.id))
                  .reduce((sum, inv) => sum + Number(inv.grandTotal), 0);

                return (
                  <Field data-invalid={isInvalid}>
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <FieldLabel className="text-base flex items-center gap-2">
                          <FileText className="size-4" />
                          Select Invoices
                        </FieldLabel>
                        <p className="text-xs text-muted-foreground mt-1">
                          Choose invoices to include in this delivery group
                        </p>
                      </div>
                      {field.state.value.length > 0 && (
                        <Badge variant="secondary" className="font-semibold">
                          {field.state.value.length} selected • ৳
                          {selectedTotal.toLocaleString()}
                        </Badge>
                      )}
                    </div>

                    <div className="rounded-lg border bg-muted/30">
                      {isLoadingInvoices ? (
                        <div className="flex flex-col items-center justify-center p-8 gap-2">
                          <Loader2 className="animate-spin size-6 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">
                            Loading invoices...
                          </span>
                        </div>
                      ) : invoices.length === 0 ? (
                        <div className="flex flex-col items-center justify-center p-8 gap-2 text-muted-foreground">
                          <FileText className="size-8 opacity-50" />
                          <span className="text-sm">
                            No unassigned invoices available
                          </span>
                        </div>
                      ) : (
                        <ScrollArea className="h-60">
                          <div className="p-3 space-y-2">
                            {invoices.map((invoice) => {
                              const isSelected = field.state.value.includes(
                                invoice.id,
                              );
                              const checkboxId = `invoice-${invoice.id}`;
                              return (
                                <label
                                  key={invoice.id}
                                  htmlFor={checkboxId}
                                  className={`
                                    flex items-center gap-3 p-3 rounded-md border cursor-pointer transition-all
                                    ${
                                      isSelected
                                        ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                                        : "border-transparent bg-background hover:bg-muted/50"
                                    }
                                  `}
                                >
                                  <Checkbox
                                    id={checkboxId}
                                    checked={isSelected}
                                    onCheckedChange={(checked) => {
                                      const next = checked
                                        ? [...field.state.value, invoice.id]
                                        : field.state.value.filter(
                                            (id) => id !== invoice.id,
                                          );
                                      field.handleChange(next);
                                      setInvoiceIdsForDeliverymen(next);
                                    }}
                                  />
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="font-semibold text-sm">
                                        {invoice.invoiceNumber}
                                      </span>
                                      {invoice.invoiceType === "split" && (
                                        <Badge
                                          variant="outline"
                                          className="text-xs"
                                        >
                                          Split #{invoice.splitSequence}
                                        </Badge>
                                      )}
                                      {invoice.order?.shippingCity && (
                                        <Badge
                                          variant="outline"
                                          className="text-xs font-normal"
                                        >
                                          <MapPin className="size-3 mr-1" />
                                          {invoice.order.shippingCity}
                                        </Badge>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                                      <span>{invoice.customer?.name}</span>
                                      <span>•</span>
                                      <span className="font-medium text-foreground">
                                        ৳
                                        {Number(
                                          invoice.grandTotal,
                                        ).toLocaleString()}
                                      </span>
                                    </div>
                                  </div>
                                </label>
                              );
                            })}
                          </div>
                        </ScrollArea>
                      )}
                    </div>
                    {isInvalid && (
                      <FieldError errors={field.state.meta.errors} />
                    )}
                  </Field>
                );
              }}
            </form.Field>

            {/* Notes Section */}
            <div className="border-t border-border/60 pt-4">
              <form.Field name="notes">
                {(field) => (
                  <Field>
                    <FieldLabel htmlFor={field.name}>
                      Notes (optional)
                    </FieldLabel>
                    <Textarea
                      id={field.name}
                      name={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      placeholder="Special instructions for the deliveryman..."
                      className="min-h-24 resize-y"
                    />
                  </Field>
                )}
              </form.Field>
            </div>
          </form>
        </div>

        <Separator />

        <DialogFooter className="px-6 py-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={mutation.isPending}
          >
            Cancel
          </Button>
          <form.Subscribe selector={(state) => state.values.invoiceIds}>
            {(invoiceIds) => (
              <Button
                type="submit"
                form="create-group-form"
                disabled={mutation.isPending || invoiceIds.length === 0}
              >
                {mutation.isPending && (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                )}
                Create Group
              </Button>
            )}
          </form.Subscribe>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
