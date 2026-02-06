"use client";

import { useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FolderPlus, Loader, Plus } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import createSubcategory from "@/actions/subcategory/create-subcategory";
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
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { createSubcategorySchema } from "@/schema/category.scheam";
import { generateSlug } from "@/utils/generate-slug";

interface NewSubcategoryDialogProps {
  categoryId: number;
  categoryName: string;
  variant?: "default" | "expanded" | "menu";
}

export default function NewSubcategoryDialog({
  categoryId,
  categoryName,
  variant = "default",
}: NewSubcategoryDialogProps) {
  const [open, setOpen] = React.useState(false);
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: createSubcategory,
    onSuccess: (result) => {
      if (!result.success) {
        switch (result.status) {
          case 400:
            toast.error("Invalid subcategory data.", {
              description: "Please check your form inputs.",
            });
            break;
          case 401:
            toast.error("You are not authorized to perform this action.");
            break;
          default:
            toast.error(result.error || "Something went wrong.");
        }
        return;
      }
      queryClient.invalidateQueries({
        queryKey: ["admin-subcategories", categoryId],
      });
      queryClient.invalidateQueries({ queryKey: ["admin-categories"] });
      toast.success(result.message);
      form.reset();
      setOpen(false);
    },
    onError: () => {
      toast.error(
        "An unexpected error occurred while creating the subcategory.",
      );
    },
  });

  const form = useForm({
    defaultValues: {
      name: "",
      slug: "",
      image: "",
      isActive: true,
      displayOrder: 0,
      categoryId: categoryId,
    },

    validators: {
      onSubmit: createSubcategorySchema,
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
        {variant === "expanded" ? (
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-foreground"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add subcategory to {categoryName}
          </Button>
        ) : variant === "menu" ? (
          <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
            <FolderPlus className="h-4 w-4 mr-2" />
            Add Subcategory
          </DropdownMenuItem>
        ) : (
          <Button variant="default" size="sm">
            <Plus className="h-4 w-4 mr-1" />
            Add
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Subcategory</DialogTitle>
          <DialogDescription>
            Add a new subcategory under {categoryName}.
          </DialogDescription>
        </DialogHeader>
        <form
          id="new-subcategory-form"
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
                  <FieldLabel htmlFor={field.name}>
                    Subcategory Image
                  </FieldLabel>
                  <ImageUploader
                    value={field.state.value}
                    onChange={field.handleChange}
                    folder="subcategories"
                    maxSizeMB={5}
                  />
                  <FieldDescription>Upload an image (max 5MB)</FieldDescription>
                  {isInvalid && <FieldError errors={field.state.meta.errors} />}
                </Field>
              );
            }}
          </form.Field>

          {/* Subcategory Name */}
          <form.Field name="name">
            {(field) => {
              const isInvalid =
                field.state.meta.isTouched && !field.state.meta.isValid;
              return (
                <Field data-invalid={isInvalid}>
                  <FieldLabel htmlFor={field.name}>
                    Subcategory Name *
                  </FieldLabel>
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
                    placeholder="Smartphones"
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
                    placeholder="smartphones"
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
                    Inactive subcategories won&#39;t be visible
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
            form="new-subcategory-form"
            disabled={mutation.isPending}
          >
            {mutation.isPending && (
              <Loader className="mr-2 h-4 w-4 animate-spin" />
            )}
            Create Subcategory
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
