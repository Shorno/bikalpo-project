"use client";

import { useForm } from "@tanstack/react-form";
import { useMutation } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { convertEstimateToOrder } from "@/actions/estimate/convert-to-order";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { User } from "@/db/schema/auth-schema";

interface ConvertOrderFormProps {
  estimateId: number;
  user: Pick<User, "id" | "name" | "email" | "phoneNumber" | "shopName">;
}

export function ConvertOrderForm({ estimateId, user }: ConvertOrderFormProps) {
  const router = useRouter();

  const mutation = useMutation({
    mutationFn: convertEstimateToOrder,
    onSuccess: (result) => {
      if (result.success) {
        toast.success("Order placed successfully!");
        router.push("/account/orders");
        router.refresh();
      } else {
        toast.error(result.error || "Failed to place order");
      }
    },
    onError: () => {
      toast.error("Something went wrong");
    },
  });

  const form = useForm({
    defaultValues: {
      shippingName: user.name || "",
      shippingPhone: user.phoneNumber || "",
      shippingAddress: "",
      shippingCity: "",
      shippingArea: "",
      shippingPostalCode: "",
      customerNote: "",
    },
    onSubmit: async ({ value }) => {
      mutation.mutate({
        estimateId,
        ...value,
        shippingArea: value.shippingArea || null,
        shippingPostalCode: value.shippingPostalCode || null,
        customerNote: value.customerNote || null,
      });
    },
  });

  return (
    <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-4">
      <h3 className="text-base font-semibold leading-none tracking-tight mb-4">
        Accept & Place Order
      </h3>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          form.handleSubmit();
        }}
        className="space-y-3"
      >
        {/* Name and Phone - side by side on desktop */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <form.Field
            name="shippingName"
            validators={{
              onBlur: ({ value }) => (!value ? "Name is required" : undefined),
            }}
          >
            {(field) => (
              <Field>
                <FieldLabel htmlFor={field.name}>
                  Receiver's Name <span className="text-red-500">*</span>
                </FieldLabel>
                <Input
                  id={field.name}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  placeholder="Full Name"
                  className={
                    field.state.meta.errors.length > 0 ? "border-red-500" : ""
                  }
                />
                {field.state.meta.errors.length > 0 && (
                  <p className="text-xs text-red-500 mt-1">
                    {field.state.meta.errors[0]}
                  </p>
                )}
              </Field>
            )}
          </form.Field>

          <form.Field
            name="shippingPhone"
            validators={{
              onBlur: ({ value }) => (!value ? "Phone is required" : undefined),
            }}
          >
            {(field) => (
              <Field>
                <FieldLabel htmlFor={field.name}>
                  Phone Number <span className="text-red-500">*</span>
                </FieldLabel>
                <Input
                  id={field.name}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  placeholder="01XXX-XXXXXX"
                  className={
                    field.state.meta.errors.length > 0 ? "border-red-500" : ""
                  }
                />
                {field.state.meta.errors.length > 0 && (
                  <p className="text-xs text-red-500 mt-1">
                    {field.state.meta.errors[0]}
                  </p>
                )}
              </Field>
            )}
          </form.Field>
        </div>

        {/* Address */}
        <form.Field
          name="shippingAddress"
          validators={{
            onBlur: ({ value }) => (!value ? "Address is required" : undefined),
          }}
        >
          {(field) => (
            <Field>
              <FieldLabel htmlFor={field.name}>
                Shipping Address <span className="text-red-500">*</span>
              </FieldLabel>
              <Input
                id={field.name}
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
                placeholder="House, Road, Apartment, etc."
                className={
                  field.state.meta.errors.length > 0 ? "border-red-500" : ""
                }
              />
              {field.state.meta.errors.length > 0 && (
                <p className="text-xs text-red-500 mt-1">
                  {field.state.meta.errors[0]}
                </p>
              )}
            </Field>
          )}
        </form.Field>

        {/* City and Postal Code */}
        <div className="grid grid-cols-2 gap-3">
          <form.Field
            name="shippingCity"
            validators={{
              onBlur: ({ value }) => (!value ? "City is required" : undefined),
            }}
          >
            {(field) => (
              <Field>
                <FieldLabel htmlFor={field.name}>
                  City <span className="text-red-500">*</span>
                </FieldLabel>
                <Input
                  id={field.name}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  placeholder="City"
                  className={
                    field.state.meta.errors.length > 0 ? "border-red-500" : ""
                  }
                />
                {field.state.meta.errors.length > 0 && (
                  <p className="text-xs text-red-500 mt-1">
                    {field.state.meta.errors[0]}
                  </p>
                )}
              </Field>
            )}
          </form.Field>

          <form.Field name="shippingPostalCode">
            {(field) => (
              <Field>
                <FieldLabel htmlFor={field.name}>Postal Code</FieldLabel>
                <Input
                  id={field.name}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="1212"
                />
              </Field>
            )}
          </form.Field>
        </div>

        {/* Area */}
        <form.Field name="shippingArea">
          {(field) => (
            <Field>
              <FieldLabel htmlFor={field.name}>Area / Thana</FieldLabel>
              <Input
                id={field.name}
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                placeholder="Gulshan"
              />
            </Field>
          )}
        </form.Field>

        {/* Customer Note */}
        <form.Field name="customerNote">
          {(field) => (
            <Field>
              <FieldLabel htmlFor={field.name}>
                Order Note (Optional)
              </FieldLabel>
              <Textarea
                id={field.name}
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                placeholder="Special instructions for delivery..."
                className="min-h-[60px]"
              />
            </Field>
          )}
        </form.Field>

        <Button type="submit" className="w-full" disabled={mutation.isPending}>
          {mutation.isPending && (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          )}
          Confirm Order
        </Button>
      </form>
    </div>
  );
}
