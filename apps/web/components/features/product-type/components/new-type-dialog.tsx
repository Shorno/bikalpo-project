"use client";

import { useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as React from "react";
import { toast } from "sonner";
import { z } from "zod";
import { SetupFormDialog } from "@/components/features/product-setup";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { generateSlug } from "@/utils/generate-slug";
import { orpc } from "@/utils/orpc";

const typeBasicsSchema = z.object({
  name: z.string().trim().min(1, "Type Name is required"),
  isActive: z.boolean(),
});

export default function NewTypeDialog() {
  const [open, setOpen] = React.useState(false);
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (data: { name: string; slug: string; isActive: boolean }) =>
      orpc.adminProductType.create.call(data),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["adminProductType"] });
      toast.success(result.message);
      form.reset();
      setOpen(false);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to create the Type.");
    },
  });
  const form = useForm({
    defaultValues: {
      name: "",
      isActive: true,
    },
    validators: {
      onSubmit: typeBasicsSchema as never,
    },
    onSubmit: async ({ value }) => {
      const name = value.name.trim();
      mutation.mutate({
        name,
        slug: generateSlug(name),
        isActive: value.isActive,
      });
    },
  });
  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) form.reset();
    setOpen(nextOpen);
  };

  return (
    <SetupFormDialog
      description="Create a global top-level product classification."
      formId="new-type-form"
      hasUnsavedChanges={() => form.state.isDirty}
      isSubmitting={mutation.isPending}
      onOpenChange={handleOpenChange}
      onSubmit={() => form.handleSubmit()}
      open={open}
      submitLabel="Create Type"
      title="Create Type"
      trigger={<Button>Create Type</Button>}
    >
      <form
        className="space-y-5"
        id="new-type-form"
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
                  htmlFor="new-type-active"
                >
                  <RadioGroupItem id="new-type-active" value="active" />
                  <span className="text-sm font-medium">Active</span>
                </label>
                <label
                  className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 hover:bg-muted/30"
                  htmlFor="new-type-inactive"
                >
                  <RadioGroupItem id="new-type-inactive" value="inactive" />
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
