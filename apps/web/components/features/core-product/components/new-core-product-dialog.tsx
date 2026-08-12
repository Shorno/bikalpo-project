"use client";

import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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

export default function NewCoreProductDialog() {
  const [open, setOpen] = React.useState(false);

  const [selectedTypeId, setSelectedTypeId] = React.useState<number | null>(
    null,
  );
  const [selectedCategoryId, setSelectedCategoryId] = React.useState<number>(0);
  const queryClient = useQueryClient();

  // Fetch types, categories, subcategories, brands
  const { data: typesData } = useQuery(
    orpc.adminProductType.getAll.queryOptions({ input: {} }),
  );
  const productTypes = (typesData?.types ?? []).filter((type) => type.isActive);

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
    orpc.adminCoreProduct.create.mutationOptions({
      onSuccess: (result: any) => {
        queryClient.invalidateQueries({
          queryKey: orpc.adminCoreProduct.getAll.key(),
        });
        toast.success(result.message || "Core product created successfully");
        form.reset();
        setOpen(false);
      },
      onError: (error: any) => {
        toast.error(error.message || "Failed to create core product");
      },
    }),
  );

  const form = useForm({
    defaultValues: {
      sku: "",
      name: "",
      slug: "",
      description: "",
      image: "",
      categoryId: 0,
      subCategoryId: null as number | null,
      isActive: true,
      brandCreationMode: "batch" as "batch" | "single",

      typeId: null as number | null,
    },
    onSubmit: async ({ value }) => {
      if (!value.image.trim()) {
        toast.error("Product image is required");
        return;
      }

      mutation.mutate({
        sku: value.sku.trim() || undefined,
        name: value.name,
        slug: value.slug,
        description: value.description || undefined,
        image: value.image,
        categoryId: value.categoryId,
        subCategoryId: value.subCategoryId,
        isActive: value.isActive,
        brandCreationMode: value.brandCreationMode,
      });
    },
  });

  const autoGenerateSlugFromName = (value: string) => {
    form.setFieldValue("slug", generateSlug(value));
  };

  // Filter categories by selected type
  const filteredCategories = selectedTypeId
    ? allCategories.filter(
        (c: any) => c.typeId === selectedTypeId && c.isActive,
      )
    : allCategories;

  // Filter subcategories by selected category
  const filteredSubcategories = selectedCategoryId
    ? allSubcategories.filter(
        (sc: any) => sc.categoryId === selectedCategoryId && sc.isActive,
      )
    : [];

  return (
    <SetupFormDialog
      description="Define a reusable Core Identity within the Product Setup hierarchy."
      formId="new-core-product-form"
      hasUnsavedChanges={() => form.state.isDirty || selectedTypeId !== null}
      isSubmitting={mutation.isPending}
      onOpenChange={setOpen}
      onSubmit={() => form.handleSubmit()}
      open={open}
      size="large"
      submitLabel="Create Core Identity"
      title="Create Core Identity"
      trigger={<Button>Create Core Identity</Button>}
    >
      <form
        id="new-core-product-form"
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
            <Field
              data-invalid={
                !field.state.value.trim() ||
                (field.state.meta.isTouched && !field.state.meta.isValid)
              }
            >
              <FieldLabel htmlFor={field.name}>Product Image *</FieldLabel>
              <ImageUploader
                value={field.state.value}
                onChange={field.handleChange}
                folder="core-products"
                maxSizeMB={5}
              />
              {!field.state.value.trim() ? (
                <FieldError
                  errors={[{ message: "Product image is required" }]}
                />
              ) : field.state.meta.isTouched && !field.state.meta.isValid ? (
                <FieldError errors={field.state.meta.errors} />
              ) : null}
            </Field>
          )}
        </form.Field>

        {/* Name, Slug */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <form.Field name="sku">
            {(field) => (
              <Field>
                <FieldLabel htmlFor={field.name}>SKU</FieldLabel>
                <Input
                  id={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="e.g. 003 (leave empty to auto-generate)"
                  autoComplete="off"
                />
                <FieldDescription>
                  Leave empty to auto-generate
                </FieldDescription>
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
                  autoComplete="off"
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
                  autoComplete="off"
                />
                <FieldDescription>Auto-generated</FieldDescription>
              </Field>
            )}
          </form.Field>
        </div>

        {/* Type → Category → SubCategory cascade */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <form.Field name="typeId">
            {(field) => (
              <Field>
                <FieldLabel htmlFor={field.name}>Type</FieldLabel>
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
                <FieldLabel htmlFor={field.name}>Category *</FieldLabel>
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
                <FieldLabel htmlFor={field.name}>Sub Category</FieldLabel>
                <Select
                  value={field.state.value ? String(field.state.value) : "none"}
                  onValueChange={(v) =>
                    field.handleChange(v === "none" ? null : Number(v))
                  }
                  disabled={filteredSubcategories.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select subcategory" />
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

        <form.Field name="brandCreationMode">
          {(field) => (
            <Field className="flex min-h-16 flex-row items-center justify-between rounded-lg border px-4 py-3">
              <div>
                <FieldLabel>Create one brand at a time</FieldLabel>
                <FieldDescription>
                  When enabled, each save creates or edits exactly one Brand
                  Product.
                </FieldDescription>
              </div>
              <Switch
                checked={field.state.value === "single"}
                onCheckedChange={(checked) =>
                  field.handleChange(checked ? "single" : "batch")
                }
              />
            </Field>
          )}
        </form.Field>

        {/* Description */}
        <form.Field name="description">
          {(field) => (
            <Field>
              <FieldLabel htmlFor={field.name}>Description</FieldLabel>
              <Input
                id={field.name}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                placeholder="Optional description"
                autoComplete="off"
              />
            </Field>
          )}
        </form.Field>
      </form>
    </SetupFormDialog>
  );
}
