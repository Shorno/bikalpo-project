"use client";

import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FolderPlus, Loader, Plus } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { createSubcategorySchema } from "@/schema/category.scheam";
import { generateSlug } from "@/utils/generate-slug";
import { client } from "@/utils/orpc";
import { orpc } from "@/utils/orpc";

interface NewSubcategoryDialogProps {
  /** Pre-set category context (used when creating from within a category page) */
  categoryId?: number;
  categoryName?: string;
  /** Variant controls the trigger button style */
  variant?: "default" | "expanded" | "menu" | "standalone";
  /** Categories list for standalone variant (type→category cascade) */
  categories?: { id: number; name: string; typeId: number | null }[];
}

export default function NewSubcategoryDialog({
  categoryId,
  categoryName,
  variant = "default",
  categories = [],
}: NewSubcategoryDialogProps) {
  const [open, setOpen] = React.useState(false);
  const queryClient = useQueryClient();

  // Fetch product types for the standalone cascade dropdown — only when dialog is open
  const { data: typesData } = useQuery({
    ...orpc.adminProductType.getAll.queryOptions({ input: {} }),
    enabled: open && variant === "standalone",
  });
  const productTypes = typesData?.types ?? [];

  // Local type filter for cascade
  const [selectedTypeId, setSelectedTypeId] = React.useState<string>("");

  // Categories filtered by selected type
  const filteredCategories = React.useMemo(() => {
    if (!selectedTypeId) return categories;
    return categories.filter((c) => c.typeId === Number(selectedTypeId));
  }, [categories, selectedTypeId]);

  const mutation = useMutation({
    mutationFn: (data: Parameters<typeof client.adminSubcategory.create>[0]) =>
      client.adminSubcategory.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["admin-subcategories"],
      });
      queryClient.invalidateQueries({ queryKey: ["admin-categories"] });
      queryClient.invalidateQueries({ queryKey: ["adminSubcategory"] });
      toast.success("Subcategory created successfully");
      form.reset();
      setSelectedTypeId("");
      setOpen(false);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to create subcategory.");
    },
  });

  const form = useForm({
    defaultValues: {
      name: "",
      slug: "",
      image: "",
      isActive: true,
      displayOrder: 0,
      categoryId: categoryId ?? 0,
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

  const triggerButton = () => {
    switch (variant) {
      case "standalone":
        return (
          <Button variant="default" size="sm">
            <Plus className="h-4 w-4 mr-1" />
            New Subcategory
          </Button>
        );
      case "expanded":
        return (
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-foreground"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add subcategory to {categoryName}
          </Button>
        );
      default:
        return (
          <Button variant="default" size="sm">
            <Plus className="h-4 w-4 mr-1" />
            Add
          </Button>
        );
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{triggerButton()}</DialogTrigger>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Subcategory</DialogTitle>
          <DialogDescription>
            {categoryName
              ? `Add a new subcategory under ${categoryName}.`
              : "Add a new subcategory."}
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
          {/* Type → Category cascade (side by side) */}
          {variant === "standalone" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field>
                <FieldLabel>Product Type</FieldLabel>
                <Select
                  value={selectedTypeId}
                  onValueChange={(v) => {
                    setSelectedTypeId(v);
                    form.setFieldValue("categoryId", 0);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a type" />
                  </SelectTrigger>
                  <SelectContent>
                    {productTypes.map((t) => (
                      <SelectItem key={t.id} value={String(t.id)}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldDescription>
                  Filter categories by type
                </FieldDescription>
              </Field>

              <form.Field name="categoryId">
                {(field) => {
                  const isInvalid =
                    field.state.meta.isTouched && !field.state.meta.isValid;
                  return (
                    <Field data-invalid={isInvalid}>
                      <FieldLabel>Category *</FieldLabel>
                      <Select
                        value={
                          field.state.value ? String(field.state.value) : ""
                        }
                        onValueChange={(v) => field.handleChange(Number(v))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a category" />
                        </SelectTrigger>
                        <SelectContent>
                          {filteredCategories.map((c) => (
                            <SelectItem key={c.id} value={String(c.id)}>
                              {c.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {isInvalid && (
                        <FieldError errors={field.state.meta.errors} />
                      )}
                    </Field>
                  );
                }}
              </form.Field>
            </div>
          )}

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
                  {isInvalid && (
                    <FieldError errors={field.state.meta.errors} />
                  )}
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
                      placeholder="e.g. Miniket"
                      autoComplete="off"
                    />
                    {isInvalid && (
                      <FieldError errors={field.state.meta.errors} />
                    )}
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
                      placeholder="miniket"
                      autoComplete="off"
                    />
                    <FieldDescription>
                      URL-friendly version of the name
                    </FieldDescription>
                    {isInvalid && (
                      <FieldError errors={field.state.meta.errors} />
                    )}
                  </Field>
                );
              }}
            </form.Field>
          </div>

          {/* Display Order & Active Status — side by side */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                      onChange={(e) =>
                        field.handleChange(Number(e.target.value))
                      }
                      aria-invalid={isInvalid}
                      placeholder="0"
                      min={0}
                      autoComplete="off"
                    />
                    <FieldDescription>
                      Lower numbers appear first
                    </FieldDescription>
                    {isInvalid && (
                      <FieldError errors={field.state.meta.errors} />
                    )}
                  </Field>
                );
              }}
            </form.Field>

            <form.Field name="isActive">
              {(field) => (
                <Field orientation="horizontal">
                  <FieldContent>
                    <FieldLabel htmlFor={field.name}>Active Status</FieldLabel>
                    <FieldDescription>
                      Inactive subcategories won&apos;t be visible
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
          </div>
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
