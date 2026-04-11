"use client";

import type { SubCategory } from "@bikalpo-project/db/schema";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader, Pencil } from "lucide-react";
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
import { updateSubcategorySchema } from "@/schema/category.scheam";
import { generateSlug } from "@/utils/generate-slug";
import { client, orpc } from "@/utils/orpc";

interface EditSubcategoryDialogProps {
  subcategory: SubCategory;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function EditSubcategoryDialog({
  subcategory,
  open,
  onOpenChange,
}: EditSubcategoryDialogProps) {
  const queryClient = useQueryClient();

  // Fetch types & categories for cascade dropdown
  const { data: typesData } = useQuery({
    ...orpc.adminProductType.getAll.queryOptions({ input: {} }),
    enabled: open,
  });
  const productTypes = typesData?.types ?? [];

  const { data: categoriesData } = useQuery({
    ...orpc.category.getAll.queryOptions(),
    enabled: open,
  });
  const allCategories = (categoriesData ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    typeId: c.typeId,
  }));

  // Derive initial type from the subcategory's category
  const initialTypeId = React.useMemo(() => {
    if (!categoriesData) return "";
    const cat = categoriesData.find((c) => c.id === subcategory.categoryId);
    return cat?.typeId ? String(cat.typeId) : "";
  }, [categoriesData, subcategory.categoryId]);

  const [selectedTypeId, setSelectedTypeId] = React.useState<string>("");

  // Set initial type when data loads
  React.useEffect(() => {
    if (initialTypeId && !selectedTypeId) {
      setSelectedTypeId(initialTypeId);
    }
  }, [initialTypeId]);

  const filteredCategories = React.useMemo(() => {
    if (!selectedTypeId) return allCategories;
    return allCategories.filter((c) => c.typeId === Number(selectedTypeId));
  }, [allCategories, selectedTypeId]);

  const mutation = useMutation({
    mutationFn: (data: Parameters<typeof client.adminSubcategory.update>[0]) =>
      client.adminSubcategory.update(data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["admin-subcategories", subcategory.categoryId],
      });
      queryClient.invalidateQueries({ queryKey: ["admin-categories"] });
      queryClient.invalidateQueries({ queryKey: ["adminSubcategory"] });
      toast.success("Subcategory updated successfully");
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update subcategory.");
    },
  });

  const form = useForm({
    defaultValues: {
      id: subcategory.id,
      name: subcategory.name,
      slug: subcategory.slug,
      image: subcategory.image,
      isActive: subcategory.isActive,
      displayOrder: subcategory.displayOrder,
      categoryId: subcategory.categoryId,
    },

    validators: {
      onSubmit: updateSubcategorySchema,
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
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Subcategory</DialogTitle>
          <DialogDescription>
            Update the details of {subcategory.name} subcategory.
          </DialogDescription>
        </DialogHeader>
        <form
          id="edit-subcategory-form"
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            form.handleSubmit();
          }}
          className="space-y-4"
        >
          {/* Type → Category (side by side) */}
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
                      URL-friendly version of the name
                    </FieldDescription>
                    {isInvalid && <FieldError errors={field.state.meta.errors} />}
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
            form="edit-subcategory-form"
            disabled={mutation.isPending}
          >
            {mutation.isPending && (
              <Loader className="mr-2 h-4 w-4 animate-spin" />
            )}
            Update Subcategory
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
