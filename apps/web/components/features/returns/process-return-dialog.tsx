"use client";

import { useForm } from "@tanstack/react-form";
import { useMutation } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { processReturn } from "@/actions/returns/return-processing";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

interface ProcessReturnDialogProps {
  returnRequest: any;
  trigger?: React.ReactNode;
}

export function ProcessReturnDialog({
  returnRequest,
  trigger,
}: ProcessReturnDialogProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [action, setAction] = React.useState<"approve" | "reject">("approve");

  const mutation = useMutation({
    mutationFn: processReturn,
    onSuccess: (result) => {
      if (!result.success) {
        toast.error(result.error || "Failed to process return");
        return;
      }
      toast.success("Return request processed successfully");
      setOpen(false);
      router.refresh();
    },
    onError: () => {
      toast.error("Something went wrong");
    },
  });

  const form = useForm({
    defaultValues: {
      returnId: returnRequest.id as number,
      action: "approve" as "approve" | "reject",
      adminNotes: "",
      refundType: "cash" as "cash" | "wallet" | "adjustment",
      restockItems: true,
    },
    onSubmit: async ({ value }) => {
      mutation.mutate(value);
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || <Button size="sm">Process</Button>}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Approve or Decline Return</DialogTitle>
          <DialogDescription>
            Approve to process the refund (and optionally restock). Decline to
            reject the return request.
          </DialogDescription>
        </DialogHeader>

        <form
          id="process-return-form"
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            form.handleSubmit();
          }}
          className="space-y-4"
        >
          {/* Action/Decision Field */}
          <form.Field name="action">
            {(field) => {
              const isInvalid =
                field.state.meta.isTouched && !field.state.meta.isValid;
              return (
                <Field data-invalid={isInvalid}>
                  <FieldLabel htmlFor={field.name}>Decision</FieldLabel>
                  <Select
                    value={field.state.value}
                    onValueChange={(value) => {
                      const newAction = value as "approve" | "reject";
                      field.handleChange(newAction);
                      setAction(newAction);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select outcome" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="approve">Approve</SelectItem>
                      <SelectItem value="reject">Decline</SelectItem>
                    </SelectContent>
                  </Select>
                  {isInvalid && <FieldError errors={field.state.meta.errors} />}
                </Field>
              );
            }}
          </form.Field>

          {/* Conditional fields for approval */}
          {action === "approve" && (
            <>
              {/* Refund Type Field */}
              <form.Field name="refundType">
                {(field) => {
                  const isInvalid =
                    field.state.meta.isTouched && !field.state.meta.isValid;
                  return (
                    <Field data-invalid={isInvalid}>
                      <FieldLabel htmlFor={field.name}>Refund Type</FieldLabel>
                      <Select
                        value={field.state.value}
                        onValueChange={(value) =>
                          field.handleChange(
                            value as "cash" | "wallet" | "adjustment",
                          )
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select refund type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cash">Cash</SelectItem>
                          <SelectItem value="wallet">Wallet</SelectItem>
                          <SelectItem value="adjustment">Adjustment</SelectItem>
                        </SelectContent>
                      </Select>
                      {isInvalid && (
                        <FieldError errors={field.state.meta.errors} />
                      )}
                    </Field>
                  );
                }}
              </form.Field>

              {/* Restock Items Field */}
              <form.Field name="restockItems">
                {(field) => (
                  <Field
                    orientation="horizontal"
                    className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4"
                  >
                    <Checkbox
                      id={field.name}
                      checked={field.state.value}
                      onCheckedChange={(checked) =>
                        field.handleChange(checked as boolean)
                      }
                    />
                    <FieldContent>
                      <FieldLabel htmlFor={field.name}>
                        Restock Items
                      </FieldLabel>
                      <FieldDescription>
                        Add returned items back to product inventory.
                      </FieldDescription>
                    </FieldContent>
                  </Field>
                )}
              </form.Field>
            </>
          )}

          {/* Admin Notes Field */}
          <form.Field name="adminNotes">
            {(field) => {
              const isInvalid =
                field.state.meta.isTouched && !field.state.meta.isValid;
              return (
                <Field data-invalid={isInvalid}>
                  <FieldLabel htmlFor={field.name}>
                    Admin Note (Internal)
                  </FieldLabel>
                  <Textarea
                    id={field.name}
                    name={field.name}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder="Add notes about this decision..."
                    className="resize-none"
                  />
                  {isInvalid && <FieldError errors={field.state.meta.errors} />}
                </Field>
              );
            }}
          </form.Field>
        </form>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={mutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="process-return-form"
            disabled={mutation.isPending}
            variant={action === "reject" ? "destructive" : "default"}
          >
            {mutation.isPending && (
              <Loader2 className="mr-2 size-4 animate-spin" />
            )}
            {action === "approve" ? "Approve Return" : "Decline Return"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
