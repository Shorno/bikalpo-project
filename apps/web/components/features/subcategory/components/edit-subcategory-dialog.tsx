"use client";

import type { SubCategory } from "@bikalpo-project/db/schema";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as React from "react";
import { toast } from "sonner";
import { SetupFormDialog } from "@/components/features/product-setup";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateSubcategorySetupFormSchema } from "@/schema/category.scheam";
import { orpc } from "@/utils/orpc";

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
  const [selectedTypeId, setSelectedTypeId] = React.useState("");
  const { data: typesData } = useQuery({
    ...orpc.adminProductType.getAll.queryOptions({ input: {} }),
    enabled: open,
  });
  const { data: categoriesData } = useQuery({
    ...orpc.category.getAll.queryOptions(),
    enabled: open,
  });
  const currentCategory = categoriesData?.find(
    (category) => category.id === subcategory.categoryId,
  );
  const currentTypeId = currentCategory?.typeId ?? null;
  const productTypes = (typesData?.types ?? []).filter(
    (type) => type.isActive || type.id === currentTypeId,
  );
  const categories = (categoriesData ?? [])
    .filter(
      (category) =>
        category.id === subcategory.categoryId ||
        (category.isActive && category.typeId !== null),
    )
    .map((category) => ({
      id: category.id,
      name: category.name,
      typeId: category.typeId,
      isActive: category.isActive,
    }));
  const filteredCategories = React.useMemo(() => {
    if (!selectedTypeId) return categories;
    return categories.filter(
      (category) => category.typeId === Number(selectedTypeId),
    );
  }, [categories, selectedTypeId]);

  React.useEffect(() => {
    if (open && currentTypeId !== null) {
      setSelectedTypeId(String(currentTypeId));
    }
  }, [currentTypeId, open]);

  const mutation = useMutation(
    orpc.adminSubcategory.update.mutationOptions({
      onSuccess: (result) => {
        void queryClient.invalidateQueries({
          queryKey: orpc.adminSubcategory.getAllGlobal.key(),
        });
        void queryClient.invalidateQueries({
          queryKey: orpc.adminSubcategory.getById.key(),
        });
        void queryClient.invalidateQueries({
          queryKey: orpc.category.getAll.key(),
        });
        toast.success(result.message);
        onOpenChange(false);
      },
      onError: (error) => {
        toast.error(error.message || "Failed to update Sub Category.");
      },
    }),
  );

  const form = useForm({
    defaultValues: {
      id: subcategory.id,
      name: subcategory.name,
      categoryId: subcategory.categoryId,
      isActive: subcategory.isActive,
    },
    validators: {
      onSubmit: updateSubcategorySetupFormSchema as never,
    },
    onSubmit: async ({ value }) => {
      mutation.mutate({
        ...value,
        name: value.name.trim(),
        slug: subcategory.slug,
        image: subcategory.image ?? undefined,
        displayOrder: subcategory.displayOrder,
      });
    },
  });

  const handleOpenChange = (nextOpen: boolean) => {
    form.reset({
      id: subcategory.id,
      name: subcategory.name,
      categoryId: subcategory.categoryId,
      isActive: subcategory.isActive,
    });
    if (!nextOpen) setSelectedTypeId("");
    onOpenChange(nextOpen);
  };

  return (
    <SetupFormDialog
      description={`Update ${subcategory.name}.`}
      formId="edit-subcategory-form"
      hasUnsavedChanges={() => form.state.isDirty}
      isSubmitting={mutation.isPending}
      onOpenChange={handleOpenChange}
      onSubmit={() => form.handleSubmit()}
      open={open}
      submitLabel="Save Changes"
      title="Edit Sub Category"
    >
      <form
        className="space-y-5"
        id="edit-subcategory-form"
        onSubmit={(event) => {
          event.preventDefault();
          event.stopPropagation();
          form.handleSubmit();
        }}
      >
        <Field>
          <FieldLabel htmlFor="edit-subcategory-type">Type</FieldLabel>
          <Select
            onValueChange={(value) => {
              setSelectedTypeId(value);
              form.setFieldValue("categoryId", 0);
            }}
            value={selectedTypeId}
          >
            <SelectTrigger id="edit-subcategory-type">
              <SelectValue placeholder="Select Type" />
            </SelectTrigger>
            <SelectContent>
              {productTypes.map((type) => (
                <SelectItem key={type.id} value={String(type.id)}>
                  {type.name}
                  {!type.isActive && type.id === currentTypeId
                    ? " (Inactive, current)"
                    : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <form.Field name="categoryId">
          {(field) => {
            const isInvalid =
              field.state.meta.isTouched && !field.state.meta.isValid;
            return (
              <Field data-invalid={isInvalid}>
                <FieldLabel htmlFor="edit-subcategory-category">
                  Category
                </FieldLabel>
                <Select
                  onValueChange={(value) => field.handleChange(Number(value))}
                  value={field.state.value ? String(field.state.value) : ""}
                >
                  <SelectTrigger
                    aria-invalid={isInvalid}
                    id="edit-subcategory-category"
                  >
                    <SelectValue placeholder="Select Category" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredCategories.map((category) => (
                      <SelectItem key={category.id} value={String(category.id)}>
                        {category.name}
                        {!category.isActive &&
                        category.id === subcategory.categoryId
                          ? " (Inactive, current)"
                          : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {isInvalid && <FieldError errors={field.state.meta.errors} />}
              </Field>
            );
          }}
        </form.Field>

        <form.Field name="name">
          {(field) => {
            const isInvalid =
              field.state.meta.isTouched && !field.state.meta.isValid;
            return (
              <Field data-invalid={isInvalid}>
                <FieldLabel htmlFor={field.name}>Sub Category Name</FieldLabel>
                <Input
                  aria-invalid={isInvalid}
                  autoComplete="off"
                  id={field.name}
                  name={field.name}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  placeholder="Miniket"
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
                  htmlFor={`edit-subcategory-${subcategory.id}-active`}
                >
                  <RadioGroupItem
                    id={`edit-subcategory-${subcategory.id}-active`}
                    value="active"
                  />
                  <span className="text-sm font-medium">Active</span>
                </label>
                <label
                  className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 hover:bg-muted/30"
                  htmlFor={`edit-subcategory-${subcategory.id}-inactive`}
                >
                  <RadioGroupItem
                    id={`edit-subcategory-${subcategory.id}-inactive`}
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
