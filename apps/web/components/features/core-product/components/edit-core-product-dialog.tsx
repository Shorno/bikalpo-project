"use client";

import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as React from "react";
import { toast } from "sonner";
import { SetupFormDialog } from "@/components/features/product-setup";
import ImageUploader from "@/components/ImageUploader";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

import { generateSlug } from "@/utils/generate-slug";
import { orpc } from "@/utils/orpc";
import type { CoreProductWithRelations } from "./core-product-columns";

interface EditCoreProductDialogProps {
  coreProduct: CoreProductWithRelations;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function EditCoreProductDialog({
  coreProduct,
  open,
  onOpenChange,
}: EditCoreProductDialogProps) {
  const [selectedTypeId, setSelectedTypeId] = React.useState<number | null>(
    null,
  );
  const [selectedCategoryId, setSelectedCategoryId] = React.useState<number>(
    coreProduct.categoryId,
  );

  const queryClient = useQueryClient();

  // Reset state when coreProduct changes
  React.useEffect(() => {
    setSelectedCategoryId(coreProduct.categoryId);
  }, [coreProduct]);

  // Fetch reference data
  const { data: typesData } = useQuery(
    orpc.adminProductType.getAll.queryOptions({ input: {} }),
  );
  const productTypes = typesData?.types ?? [];

  const { data: categoriesData } = useQuery(
    orpc.category.getAll.queryOptions(),
  );
  const allCategories = Array.isArray(categoriesData) ? categoriesData : [];

  const { data: subcategoriesData } = useQuery(
    orpc.adminSubcategory.getAllGlobal.queryOptions({ input: {} }),
  );
  const allSubcategories = Array.isArray(subcategoriesData)
    ? subcategoriesData
    : [];

  const mutation = useMutation(
    orpc.adminCoreProduct.update.mutationOptions({
      onSuccess: (result: any) => {
        queryClient.invalidateQueries({
          queryKey: orpc.adminCoreProduct.getAll.key(),
        });
        queryClient.invalidateQueries({
          queryKey: orpc.adminCoreProduct.getById.key(),
        });
        toast.success(result.message || "Core product updated successfully");
        onOpenChange(false);
      },
      onError: (error: any) => {
        toast.error(error.message || "Failed to update core product");
      },
    }),
  );

  // Determine initial typeId from category
  const initialTypeId =
    allCategories.find((c: any) => c.id === coreProduct.categoryId)?.typeId ??
    null;

  React.useEffect(() => {
    setSelectedTypeId(initialTypeId);
  }, [initialTypeId]);

  const form = useForm({
    defaultValues: {
      sku: coreProduct.sku,
      name: coreProduct.name,
      slug: coreProduct.slug,
      description: coreProduct.description || "",
      image: coreProduct.image,
      categoryId: coreProduct.categoryId,
      subCategoryId: coreProduct.subCategoryId,
      isActive: coreProduct.isActive,

      typeId: initialTypeId,
    },
    onSubmit: async ({ value }) => {
      if (!value.image.trim()) {
        toast.error("Product image is required");
        return;
      }

      mutation.mutate({
        id: coreProduct.id,
        sku: value.sku,
        name: value.name,
        slug: value.slug,
        description: value.description || undefined,
        image: value.image,
        categoryId: value.categoryId,
        subCategoryId: value.subCategoryId,
        isActive: value.isActive,
      });
    },
  });

  const autoGenerateSlugFromName = (value: string) => {
    form.setFieldValue("slug", generateSlug(value));
  };

  // Filter cascades
  const filteredCategories = selectedTypeId
    ? allCategories.filter((c: any) => c.typeId === selectedTypeId)
    : allCategories;

  const filteredSubcategories = selectedCategoryId
    ? allSubcategories.filter((sc: any) => sc.categoryId === selectedCategoryId)
    : [];

  return (
    <SetupFormDialog
      description={`Update the setup details for ${coreProduct.name}.`}
      formId="edit-core-product-form"
      hasUnsavedChanges={() => form.state.isDirty}
      isSubmitting={mutation.isPending}
      onOpenChange={onOpenChange}
      onSubmit={() => form.handleSubmit()}
      open={open}
      size="large"
      submitLabel="Save Changes"
      title="Edit Core Identity"
    >
      <form
        id="edit-core-product-form"
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          form.handleSubmit();
        }}
        className="space-y-6"
      >
        {/* Image */}
        <form.Field name="image">
          {(field) => (
            <Field data-invalid={!field.state.value.trim()}>
              <FieldLabel htmlFor={field.name}>Product Image *</FieldLabel>
              <ImageUploader
                value={field.state.value}
                onChange={field.handleChange}
                folder="core-products"
                maxSizeMB={5}
              />
              {!field.state.value.trim() && (
                <p className="text-sm text-destructive">
                  Product image is required
                </p>
              )}
            </Field>
          )}
        </form.Field>

