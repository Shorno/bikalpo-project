"use client";

import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { SetupFormDialog } from "@/components/features/product-setup";
import { Button } from "@/components/ui/button";
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
import { subcategorySetupFormSchema } from "@/schema/category.scheam";
import { generateSlug } from "@/utils/generate-slug";
import { orpc } from "@/utils/orpc";

interface NewSubcategoryDialogProps {
  categoryId?: number;
  categoryName?: string;
  variant?: "default" | "expanded" | "menu" | "standalone";
  categories?: { id: number; name: string; typeId: number | null }[];
  triggerLabel?: string;
}

export default function NewSubcategoryDialog({
  categoryId,
  categoryName,
  variant = "default",
  categories = [],
  triggerLabel = "Create Sub Category",
}: NewSubcategoryDialogProps) {
  const [open, setOpen] = React.useState(false);
  const [selectedTypeId, setSelectedTypeId] = React.useState("");
  const queryClient = useQueryClient();
  const { data: typesData } = useQuery({
    ...orpc.adminProductType.getAll.queryOptions({ input: {} }),
    enabled: open && variant === "standalone",
  });
  const productTypes = (typesData?.types ?? []).filter((type) => type.isActive);
  const filteredCategories = React.useMemo(() => {
    const assignableCategories = categories.filter(
      (category) => category.typeId !== null,
    );
    if (!selectedTypeId) return assignableCategories;
    return assignableCategories.filter(
      (category) => category.typeId === Number(selectedTypeId),
    );
  }, [categories, selectedTypeId]);

  const mutation = useMutation(
    orpc.adminSubcategory.create.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({
          queryKey: orpc.adminSubcategory.getAllGlobal.key(),
        });
        void queryClient.invalidateQueries({
          queryKey: orpc.category.getAll.key(),
        });
        toast.success("Sub Category created successfully");
        form.reset();
        setSelectedTypeId("");
        setOpen(false);
      },
      onError: (error) => {
        toast.error(error.message || "Failed to create Sub Category.");
      },
    }),
  );

  const form = useForm({
    defaultValues: {
      name: "",
      categoryId: categoryId ?? 0,
      isActive: true,
    },
    validators: {
      onSubmit: subcategorySetupFormSchema as never,
    },
    onSubmit: async ({ value }) => {
      const name = value.name.trim();
      mutation.mutate({
        name,
        slug: generateSlug(name),
        categoryId: value.categoryId,
        isActive: value.isActive,
      });
    },
  });

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      form.reset();
      setSelectedTypeId("");
    }
    setOpen(nextOpen);
  };

  const triggerButton = () => {
    switch (variant) {
      case "standalone":
        return (
          <Button size="sm">
            <Plus aria-hidden="true" className="size-4" />
            {triggerLabel}
          </Button>
        );
      case "expanded":
        return (
          <Button
            className="text-muted-foreground hover:text-foreground"
            size="sm"
            variant="ghost"
          >
            <Plus aria-hidden="true" className="size-4" />
            Add Sub Category to {categoryName}
          </Button>
        );
      default:
        return (
          <Button size="sm">
            <Plus aria-hidden="true" className="size-4" />
            Add
          </Button>
        );
    }
  };

  return (
    <SetupFormDialog
      description={
        categoryName
          ? `Add a Sub Category under ${categoryName}.`
          : "Add a Sub Category to the product taxonomy."
      }
      formId="new-subcategory-form"
      hasUnsavedChanges={() => form.state.isDirty || Boolean(selectedTypeId)}
      isSubmitting={mutation.isPending}
      onOpenChange={handleOpenChange}
      onSubmit={() => form.handleSubmit()}
      open={open}
      submitLabel="Create Sub Category"
      title="Create Sub Category"
      trigger={triggerButton()}
    >
      <form
        className="space-y-5"
        id="new-subcategory-form"
        onSubmit={(event) => {
          event.preventDefault();
          event.stopPropagation();
          form.handleSubmit();
        }}
      >
        {variant === "standalone" && (
          <>
            <Field>
              <FieldLabel htmlFor="new-subcategory-type">Type</FieldLabel>
              <Select
                onValueChange={(value) => {
                  setSelectedTypeId(value);
                  form.setFieldValue("categoryId", 0);
                }}
                value={selectedTypeId}
              >
                <SelectTrigger id="new-subcategory-type">
                  <SelectValue placeholder="Select Type" />
                </SelectTrigger>
                <SelectContent>
                  {productTypes.map((type) => (
                    <SelectItem key={type.id} value={String(type.id)}>
                      {type.name}
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
                    <FieldLabel htmlFor={field.name}>Category</FieldLabel>
                    <Select
                      onValueChange={(value) =>
                        field.handleChange(Number(value))
                      }
                      value={field.state.value ? String(field.state.value) : ""}
                    >
                      <SelectTrigger aria-invalid={isInvalid} id={field.name}>
                        <SelectValue placeholder="Select Category" />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredCategories.map((category) => (
                          <SelectItem
                            key={category.id}
                            value={String(category.id)}
                          >
                            {category.name}
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
          </>
        )}

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
                  htmlFor="new-subcategory-active"
                >
                  <RadioGroupItem id="new-subcategory-active" value="active" />
                  <span className="text-sm font-medium">Active</span>
                </label>
                <label
                  className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 hover:bg-muted/30"
                  htmlFor="new-subcategory-inactive"
                >
                  <RadioGroupItem
                    id="new-subcategory-inactive"
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
