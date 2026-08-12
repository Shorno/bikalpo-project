"use client";

import { useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Pencil } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { z } from "zod";
import { SetupFormDialog } from "@/components/features/product-setup";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { orpc } from "@/utils/orpc";
import type { ProductTypeRow } from "./product-type-columns";

const typeBasicsSchema = z.object({
  name: z.string().trim().min(1, "Type Name is required"),
  isActive: z.boolean(),
});

interface EditTypeDialogProps {
  type: ProductTypeRow;
}

export default function EditTypeDialog({ type }: EditTypeDialogProps) {
  const [open, setOpen] = React.useState(false);
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (data: {
      id: number;
      name: string;
      slug: string;
      description?: string;
      image?: string;
      inventoryBehaviour: ProductTypeRow["inventoryBehaviour"];
      family: ProductTypeRow["family"];
      isActive: boolean;
      displayOrder?: number;
    }) => orpc.adminProductType.update.call(data),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["adminProductType"] });
      toast.success(result.message);
      setOpen(false);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update the Type.");
    },
  });
  const form = useForm({
    defaultValues: {
      name: type.name,
      isActive: type.isActive,
    },
    validators: {
      onSubmit: typeBasicsSchema as never,
    },
    onSubmit: async ({ value }) => {
      mutation.mutate({
        id: type.id,
        name: value.name.trim(),
        slug: type.slug,
        description: type.description ?? undefined,
        image: type.image ?? undefined,
        inventoryBehaviour: type.inventoryBehaviour,
        family: type.family,
        isActive: value.isActive,
        displayOrder: type.displayOrder,
      });
    },
  });
  const handleOpenChange = (nextOpen: boolean) => {
    form.reset({ name: type.name, isActive: type.isActive });
    setOpen(nextOpen);
  };

  return (
    <SetupFormDialog
      description={`Update ${type.name}.`}
      formId="edit-type-form"
      hasUnsavedChanges={() => form.state.isDirty}
      isSubmitting={mutation.isPending}
      onOpenChange={handleOpenChange}
      onSubmit={() => form.handleSubmit()}
      open={open}
      submitLabel="Save Changes"
      title="Edit Type"
      trigger={
        <Button variant="outline">
          <Pencil aria-hidden="true" className="size-4" />
          Edit
        </Button>
      }
    >
      <form
        className="space-y-5"
        id="edit-type-form"
        onSubmit={(event) => {
          event.preventDefault();
          event.stopPropagation();
          form.handleSubmit();
        }}
      >
        <form.Field name="name">
          {(field) => {
            const isInvalid =
              field.state.meta.isTouched && !field.state.meta.isValid;
            return (
              <Field data-invalid={isInvalid}>
                <FieldLabel htmlFor={field.name}>Type Name</FieldLabel>
                <Input
                  aria-invalid={isInvalid}
                  autoComplete="off"
                  id={field.name}
                  name={field.name}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  placeholder="Grocery"
                  value={field.state.value}
                />
                {isInvalid && <FieldError errors={field.state.meta.errors} />}
              </Field>
            );
          }}
        </form.Field>

        <form.Field name="isActive">
          {(field) => (
            <Field>
              <FieldLabel>Status</FieldLabel>
              <RadioGroup
                className="grid gap-2 sm:grid-cols-2"
                onValueChange={(value) =>
                  field.handleChange(value === "active")
                }
                value={field.state.value ? "active" : "inactive"}
              >
                <label
                  className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 hover:bg-muted/30"
                  htmlFor={`edit-type-${type.id}-active`}
                >
                  <RadioGroupItem
                    id={`edit-type-${type.id}-active`}
                    value="active"
                  />
                  <span className="text-sm font-medium">Active</span>
                </label>
                <label
                  className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 hover:bg-muted/30"
                  htmlFor={`edit-type-${type.id}-inactive`}
                >
                  <RadioGroupItem
                    id={`edit-type-${type.id}-inactive`}
                    value="inactive"
                  />
                  <span className="text-sm font-medium">Inactive</span>
                </label>
              </RadioGroup>
            </Field>
          )}
        </form.Field>
      </form>
    </SetupFormDialog>
  );
}
