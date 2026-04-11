"use client";

import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader, Plus, Trash2 } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { generateSlug } from "@/utils/generate-slug";
import { orpc } from "@/utils/orpc";
import type { CoreProductWithRelations } from "./core-product-columns";

const PACK_TYPES = [
  "sack", "carton", "packet", "loose", "bottle", "can", "jar", "pouch", "box",
];

interface PackVariantRow {
  label: string;
  weightKg: string;
  packType: string;
  sellUnit: string;
  sortOrder: number;
  isActive: boolean;
}

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
  const [selectedBrandIds, setSelectedBrandIds] = React.useState<number[]>(
    coreProduct.brands.map((b) => b.brandId),
  );
  const [defaultBrandId, setDefaultBrandId] = React.useState<number | undefined>(
    coreProduct.brands.find((b) => b.isDefault)?.brandId,
  );
  const [packVariants, setPackVariants] = React.useState<PackVariantRow[]>(
    coreProduct.packVariants.map((pv) => ({
      label: pv.label,
      weightKg: pv.weightKg,
      packType: pv.packType,
      sellUnit: pv.sellUnit || "",
      sortOrder: pv.sortOrder,
      isActive: pv.isActive,
    })),
  );
  const [selectedTypeId, setSelectedTypeId] = React.useState<number | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = React.useState<number>(coreProduct.categoryId);

  const queryClient = useQueryClient();

  // Reset state when coreProduct changes
  React.useEffect(() => {
    setSelectedBrandIds(coreProduct.brands.map((b) => b.brandId));
    setDefaultBrandId(coreProduct.brands.find((b) => b.isDefault)?.brandId);
    setPackVariants(
      coreProduct.packVariants.map((pv) => ({
        label: pv.label,
        weightKg: pv.weightKg,
        packType: pv.packType,
        sellUnit: pv.sellUnit || "",
        sortOrder: pv.sortOrder,
        isActive: pv.isActive,
      })),
    );
    setSelectedCategoryId(coreProduct.categoryId);
  }, [coreProduct]);

  // Fetch reference data
  const { data: typesData } = useQuery(
    orpc.adminProductType.getAll.queryOptions({ input: {} }),
  );
  const productTypes = typesData?.types ?? [];

  const { data: categoriesData } = useQuery(orpc.category.getAll.queryOptions());
  const allCategories = Array.isArray(categoriesData) ? categoriesData : [];

  const { data: brandsData } = useQuery(orpc.brand.getAll.queryOptions());
  const allBrands = Array.isArray(brandsData) ? brandsData : [];

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
      brandSupport: coreProduct.brandSupport,
      variantSupportPack: coreProduct.variantSupportPack,
      variantSupportLoose: coreProduct.variantSupportLoose,
      defaultLooseUnit: coreProduct.defaultLooseUnit || "",
      status: coreProduct.status,
      displayOrder: coreProduct.displayOrder,
      typeId: initialTypeId,
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
        brandSupport: value.brandSupport,
        variantSupportPack: value.variantSupportPack,
        variantSupportLoose: value.variantSupportLoose,
        defaultLooseUnit: value.defaultLooseUnit || undefined,
        status: value.status,
        displayOrder: value.displayOrder,
        brandIds: selectedBrandIds,
        defaultBrandId,
        packVariants: packVariants.map((pv, idx) => ({ ...pv, sortOrder: idx })),
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

  const addPackVariant = () => {
    setPackVariants([
      ...packVariants,
      { label: "", weightKg: "", packType: "packet", sellUnit: "Pack", sortOrder: packVariants.length, isActive: true },
    ]);
  };

  const removePackVariant = (index: number) => {
    setPackVariants(packVariants.filter((_, i) => i !== index));
  };

  const updatePackVariant = (index: number, field: keyof PackVariantRow, value: string | number | boolean) => {
    setPackVariants(packVariants.map((pv, i) => (i === index ? { ...pv, [field]: value } : pv)));
  };

  const toggleBrand = (brandId: number) => {
    setSelectedBrandIds((prev) =>
      prev.includes(brandId) ? prev.filter((id) => id !== brandId) : [...prev, brandId],
    );
  };

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

          <Separator />

          {/* Configuration */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold">Configuration</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <form.Field name="brandSupport">
                {(field) => (
                  <Field>
                    <FieldLabel>Brand Support</FieldLabel>
                    <Select value={field.state.value} onValueChange={(v) => field.handleChange(v as any)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="multi_brand">Multi Brand</SelectItem>
                        <SelectItem value="single_brand">Single Brand</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                )}
              </form.Field>

              <form.Field name="status">
                {(field) => (
                  <Field>
                    <FieldLabel>Status</FieldLabel>
                    <Select value={field.state.value} onValueChange={(v) => field.handleChange(v as any)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
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

            <div className="flex flex-wrap gap-6">
              <form.Field name="variantSupportPack">
                {(field) => (
                  <Field orientation="horizontal">
                    <FieldContent><FieldLabel>Pack Based</FieldLabel></FieldContent>
                    <Switch checked={field.state.value} onCheckedChange={field.handleChange} />
                  </Field>
                )}
              </form.Field>
              <form.Field name="variantSupportLoose">
                {(field) => (
                  <Field orientation="horizontal">
                    <FieldContent><FieldLabel>Loose</FieldLabel></FieldContent>
                    <Switch checked={field.state.value} onCheckedChange={field.handleChange} />
                  </Field>
                )}
              </form.Field>
              <form.Field name="defaultLooseUnit">
                {(field) => (
                  <Field>
                    <FieldLabel>Loose Unit</FieldLabel>
                    <Input value={field.state.value} onChange={(e) => field.handleChange(e.target.value)} placeholder="KG" className="w-20" />
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
                <label key={brand.id} className="flex items-center gap-2 border rounded-lg px-3 py-2 cursor-pointer hover:bg-muted/50 transition-colors">
                  <Checkbox checked={selectedBrandIds.includes(brand.id)} onCheckedChange={() => toggleBrand(brand.id)} />
                  <span className="text-sm">{brand.name}</span>
                  {defaultBrandId === brand.id && <Badge variant="secondary" className="text-[10px]">Default</Badge>}
                </label>
              ))}
            </div>
            {selectedBrandIds.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Default brand:</span>
                <Select value={defaultBrandId ? String(defaultBrandId) : "none"} onValueChange={(v) => setDefaultBrandId(v === "none" ? undefined : Number(v))}>
                  <SelectTrigger className="w-[180px] h-8"><SelectValue placeholder="Select default" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {selectedBrandIds.map((id) => {
                      const b = allBrands.find((br: any) => br.id === id);
                      return b ? <SelectItem key={id} value={String(id)}>{b.name}</SelectItem> : null;
                    })}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <Separator />

          {/* Pack Variant Templates */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold">Pack Variant Templates</h4>
              <Button type="button" variant="outline" size="sm" onClick={addPackVariant}>
                <Plus className="h-3 w-3 mr-1" />Add
              </Button>
            </div>

            {packVariants.length === 0 && (
              <p className="text-sm text-muted-foreground py-4 text-center border border-dashed rounded-lg">
                No pack variants defined yet.
              </p>
            )}

            {packVariants.map((pv, idx) => (
              <div key={idx} className="grid grid-cols-[1fr_80px_1fr_80px_auto] gap-2 items-center">
                <Input value={pv.label} onChange={(e) => updatePackVariant(idx, "label", e.target.value)} placeholder="Label" className="h-9" />
                <Input value={pv.weightKg} onChange={(e) => updatePackVariant(idx, "weightKg", e.target.value)} placeholder="KG" className="h-9" type="number" step="0.01" />
                <Select value={pv.packType} onValueChange={(v) => updatePackVariant(idx, "packType", v)}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PACK_TYPES.map((pt) => <SelectItem key={pt} value={pt}>{pt.charAt(0).toUpperCase() + pt.slice(1)}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Input value={pv.sellUnit} onChange={(e) => updatePackVariant(idx, "sellUnit", e.target.value)} placeholder="Unit" className="h-9" />
                <Button type="button" variant="ghost" size="icon" className="h-9 w-9 text-destructive hover:text-destructive" onClick={() => removePackVariant(idx)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
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