        {/* SKU, Name, Slug */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <form.Field name="sku">
            {(field) => (
              <Field>
                <FieldLabel htmlFor={field.name}>SKU *</FieldLabel>
                <Input
                  id={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="001"
                />
                <FieldDescription>Unique identifier</FieldDescription>
              </Field>
            )}
          </form.Field>

          <form.Field name="name">
            {(field) => (
              <Field>
                <FieldLabel htmlFor={field.name}>Product Name *</FieldLabel>
                <Input
                  id={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => {
                    field.handleChange(e.target.value);
                    autoGenerateSlugFromName(e.target.value);
                  }}
                  placeholder="Miniket Rice"
                />
              </Field>
            )}
          </form.Field>

          <form.Field name="slug">
            {(field) => (
              <Field>
                <FieldLabel htmlFor={field.name}>Slug *</FieldLabel>
                <Input
                  id={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="miniket-rice"
                />
              </Field>
            )}
          </form.Field>
        </div>

        {/* Type → Category → SubCategory */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <form.Field name="typeId">
            {(field) => (
              <Field>
                <FieldLabel>Type</FieldLabel>
                <Select
                  value={field.state.value ? String(field.state.value) : "none"}
                  onValueChange={(v) => {
                    const val = v === "none" ? null : Number(v);
                    field.handleChange(val);
                    setSelectedTypeId(val);
                    form.setFieldValue("categoryId", 0);
                    setSelectedCategoryId(0);
                    form.setFieldValue("subCategoryId", null);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">All Types</SelectItem>
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

          <form.Field name="categoryId">
            {(field) => (
              <Field>
                <FieldLabel>Category *</FieldLabel>
                <Select
                  value={field.state.value ? String(field.state.value) : "0"}
                  onValueChange={(v) => {
                    const val = Number(v);
                    field.handleChange(val);
                    setSelectedCategoryId(val);
                    form.setFieldValue("subCategoryId", null);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0" disabled>
                      Select category
                    </SelectItem>
                    {filteredCategories.map((c: any) => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}
          </form.Field>

          <form.Field name="subCategoryId">
            {(field) => (
              <Field>
                <FieldLabel>Sub Category</FieldLabel>
                <Select
                  value={field.state.value ? String(field.state.value) : "none"}
                  onValueChange={(v) =>
                    field.handleChange(v === "none" ? null : Number(v))
                  }
                  disabled={filteredSubcategories.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {filteredSubcategories.map((sc: any) => (
                      <SelectItem key={sc.id} value={String(sc.id)}>
                        {sc.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}
          </form.Field>
        </div>

        <form.Field name="isActive">
          {(field) => (
            <Field className="flex min-h-16 flex-row items-center justify-between rounded-lg border px-4 py-3">
              <div>
                <FieldLabel>Status</FieldLabel>
                <FieldDescription>
                  Available for new product configuration
                </FieldDescription>
              </div>
              <Switch
                checked={field.state.value}
                onCheckedChange={field.handleChange}
              />
            </Field>
          )}
        </form.Field>

        {/* Description */}
        <form.Field name="description">
          {(field) => (
            <Field>
              <FieldLabel>Description</FieldLabel>
              <Input
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                placeholder="Optional description"
              />
            </Field>
          )}
        </form.Field>
      </form>
    </SetupFormDialog>
  );
}
