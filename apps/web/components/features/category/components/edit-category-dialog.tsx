"use client";

import type { Category } from "@bikalpo-project/db/schema";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
} from "@/components/ui/dialog";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { updateCategorySchema } from "@/schema/category.scheam";
import { generateSlug } from "@/utils/generate-slug";
import { orpc } from "@/utils/orpc";

interface EditCategoryDialogProps {
  category: Category;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function EditCategoryDialog({
  category,
  open,
  onOpenChange,
}: EditCategoryDialogProps) {
  const queryClient = useQueryClient();

  // Fetch product types for dropdown — only when dialog is open
  const { data: typesData } = useQuery({
    ...orpc.adminProductType.getAll.queryOptions({ input: {} }),
    enabled: open,
  });
  const productTypes = typesData?.types ?? [];

  const mutation = useMutation(
    orpc.category.update.mutationOptions({
      onSuccess: (result) => {
        queryClient.invalidateQueries({ queryKey: orpc.category.getAll.key() });
        toast.success(result.message);
        onOpenChange(false);
      },
      onError: (error) => {
        toast.error(
          error.message ||
            "An unexpected error occurred while updating the category.",
        );
      },
    }),
  );

  const form = useForm({
    defaultValues: {
      id: category.id,
      name: category.name,
      slug: category.slug,
      image: category.image,
      isActive: category.isActive,
      displayOrder: category.displayOrder,
      typeId: category.typeId ?? null,
    },

    validators: {
      onSubmit: updateCategorySchema,
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Category</DialogTitle>
          <DialogDescription>
            Update the details of {category.name} category.
          </DialogDescription>
        </DialogHeader>
        <form
          id="edit-category-form"
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
                  {isInvalid && <FieldError errors={field.state.meta.errors} />}
                </Field>
              );
            }}
          </form.Field>

          {/* Name & Slug — side by side */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                    <FieldDescription>Auto-generated from name</FieldDescription>
                    {isInvalid && <FieldError errors={field.state.meta.errors} />}
                  </Field>
                );
              }}
            </form.Field>
          </div>

          {/* Type & Display Order — side by side */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <form.Field name="typeId">
              {(field) => (
                <Field>
                  <FieldLabel htmlFor="typeId">Product Type</FieldLabel>
                  <Select
                    value={field.state.value ? String(field.state.value) : "none"}
                    onValueChange={(v) =>
                      field.handleChange(v === "none" ? null : Number(v))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No Type</SelectItem>
                      {productTypes.map((t: any) => (
                        <SelectItem key={t.id} value={String(t.id)}>
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              )}
            </form.Field>

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
                    {isInvalid && <FieldError errors={field.state.meta.errors} />}
                  </Field>
                );
              }}
            </form.Field>
          </div>

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
            onClick={() => onOpenChange(false)}
            disabled={mutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="edit-category-form"
            disabled={mutation.isPending}
          >
            {mutation.isPending && (
              <Loader className="mr-2 h-4 w-4 animate-spin" />
            )}
            Update Category
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
