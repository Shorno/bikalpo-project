"use client";

import type { Category } from "@bikalpo-project/db/schema";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
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
import { updateCategorySchema } from "@/schema/category.scheam";
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
  const router = useRouter();
  const { data: typesData } = useQuery({
    ...orpc.adminProductType.getAll.queryOptions({ input: {} }),
    enabled: open,
  });
  const productTypes = (typesData?.types ?? []).filter(
    (type) => type.isActive || type.id === category.typeId,
  );

  const mutation = useMutation(
    orpc.category.update.mutationOptions({
      onSuccess: (result) => {
        void queryClient.invalidateQueries({
          queryKey: orpc.category.getAll.key(),
        });
        toast.success(result.message);
        onOpenChange(false);
        router.refresh();
      },
      onError: (error) => {
        toast.error(
          error.message ||
            "An unexpected error occurred while updating the Category.",
        );
      },
    }),
  );

  const form = useForm({
    defaultValues: {
      id: category.id,
      name: category.name,
      typeId: category.typeId ?? null,
      isActive: category.isActive,
    },
    validators: {
      onSubmit: updateCategorySchema as never,
    },
    onSubmit: async ({ value }) => {
      mutation.mutate({
        ...value,
        name: value.name.trim(),
        slug: category.slug,
        image: category.image ?? undefined,
        displayOrder: category.displayOrder,
      });
    },
  });

  const handleOpenChange = (nextOpen: boolean) => {
    form.reset({
      id: category.id,
      name: category.name,
      typeId: category.typeId ?? null,
      isActive: category.isActive,
    });
    onOpenChange(nextOpen);
  };

  return (
    <SetupFormDialog
      description={`Update ${category.name}.`}
      formId="edit-category-form"
      hasUnsavedChanges={() => form.state.isDirty}
      isSubmitting={mutation.isPending}
      onOpenChange={handleOpenChange}
      onSubmit={() => form.handleSubmit()}
      open={open}
      submitLabel="Save Changes"
      title="Edit Category"
    >
      <form
        className="space-y-5"
        id="edit-category-form"
        onSubmit={(event) => {
          event.preventDefault();
          event.stopPropagation();
          form.handleSubmit();
        }}
      >
        <form.Field name="typeId">
          {(field) => (
            <Field>
              <FieldLabel htmlFor="edit-category-type">Type</FieldLabel>
              <Select
                onValueChange={(value) => field.handleChange(Number(value))}
                value={
                  field.state.value === null
                    ? "legacy-unassigned"
                    : String(field.state.value)
                }
              >
                <SelectTrigger id="edit-category-type">
                  <SelectValue placeholder="Select Type" />
                </SelectTrigger>
                <SelectContent>
                  {category.typeId === null && (
                    <SelectItem disabled value="legacy-unassigned">
                      Legacy unassigned
                    </SelectItem>
                  )}
                  {productTypes.map((type) => (
                    <SelectItem key={type.id} value={String(type.id)}>
                      {type.name}
                      {!type.isActive && type.id === category.typeId
                        ? " (Inactive, current)"
                        : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}
        </form.Field>

        <form.Field name="name">
          {(field) => {
            const isInvalid =
              field.state.meta.isTouched && !field.state.meta.isValid;
            return (
              <Field data-invalid={isInvalid}>
                <FieldLabel htmlFor={field.name}>Category Name</FieldLabel>
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
                  htmlFor={`edit-category-${category.id}-active`}
                >
                  <RadioGroupItem
                    id={`edit-category-${category.id}-active`}
                    value="active"
                  />
                  <span className="text-sm font-medium">Active</span>
                </label>
                <label
                  className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 hover:bg-muted/30"
                  htmlFor={`edit-category-${category.id}-inactive`}
                >
                  <RadioGroupItem
                    id={`edit-category-${category.id}-inactive`}
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
