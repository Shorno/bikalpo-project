"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { CalendarIcon, Loader2, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import {
  assignDeliveryman,
  getDeliverymenForAssignment,
} from "@/actions/delivery/delivery-management";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  type AssignDeliverymanFormValues,
  assignDeliverymanSchema,
} from "@/schema/delivery.schema";

const VEHICLE_OPTIONS = [
  { value: "bike", label: "Bike" },
  { value: "car", label: "Car" },
  { value: "van", label: "Van" },
  { value: "truck", label: "Truck" },
] as const;

interface AssignDeliverymanDialogProps {
  groupId: number;
  /** First order's shipping_area for area-based deliveryman list */
  orderShippingArea?: string | null;
  trigger?: React.ReactNode;
}

export function AssignDeliverymanDialog({
  groupId,
  orderShippingArea,
  trigger,
}: AssignDeliverymanDialogProps) {
  const router = useRouter();

  const [open, setOpen] = React.useState(false);
  const [deliverymen, setDeliverymen] = React.useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = React.useState(false);

  const form = useForm<AssignDeliverymanFormValues>({
    resolver: zodResolver(assignDeliverymanSchema),
    defaultValues: {
      groupId,
      deliverymanId: "",
      vehicleType: undefined,
      expectedDeliveryAt: new Date().toISOString().split("T")[0],
    },
  });

  React.useEffect(() => {
    if (open) {
      setLoadingUsers(true);
      getDeliverymenForAssignment(orderShippingArea ?? undefined)
        .then((result) => {
          if (result.success) {
            setDeliverymen(result.deliverymen || []);
          }
        })
        .finally(() => setLoadingUsers(false));
    }
  }, [open, orderShippingArea]);

  const onSubmit = async (data: AssignDeliverymanFormValues) => {
    try {
      const result = await assignDeliveryman({
        groupId: data.groupId,
        deliverymanId: data.deliverymanId,
        vehicleType: data.vehicleType || undefined,
        expectedDeliveryAt: data.expectedDeliveryAt || undefined,
      });
      if (result.success) {
        toast.success("Deliveryman assigned successfully");
        setOpen(false);
        router.refresh();
      } else {
        toast.error(result.error || "Failed to assign deliveryman");
      }
    } catch (_error) {
      toast.error("Something went wrong");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <UserPlus className="mr-2 size-4" />
            Assign
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Assign Deliveryman</DialogTitle>
          <DialogDescription>
            Select a deliveryman (filtered by area when available), optional
            vehicle and expected date.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            id="assign-form"
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="deliverymanId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Deliveryman</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue
                          placeholder={
                            loadingUsers ? "Loading..." : "Select deliveryman"
                          }
                        />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {deliverymen.map((u) => (
                        <SelectItem
                          key={u.id}
                          value={u.id}
                          disabled={u.hasActiveGroup}
                        >
                          {u.name}
                          {u.phoneNumber ? ` (${u.phoneNumber})` : ""}
                          {u.serviceArea ? ` · ${u.serviceArea}` : ""}
                          {u.hasActiveGroup && (
                            <span className="text-destructive ml-1">
                              (On Delivery)
                            </span>
                          )}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="vehicleType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Vehicle type (optional)</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value ?? ""}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="None" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {VEHICLE_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="expectedDeliveryAt"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Expected delivery date (optional)</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          className={`w-full justify-start text-left font-normal ${
                            !field.value && "text-muted-foreground"
                          }`}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {field.value
                            ? format(new Date(field.value), "PPP")
                            : "Pick a date"}
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={
                          field.value ? new Date(field.value) : undefined
                        }
                        onSelect={(date) =>
                          field.onChange(date ? format(date, "yyyy-MM-dd") : "")
                        }
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>

        <DialogFooter>
          <Button
            type="submit"
            form="assign-form"
            disabled={form.formState.isSubmitting}
          >
            {form.formState.isSubmitting && (
              <Loader2 className="mr-2 size-4 animate-spin" />
            )}
            Assign
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
