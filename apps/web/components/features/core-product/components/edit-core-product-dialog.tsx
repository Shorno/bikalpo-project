"use client";

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
import { Checkbox } from "@/components/ui/checkbox";


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

  const [selectedTypeId, setSelectedTypeId] = React.useState<number | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = React.useState<number>(coreProduct.categoryId);

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

  const { data: categoriesData } = useQuery(orpc.category.getAll.queryOptions());
  const allCategories = Array.isArray(categoriesData) ? categoriesData : [];



  const { data: subcategoriesData } = useQuery(
    orpc.adminSubcategory.getAllGlobal.queryOptions({ input: {} }),
  );
  const allSubcategories = Array.isArray(subcategoriesData) ? subcategoriesData : [];

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
  const initialTypeId = allCategories.find(
    (c: any) => c.id === coreProduct.categoryId,
  )?.typeId ?? null;

  const form = useForm({
    defaultValues: {
      sku: coreProduct.sku,
      name: coreProduct.name,
      slug: coreProduct.slug,
      description: coreProduct.description || "",
      image: coreProduct.image,
      categoryId: coreProduct.categoryId,
      subCategoryId: coreProduct.subCategoryId,

      typeId: initialTypeId,
      supportsPack: coreProduct.supportsPack ?? true,
      supportsLoose: coreProduct.supportsLoose ?? false,
    },
    onSubmit: async ({ value }) => {
      mutation.mutate({
        id: coreProduct.id,
        sku: value.sku,
        name: value.name,
        slug: value.slug,
        description: value.description || undefined,
        image: value.image,
        categoryId: value.categoryId,
        subCategoryId: value.subCategoryId,
        supportsPack: value.supportsPack,
        supportsLoose: value.supportsLoose,
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Core Product Identity</DialogTitle>
          <DialogDescription>
            Update the core product identity details.
          </DialogDescription>
        </DialogHeader>
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
              <Field>
                <FieldLabel htmlFor={field.name}>Product Image</FieldLabel>
                <ImageUploader
                  value={field.state.value}
                  onChange={field.handleChange}
                  folder="core-products"
                  maxSizeMB={5}
                />
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
                    <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">All Types</SelectItem>
                      {productTypes.map((t: any) => (
                        <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
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
                    <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0" disabled>Select category</SelectItem>
                      {filteredCategories.map((c: any) => (
                        <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
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
                    onValueChange={(v) => field.handleChange(v === "none" ? null : Number(v))}
                    disabled={filteredSubcategories.length === 0}
                  >
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {filteredSubcategories.map((sc: any) => (
                        <SelectItem key={sc.id} value={String(sc.id)}>{sc.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              )}
            </form.Field>
          </div>

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

          {/* Variant Type Support */}
          <div className="space-y-3">
            <FieldLabel>Variant Type Support</FieldLabel>
            <div className="flex items-center gap-6">
              <form.Field name="supportsPack">
                {(field) => (
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={field.state.value}
                      onCheckedChange={(checked) => field.handleChange(!!checked)}
                    />
                    <span className="text-sm">Pack Based</span>
                  </label>
                )}
              </form.Field>
              <form.Field name="supportsLoose">
                {(field) => (
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={field.state.value}
                      onCheckedChange={(checked) => field.handleChange(!!checked)}
                    />
                    <span className="text-sm">Loose</span>
                  </label>
                )}
              </form.Field>
            </div>
            <p className="text-xs text-muted-foreground">
              Select which variant types this product supports. Pack-based (e.g. 1KG, 5KG) and/or Loose (e.g. per KG).
            </p>
          </div>




        </form>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>Cancel</Button>
          <Button type="submit" form="edit-core-product-form" disabled={mutation.isPending}>
            {mutation.isPending && <Loader className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
