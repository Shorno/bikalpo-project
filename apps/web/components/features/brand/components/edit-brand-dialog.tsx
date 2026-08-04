"use client";

import type { Brand } from "@bikalpo-project/db/schema";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Pencil } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { SetupFormDialog } from "@/components/features/product-setup";
import ImageUploader from "@/components/ImageUploader";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

import { updateBrandSchema } from "@/schema/brand.schema";
import { generateSlug } from "@/utils/generate-slug";
import { orpc } from "@/utils/orpc";

interface EditBrandDialogProps {
  brand: Brand;
}

export default function EditBrandDialog({ brand }: EditBrandDialogProps) {
  const [open, setOpen] = React.useState(false);
  const queryClient = useQueryClient();

  const mutation = useMutation(
    orpc.brand.update.mutationOptions({
      onSuccess: (result) => {
        queryClient.invalidateQueries({ queryKey: orpc.brand.getAll.key() });
        queryClient.invalidateQueries({
          queryKey: orpc.brand.getAdminAll.key(),
        });
        toast.success(result.message);
        setOpen(false);
      },
      onError: (error) => {
        toast.error(
          error.message ||
            "An unexpected error occurred while updating the brand.",
        );
      },
    }),
  );

  const form = useForm({
    defaultValues: {
      id: brand.id,
      name: brand.name,
      slug: brand.slug,
      logo: brand.logo ?? "",
      isActive: brand.isActive,
      displayOrder: brand.displayOrder,
    },

    validators: {
      onSubmit: updateBrandSchema as any,
    },
    onSubmit: async ({ value }) => {
      mutation.mutate(value);
    },
  });

  const autoGenerateSlugFromName = (value: string) => {
    const generatedSlug = generateSlug(value);
    form.setFieldValue("slug", generatedSlug);
  };

  return (
    <SetupFormDialog
      description={`Update the reusable setup details for ${brand.name}.`}
      formId="edit-brand-form"
      hasUnsavedChanges={() => form.state.isDirty}
      isSubmitting={mutation.isPending}
      onOpenChange={setOpen}
      onSubmit={() => form.handleSubmit()}
      open={open}
      submitLabel="Save Changes"
      title="Edit Brand"
      trigger={
        <Button className="w-full justify-start" size="sm" variant="ghost">
          <Pencil className="h-4 w-4 mr-2" />
          Edit
        </Button>
      }
    >
      <form
        id="edit-brand-form"
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          form.handleSubmit();
        }}
        className="space-y-4"
      >
        {/* Brand Name */}
        <form.Field name="name">
          {(field) => {
            const isInvalid =
              field.state.meta.isTouched && !field.state.meta.isValid;
            return (
              <Field data-invalid={isInvalid}>
                <FieldLabel htmlFor={field.name}>Brand Name *</FieldLabel>
                <Input
                  id={field.name}
                  name={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => {
                    field.handleChange(e.target.value);
                    autoGenerateSlugFromName(e.target.value);
                  }}
                  aria-invalid={isInvalid}
                  placeholder="Unilever"
                  autoComplete="off"
                />
                {isInvalid && <FieldError errors={field.state.meta.errors} />}
              </Field>
            );
          }}
        </form.Field>

        {/* Slug */}
        <form.Field name="slug">
          {(field) => {
            const isInvalid =
              field.state.meta.isTouched && !field.state.meta.isValid;
            return (
              <Field data-invalid={isInvalid}>
                <FieldLabel htmlFor={field.name}>Slug *</FieldLabel>
                <Input
                  id={field.name}
                  name={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  aria-invalid={isInvalid}
                  placeholder="unilever"
                  autoComplete="off"
                />
                <FieldDescription>
                  URL-friendly version of the name.
                </FieldDescription>
                {isInvalid && <FieldError errors={field.state.meta.errors} />}
              </Field>
            );
          }}
        </form.Field>

        <form.Field name="logo">
          {(field) => (
            <Field>
              <FieldLabel>Brand logo</FieldLabel>
              <ImageUploader
                folder="brands"
                maxSizeMB={3}
                onChange={field.handleChange}
                value={field.state.value ?? ""}
              />
            </Field>
          )}
        </form.Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <form.Field name="displayOrder">
            {(field) => (
              <Field>
                <FieldLabel htmlFor={field.name}>Display order</FieldLabel>
                <Input
                  id={field.name}
                  min={0}
                  onChange={(event) =>
                    field.handleChange(Number(event.target.value))
                  }
                  type="number"
                  value={field.state.value}
                />
              </Field>
            )}
          </form.Field>
          <form.Field name="isActive">
            {(field) => (
              <Field className="flex min-h-16 flex-row items-center justify-between rounded-lg border px-4 py-3">
                <div>
                  <FieldLabel>Status</FieldLabel>
                  <FieldDescription>
                    Available for new associations
                  </FieldDescription>
                </div>
                <Switch
                  checked={field.state.value}
                  onCheckedChange={field.handleChange}
                />
              </Field>
            )}
          </form.Field>
        </div>
      </form>
    </SetupFormDialog>
  );
}
