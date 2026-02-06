"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Send, ShoppingBag, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { convertEstimateToOrder } from "@/actions/estimate/convert-to-order";
import {
  deleteEstimate,
  sendEstimate,
} from "@/actions/estimate/update-estimate";
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  type ConvertEstimateFormValues,
  convertEstimateSchema,
} from "@/schema/estimate.schema";

interface EstimateActionButtonsProps {
  estimate: any; // Type inference from drizzle result
}

export function EstimateActionButtons({
  estimate,
}: EstimateActionButtonsProps) {
  const router = useRouter();

  const [loading, setLoading] = React.useState(false);
  const [convertOpen, setConvertOpen] = React.useState(false);

  const form = useForm<ConvertEstimateFormValues>({
    resolver: zodResolver(convertEstimateSchema),
    defaultValues: {
      estimateId: estimate.id,
      shippingName: estimate.customer?.name || "",
      shippingPhone: estimate.customer?.phoneNumber || "",
      shippingAddress: "",
      shippingCity: "",
      shippingArea: "",
      shippingPostalCode: "",
      customerNote: "",
    },
  });

  // Reset form when estimate changes
  // biome-ignore lint/correctness/useExhaustiveDependencies: form.reset is stable and only needs estimate.id to trigger
  React.useEffect(() => {
    if (estimate) {
      form.reset({
        estimateId: estimate.id,
        shippingName: estimate.customer?.name || "",
        shippingPhone: estimate.customer?.phoneNumber || "",
        shippingAddress: "",
        shippingCity: "Dhaka",
        shippingArea: "",
        shippingPostalCode: "",
        customerNote: "",
      });
    }
  }, [estimate.id, form]);

  const handleSend = async () => {
    setLoading(true);
    try {
      const result = await sendEstimate(estimate.id);
      if (result.success) {
        toast.success("Estimate sent for review");
        router.refresh();
      } else {
        toast.error(result.error || "Failed to send estimate");
      }
    } catch (_error) {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    setLoading(true);
    try {
      const result = await deleteEstimate(estimate.id);
      if (result.success) {
        toast.success("Estimate deleted");
        const isDashboard = window.location.pathname.startsWith("/dashboard");
        const _redirectPath = isDashboard
          ? window.location.pathname.startsWith("/dashboard/admin")
            ? "/dashboard/admin/estimates"
            : "/dashboard/estimates" // Fallback or handling other dashboard types? Better safe:
          : "/employee/estimates";

        // Actually, let's just use the correct path if it's admin
        const finalRedirectPath = window.location.pathname.includes("/admin")
          ? "/dashboard/admin/estimates"
          : "/employee/estimates";

        router.push(finalRedirectPath);
      } else {
        toast.error(result.error || "Failed to delete estimate");
      }
    } catch (_error) {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const onConvertSubmit = async (data: ConvertEstimateFormValues) => {
    setLoading(true);
    try {
      const result = await convertEstimateToOrder(data);
      if (result.success) {
        toast.success("Estimate converted to order");
        setConvertOpen(false);

        const isDashboard = window.location.pathname.startsWith("/dashboard");
        const redirectPath = isDashboard
          ? `/dashboard/estimates/${estimate.id}`
          : `/employee/estimates/${estimate.id}`;

        router.push(redirectPath);
        router.refresh();
      } else {
        toast.error(result.error || "Failed to convert estimate");
      }
    } catch (_error: any) {
      toast.error("Something went wrong during conversion");
    } finally {
      setLoading(false);
    }
  };

  // For debugging form errors
  React.useEffect(() => {
    if (Object.keys(form.formState.errors).length > 0) {
      console.log("Form Errors:", form.formState.errors);
      // Don't alert here to avoid spamming during typing, but log it.
    }
  }, [form.formState.errors]);

  if (estimate.status === "draft") {
    return (
      <div className="flex gap-2">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" size="sm" disabled={loading}>
              <Trash2 className="mr-2 size-4" />
              Delete
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the
                estimate.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete}>
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Button size="sm" onClick={handleSend} disabled={loading}>
          {loading ? (
            <Loader2 className="mr-2 size-4 animate-spin" />
          ) : (
            <Send className="mr-2 size-4" />
          )}
          {Number(estimate.discount) > 0
            ? "Send For Admin Approval"
            : "Send to Customer"}
        </Button>
      </div>
    );
  }

  if (estimate.status === "pending_admin_approval") {
    return (
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled>
          <Loader2 className="mr-2 size-4 animate-spin" />
          Waiting for Admin Approval
        </Button>
      </div>
    );
  }

  if (estimate.status === "approved") {
    return (
      <Dialog
        open={convertOpen}
        onOpenChange={(val) => {
          console.log("Dialog Open Change:", val);
          setConvertOpen(val);
        }}
      >
        <DialogTrigger asChild>
          <Button size="sm">
            <ShoppingBag className="mr-2 size-4" />
            Convert to Order
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Convert to Order</DialogTitle>
            <DialogDescription>
              Please confirm shipping details to create the order.
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onConvertSubmit, (errors) => {
                console.error("Form validation errors:", errors);
                toast.error(
                  "Please fill in all required fields (Name, Phone, Address, City).",
                );
              })}
              className="space-y-4"
            >
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="shippingName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Recipient Name</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="shippingPhone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone Number</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="shippingPostalCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Postal Code (Optional)</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value || ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="shippingAddress"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address</FormLabel>
                    <FormControl>
                      <Textarea {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="shippingCity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>City</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="shippingArea"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Area (Optional)</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value || ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="customerNote"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Customer Note (Optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        value={field.value ?? ""}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        name={field.name}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button type="submit" disabled={loading}>
                  {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
                  Confirm Convert
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    );
  }

  return null;
}
