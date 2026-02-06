"use client";

import { useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import ImageUploader from "@/components/ImageUploader";
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
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { createCategorySchema } from "@/schema/category.scheam";
import { generateSlug } from "@/utils/generate-slug";
import { orpc } from "@/utils/orpc";

export default function NewCategoryDialog() {
  const [open, setOpen] = React.useState(false);
  const queryClient = useQueryClient();

  const mutation = useMutation(
    orpc.category.create.mutationOptions({
      onSuccess: (result) => {
        queryClient.invalidateQueries({ queryKey: orpc.category.getAll.key() });
        toast.success(result.message);
        form.reset();
        setOpen(false);
      },
      onError: (error) => {
        toast.error(error.message || "An unexpected error occurred while creating the category.");
      },
    })
  );

  const form = useForm({
    defaultValues: {
      name: "",
      slug: "",
      image: "",
      isActive: true,
      displayOrder: 0,
    },

    validators: {
      onSubmit: createCategorySchema,
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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>New Category</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Category</DialogTitle>
          <DialogDescription>
            Add a new category to organize your products.
          </DialogDescription>
        </DialogHeader>
        <form
          id="new-category-form"
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            form.handleSubmit();
          }}
          className="space-y-4"
        >
          {/* Image Uploader */}
          <form.Field name="image">
            {(field) => {
              const isInvalid =
                field.state.meta.isTouched && !field.state.meta.isValid;
              return (
                <Field data-invalid={isInvalid}>
                  <FieldLabel htmlFor={field.name}>Category Image</FieldLabel>
                  <ImageUploader
                    value={field.state.value}
                    onChange={field.handleChange}
                    folder="categories"
                    maxSizeMB={5}
                  />
                  <FieldDescription>Upload an image (max 5MB)</FieldDescription>
                  {isInvalid && <FieldError errors={field.state.meta.errors} />}
                </Field>
              );
            }}
          </form.Field>

          {/* Category Name */}
          <form.Field name="name">
            {(field) => {
              const isInvalid =
                field.state.meta.isTouched && !field.state.meta.isValid;
              return (
                <Field data-invalid={isInvalid}>
                  <FieldLabel htmlFor={field.name}>Category Name *</FieldLabel>
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
                    placeholder="Electronics"
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
                    placeholder="electronics"
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

          {/* Display Order */}
          <form.Field name="displayOrder">
            {(field) => {
              const isInvalid =
                field.state.meta.isTouched && !field.state.meta.isValid;
              return (
                <Field data-invalid={isInvalid}>
                  <FieldLabel htmlFor={field.name}>Display Order</FieldLabel>
                  <Input
                    id={field.name}
                    name={field.name}
                    type="number"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(Number(e.target.value))}
                    aria-invalid={isInvalid}
                    placeholder="0"
                    min={0}
                    autoComplete="off"
                  />
                  <FieldDescription>
                    Lower numbers appear first
                  </FieldDescription>
                  {isInvalid && <FieldError errors={field.state.meta.errors} />}
                </Field>
              );
            }}
          </form.Field>

          {/* Active Status */}
          <form.Field name="isActive">
            {(field) => (
              <Field orientation="horizontal">
                <FieldContent>
                  <FieldLabel htmlFor={field.name}>Active Status</FieldLabel>
                  <FieldDescription>
                    Inactive categories won&#39;t be visible
                  </FieldDescription>
                </FieldContent>
                <Switch
                  id="isActive"
                  checked={field.state.value}
                  onCheckedChange={field.handleChange}
                />
              </Field>
            )}
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
            form="new-category-form"
            disabled={mutation.isPending}
          >
            {mutation.isPending && (
              <Loader className="mr-2 h-4 w-4 animate-spin" />
            )}
            Create Category
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
