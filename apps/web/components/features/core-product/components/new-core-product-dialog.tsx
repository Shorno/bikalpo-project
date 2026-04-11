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

import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { generateSlug } from "@/utils/generate-slug";
import { orpc } from "@/utils/orpc";



export default function NewCoreProductDialog() {
  const [open, setOpen] = React.useState(false);
  const [selectedBrandIds, setSelectedBrandIds] = React.useState<number[]>([]);
  const [defaultBrandId, setDefaultBrandId] = React.useState<
    number | undefined
  >(undefined);
  const [selectedTypeId, setSelectedTypeId] = React.useState<number | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = React.useState<number>(0);
  const queryClient = useQueryClient();

  // Fetch types, categories, subcategories, brands
  const { data: typesData } = useQuery(
    orpc.adminProductType.getAll.queryOptions({ input: {} }),
  );
  const productTypes = typesData?.types ?? [];

  const { data: categoriesData } = useQuery(
    orpc.category.getAll.queryOptions(),
  );
  const allCategories = Array.isArray(categoriesData) ? categoriesData : [];

  const { data: brandsData } = useQuery(orpc.brand.getAll.queryOptions());
  const allBrands = Array.isArray(brandsData) ? brandsData : [];

  const { data: subcategoriesData } = useQuery(
    orpc.adminSubcategory.getAllGlobal.queryOptions({ input: {} }),
  );
  const allSubcategories = Array.isArray(subcategoriesData) ? subcategoriesData : [];

  const mutation = useMutation(
    orpc.adminCoreProduct.create.mutationOptions({
      onSuccess: (result: any) => {
        queryClient.invalidateQueries({
          queryKey: orpc.adminCoreProduct.getAll.key(),
        });
        toast.success(result.message || "Core product created successfully");
        form.reset();
        setSelectedBrandIds([]);
        setDefaultBrandId(undefined);
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
      brandSupport: "multi_brand" as "multi_brand" | "single_brand",
      status: "active" as "active" | "draft" | "inactive",
      displayOrder: 0,
      typeId: null as number | null,
    },
    onSubmit: async ({ value }) => {
      mutation.mutate({
        sku: value.sku,
        name: value.name,
        slug: value.slug,
        description: value.description || undefined,
        image: value.image,
        categoryId: value.categoryId,
        subCategoryId: value.subCategoryId,
        brandSupport: value.brandSupport,
        status: value.status,
        displayOrder: value.displayOrder,
        brandIds: selectedBrandIds,
        defaultBrandId,
      });
    },
  });

  const autoGenerateSlugFromName = (value: string) => {
    form.setFieldValue("slug", generateSlug(value));
  };

  // Filter categories by selected type
  const filteredCategories = selectedTypeId
    ? allCategories.filter((c: any) => c.typeId === selectedTypeId)
    : allCategories;

  // Filter subcategories by selected category
  const filteredSubcategories = selectedCategoryId
    ? allSubcategories.filter((sc: any) => sc.categoryId === selectedCategoryId)
    : [];



  const toggleBrand = (brandId: number) => {
    setSelectedBrandIds((prev) =>
      prev.includes(brandId)
        ? prev.filter((id) => id !== brandId)
        : [...prev, brandId],
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>New Core Product</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Core Product Identity</DialogTitle>
          <DialogDescription>
            Define a new global product identity that all sellers must follow.
          </DialogDescription>
        </DialogHeader>
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
                  field.state.meta.isTouched && !field.state.meta.isValid
                }
              >
                <FieldLabel htmlFor={field.name}>Product Image</FieldLabel>
                <ImageUploader
                  value={field.state.value}
                  onChange={field.handleChange}
                  folder="core-products"
                  maxSizeMB={5}
                />
                {field.state.meta.isTouched && !field.state.meta.isValid && (
                  <FieldError errors={field.state.meta.errors} />
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
                    autoComplete="off"
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
                    value={
                      field.state.value ? String(field.state.value) : "none"
                    }
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
                    value={
                      field.state.value ? String(field.state.value) : "none"
                    }
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

          <Separator />

          {/* Brand Support & Variant Support */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold">Configuration</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <form.Field name="brandSupport">
                {(field) => (
                  <Field>
                    <FieldLabel>Brand Support</FieldLabel>
                    <Select
                      value={field.state.value}
                      onValueChange={(v) =>
                        field.handleChange(
                          v as "multi_brand" | "single_brand",
                        )
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="multi_brand">
                          Multi Brand
                        </SelectItem>
                        <SelectItem value="single_brand">
                          Single Brand
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                )}
              </form.Field>

              <form.Field name="status">
                {(field) => (
                  <Field>
                    <FieldLabel>Status</FieldLabel>
                    <Select
                      value={field.state.value}
                      onValueChange={(v) =>
                        field.handleChange(
                          v as "active" | "draft" | "inactive",
                        )
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                )}
              </form.Field>
            </div>


          </div>

          <Separator />

          {/* Linked Brands */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold">Linked Brands</h4>
            <div className="flex flex-wrap gap-2">
              {allBrands.map((brand: any) => (
                <label
                  key={brand.id}
                  className="flex items-center gap-2 border rounded-lg px-3 py-2 cursor-pointer hover:bg-muted/50 transition-colors"
                >
                  <Checkbox
                    checked={selectedBrandIds.includes(brand.id)}
                    onCheckedChange={() => toggleBrand(brand.id)}
                  />
                  <span className="text-sm">{brand.name}</span>
                  {defaultBrandId === brand.id && (
                    <Badge variant="secondary" className="text-[10px]">
                      Default
                    </Badge>
                  )}
                </label>
              ))}
            </div>
            {selectedBrandIds.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  Default brand:
                </span>
                <Select
                  value={defaultBrandId ? String(defaultBrandId) : "none"}
                  onValueChange={(v) =>
                    setDefaultBrandId(v === "none" ? undefined : Number(v))
                  }
                >
                  <SelectTrigger className="w-[180px] h-8">
                    <SelectValue placeholder="Select default" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {selectedBrandIds.map((id) => {
                      const b = allBrands.find((br: any) => br.id === id);
                      return b ? (
                        <SelectItem key={id} value={String(id)}>
                          {b.name}
                        </SelectItem>
                      ) : null;
                    })}
                  </SelectContent>
                </Select>
              </div>
            )}
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
            form="new-core-product-form"
            disabled={mutation.isPending}
          >
            {mutation.isPending && (
              <Loader className="mr-2 h-4 w-4 animate-spin" />
            )}
            Create Core Product
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
