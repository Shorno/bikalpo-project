"use client";

import { useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ImageIcon,
  Loader,
  Save,
  Settings,
  Tag,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { createVariant } from "@/actions/product-variant/create-variant";
import { orpc } from "@/utils/orpc";
import AdditionalImagesUploader from "@/components/AdditionalImagesUploader";
import ImageUploader from "@/components/ImageUploader";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import RichTextEditor from "@/components/ui/rich-text-editor";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { useBrands } from "@/hooks/use-brands";
import { useCategories, useSubCategories } from "@/hooks/use-categories";
import {
  createProductSchema,
  updateProductSchema,
} from "@/schema/product.schema";
import { generateSlug } from "@/utils/generate-slug";
import type { ProductWithRelations } from "./product-columns";
import { ProductDraftVariantsCard } from "./product-draft-variants-card";
import ProductFeaturesInput from "./product-features-input";
import { ProductVariantsCard } from "./product-variants-card";
import type { DraftVariant } from "./variant-form-dialog";

interface ProductFormProps {
  mode: "create" | "edit";
  product?: ProductWithRelations;
}

export default function ProductForm({ mode, product }: ProductFormProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [selectedCategory, setSelectedCategory] = useState<number | null>(
    product?.categoryId ?? null,
  );
  const [draftVariants, setDraftVariants] = useState<DraftVariant[]>([]);

  const { data: categories = [] } = useCategories();
  const { data: brands = [] } = useBrands();
  const subCategories = useSubCategories(selectedCategory);

  const isEdit = mode === "edit";

  const handleError = () => {
    toast.error(
      `An unexpected error occurred while ${isEdit ? "updating" : "creating"} the product.`,
    );
  };

  const createMutation = useMutation({
    ...orpc.product.create.mutationOptions(),
    onSuccess: async (result) => {
      if (result.product && draftVariants.length > 0) {
        const newProductId = result.product.id;
        try {
          for (const d of draftVariants) {
            await createVariant({ ...d, productId: newProductId });
          }
        } catch {
          toast.error("Product created but some variants failed to save.");
        }
      }
      queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      toast.success("Product created successfully");
      router.push("/dashboard/admin/products");
    },
    onError: handleError,
  });

  const updateMutation = useMutation({
    ...orpc.product.update.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      toast.success("Product updated successfully");
      router.push("/dashboard/admin/products");
    },
    onError: handleError,
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  const form = useForm({
    defaultValues: {
      id: product?.id ?? 0,
      name: product?.name ?? "",
      slug: product?.slug ?? "",
      sku: product?.sku ?? "",
      description: product?.description ?? "",
      categoryId: product?.categoryId ?? 0,
      subCategoryId:
        product?.subCategoryId ?? (undefined as number | undefined),
      brandId: product?.brandId ?? (undefined as number | undefined),
      size: product?.size ?? "",
      price: product?.price ?? "",
      stockQuantity: product?.stockQuantity ?? 0,
      reorderLevel: product?.reorderLevel ?? 0,
      supplier: product?.supplier ?? "",
      image: product?.image ?? "",
      additionalImages:
        product?.images?.map((img) => img.imageUrl) ?? ([] as string[]),
      features: (product?.features ?? []) as {
        title: string;
        items: { key: string; value: string }[];
      }[],
      inStock: product?.inStock ?? true,
      isFeatured: product?.isFeatured ?? false,
    },
    validators: {
      //@ts-expect-error
      onSubmit: isEdit ? updateProductSchema : createProductSchema,
    },
    onSubmit: async ({ value }) => {
      if (isEdit) {
        updateMutation.mutate(value);
      } else {
        createMutation.mutate(value);
      }
    },
  });

  const autoGenerateSlugFromName = (value: string) => {
    const generatedSlug = generateSlug(value);
    form.setFieldValue("slug", generatedSlug);
  };

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button asChild variant="ghost" size="icon">
                <Link href="/dashboard/admin/products">
                  <ArrowLeft className="h-4 w-4" />
                </Link>
              </Button>
              <div>
                <h1 className="text-lg font-semibold">
                  {isEdit ? "Edit Product" : "New Product"}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {isEdit ? product?.name : "Add a new product to your catalog"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push("/dashboard/admin/products")}
                disabled={isPending}
              >
                Discard
              </Button>
              <Button onClick={() => form.handleSubmit()} disabled={isPending}>
                {isPending && <Loader className="mr-2 h-4 w-4 animate-spin" />}
                <Save className="mr-2 h-4 w-4" />
                {isEdit ? "Save Changes" : "Create Product"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          form.handleSubmit();
        }}
      >
        <div className="container mx-auto px-4 py-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Content - Left Column (2/3 width) */}
            <div className="lg:col-span-2 space-y-6">
              {/* Basic Information */}
              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="text-base">Product Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Product Name */}
                    <form.Field name="name">
                      {(field) => {
                        const isInvalid =
                          field.state.meta.isTouched &&
                          !field.state.meta.isValid;
                        return (
                          <Field data-invalid={isInvalid}>
                            <FieldLabel htmlFor={field.name}>Name</FieldLabel>
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
                              placeholder="e.g. Organic Tomatoes"
                            />
                            {isInvalid && (
                              <FieldError errors={field.state.meta.errors} />
                            )}
                          </Field>
                        );
                      }}
                    </form.Field>

                    {/* Slug */}
                    <form.Field name="slug">
                      {(field) => {
                        const isInvalid =
                          field.state.meta.isTouched &&
                          !field.state.meta.isValid;
                        return (
                          <Field data-invalid={isInvalid}>
                            <FieldLabel htmlFor={field.name}>Slug</FieldLabel>
                            <Input
                              id={field.name}
                              name={field.name}
                              value={field.state.value}
                              onBlur={field.handleBlur}
                              onChange={(e) =>
                                field.handleChange(e.target.value)
                              }
                              aria-invalid={isInvalid}
                              placeholder="organic-tomatoes"
                            />
                            {isInvalid && (
                              <FieldError errors={field.state.meta.errors} />
                            )}
                          </Field>
                        );
                      }}
                    </form.Field>

                    {/* SKU */}
                    <form.Field name="sku">
                      {(field) => (
                        <Field>
                          <FieldLabel htmlFor={field.name}>
                            SKU (optional)
                          </FieldLabel>
                          <Input
                            id={field.name}
                            name={field.name}
                            value={field.state.value ?? ""}
                            onBlur={field.handleBlur}
                            onChange={(e) =>
                              field.handleChange(e.target.value || "")
                            }
                            placeholder="e.g. RICE-5520"
                          />
                        </Field>
                      )}
                    </form.Field>
                  </div>

                  <Separator />

                  {/* Description */}
                  <form.Field name="description">
                    {(field) => (
                      <Field>
                        <FieldLabel htmlFor={field.name}>
                          Description
                        </FieldLabel>
                        <RichTextEditor
                          value={field.state.value}
                          onChange={field.handleChange}
                          placeholder="Describe your product..."
                        />
                      </Field>
                    )}
                  </form.Field>

                  <Separator />

                  {/* Product Features */}
                  <form.Field name="features">
                    {(field) => (
                      <Field>
                        <FieldLabel htmlFor={field.name}>
                          Product Features
                        </FieldLabel>
                        <p className="text-sm text-muted-foreground mb-3">
                          Add feature groups with key-value pairs (e.g.,
                          Specifications: Weight - 500g)
                        </p>
                        <ProductFeaturesInput
                          value={field.state.value}
                          onChange={field.handleChange}
                        />
                      </Field>
                    )}
                  </form.Field>

                  {isEdit && product?.id ? (
                    <>
                      <Separator />
                      <ProductVariantsCard
                        productId={product.id}
                        initialVariants={product?.variants ?? []}
                      />
                    </>
                  ) : (
                    <>
                      <Separator />
                      <ProductDraftVariantsCard
                        draftVariants={draftVariants}
                        setDraftVariants={setDraftVariants}
                      />
                    </>
                  )}

                  <Separator />

                  {isEdit && (product?.variants?.length ?? 0) > 0 && (
                    <p className="text-sm text-muted-foreground">
                      This product has variants above. Customer price at
                      checkout uses each variant’s price. The fields below are
                      the product base (used when no variant is selected or for
                      listing).
                    </p>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                    {/* Size */}
                    <form.Field name="size">
                      {(field) => {
                        const isInvalid =
                          field.state.meta.isTouched &&
                          !field.state.meta.isValid;
                        return (
                          <Field data-invalid={isInvalid}>
                            <FieldLabel htmlFor={field.name}>Size</FieldLabel>
                            <Input
                              id={field.name}
                              name={field.name}
                              value={field.state.value}
                              onBlur={field.handleBlur}
                              onChange={(e) =>
                                field.handleChange(e.target.value)
                              }
                              aria-invalid={isInvalid}
                              placeholder="500g"
                            />
                            {isInvalid && (
                              <FieldError errors={field.state.meta.errors} />
                            )}
                          </Field>
                        );
                      }}
                    </form.Field>

                    {/* Price */}
                    <form.Field name="price">
                      {(field) => {
                        const isInvalid =
                          field.state.meta.isTouched &&
                          !field.state.meta.isValid;
                        return (
                          <Field data-invalid={isInvalid}>
                            <FieldLabel htmlFor={field.name}>Price</FieldLabel>
                            <Input
                              id={field.name}
                              name={field.name}
                              type="text"
                              value={field.state.value}
                              onBlur={field.handleBlur}
                              onChange={(e) =>
                                field.handleChange(e.target.value)
                              }
                              aria-invalid={isInvalid}
                              placeholder="9.99"
                            />
                            {isInvalid && (
                              <FieldError errors={field.state.meta.errors} />
                            )}
                          </Field>
                        );
                      }}
                    </form.Field>

                    {/* Stock Quantity */}
                    <form.Field name="stockQuantity">
                      {(field) => {
                        const isInvalid =
                          field.state.meta.isTouched &&
                          !field.state.meta.isValid;
                        return (
                          <Field data-invalid={isInvalid}>
                            <FieldLabel htmlFor={field.name}>Stock</FieldLabel>
                            <Input
                              id={field.name}
                              name={field.name}
                              type="number"
                              value={field.state.value}
                              onBlur={field.handleBlur}
                              onChange={(e) =>
                                field.handleChange(
                                  parseInt(e.target.value, 10) || 0,
                                )
                              }
                              aria-invalid={isInvalid}
                              placeholder="100"
                            />
                            {isInvalid && (
                              <FieldError errors={field.state.meta.errors} />
                            )}
                          </Field>
                        );
                      }}
                    </form.Field>

                    {/* Reorder Level */}
                    <form.Field name="reorderLevel">
                      {(field) => (
                        <Field>
                          <FieldLabel htmlFor={field.name}>
                            Reorder Level
                          </FieldLabel>
                          <Input
                            id={field.name}
                            name={field.name}
                            type="number"
                            min={0}
                            value={field.state.value ?? 0}
                            onBlur={field.handleBlur}
                            onChange={(e) =>
                              field.handleChange(
                                parseInt(e.target.value, 10) || 0,
                              )
                            }
                            placeholder="20"
                          />
                        </Field>
                      )}
                    </form.Field>
                  </div>
                </CardContent>
              </Card>

              {/* Media */}
              <Card>
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-2">
                    <ImageIcon className="h-4 w-4 text-muted-foreground" />
                    <CardTitle className="text-base">Media</CardTitle>
                  </div>
                  <CardDescription>Add photos of your product</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Main Image */}
                    <form.Field name="image">
                      {(field) => {
                        const isInvalid =
                          field.state.meta.isTouched &&
                          !field.state.meta.isValid;
                        return (
                          <Field data-invalid={isInvalid}>
                            <FieldLabel>Main Image</FieldLabel>
                            <ImageUploader
                              value={field.state.value}
                              onChange={field.handleChange}
                              folder="products"
                              maxSizeMB={5}
                            />
                            {isInvalid && (
                              <FieldError errors={field.state.meta.errors} />
                            )}
                          </Field>
                        );
                      }}
                    </form.Field>

                    {/* Additional Images */}
                    <form.Field name="additionalImages">
                      {(field) => {
                        const isInvalid =
                          field.state.meta.isTouched &&
                          !field.state.meta.isValid;
                        return (
                          <Field data-invalid={isInvalid}>
                            <FieldLabel>Gallery</FieldLabel>
                            <AdditionalImagesUploader
                              value={field.state.value}
                              onChange={field.handleChange}
                              folder="products/additional"
                              maxSizeMB={5}
                            />
                            {isInvalid && (
                              <FieldError errors={field.state.meta.errors} />
                            )}
                          </Field>
                        );
                      }}
                    </form.Field>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Sidebar - Right Column (1/3 width) */}
            <div className="space-y-6">
              {/* Status */}
              <Card>
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-2">
                    <Settings className="h-4 w-4 text-muted-foreground" />
                    <CardTitle className="text-base">Status</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* In Stock Switch */}
                  <form.Field name="inStock">
                    {(field) => (
                      <div className="flex items-center justify-between">
                        <div>
                          <FieldLabel
                            htmlFor={field.name}
                            className="text-sm font-medium"
                          >
                            In Stock
                          </FieldLabel>
                          <p className="text-xs text-muted-foreground">
                            Available for purchase
                          </p>
                        </div>
                        <Switch
                          id={field.name}
                          checked={field.state.value}
                          onCheckedChange={field.handleChange}
                        />
                      </div>
                    )}
                  </form.Field>

                  <Separator />

                  {/* Is Featured Switch */}
                  <form.Field name="isFeatured">
                    {(field) => (
                      <div className="flex items-center justify-between">
                        <div>
                          <FieldLabel
                            htmlFor={field.name}
                            className="text-sm font-medium"
                          >
                            Featured
                          </FieldLabel>
                          <p className="text-xs text-muted-foreground">
                            Show in featured section
                          </p>
                        </div>
                        <Switch
                          id={field.name}
                          checked={field.state.value}
                          onCheckedChange={field.handleChange}
                        />
                      </div>
                    )}
                  </form.Field>
                </CardContent>
              </Card>

              {/* Classification */}
              <Card>
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-2">
                    <Tag className="h-4 w-4 text-muted-foreground" />
                    <CardTitle className="text-base">Organization</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Category */}
                  <form.Field name="categoryId">
                    {(field) => {
                      const isInvalid =
                        field.state.meta.isTouched && !field.state.meta.isValid;
                      return (
                        <Field data-invalid={isInvalid}>
                          <FieldLabel htmlFor={field.name}>Category</FieldLabel>
                          <Select
                            value={field.state.value?.toString()}
                            onValueChange={(value) => {
                              const numValue = parseInt(value, 10);
                              field.handleChange(numValue);
                              setSelectedCategory(numValue);
                              form.setFieldValue("subCategoryId", undefined);
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select" />
                            </SelectTrigger>
                            <SelectContent>
                              {categories.map((cat) => (
                                <SelectItem
                                  key={cat.id}
                                  value={cat.id.toString()}
                                >
                                  {cat.name}
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

                  {/* Subcategory */}
                  <form.Field name="subCategoryId">
                    {(field) => {
                      const isInvalid =
                        field.state.meta.isTouched && !field.state.meta.isValid;
                      return (
                        <Field data-invalid={isInvalid}>
                          <FieldLabel htmlFor={field.name}>
                            Subcategory
                          </FieldLabel>
                          <Select
                            value={field.state.value?.toString() || "none"}
                            onValueChange={(value) => {
                              field.handleChange(
                                value === "none"
                                  ? undefined
                                  : parseInt(value, 10),
                              );
                            }}
                            disabled={
                              !selectedCategory || subCategories.length === 0
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">None</SelectItem>
                              {subCategories.map((subCat) => (
                                <SelectItem
                                  key={subCat.id}
                                  value={subCat.id.toString()}
                                >
                                  {subCat.name}
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

                  {/* Brand */}
                  <form.Field name="brandId">
                    {(field) => {
                      const isInvalid =
                        field.state.meta.isTouched && !field.state.meta.isValid;
                      return (
                        <Field data-invalid={isInvalid}>
                          <FieldLabel htmlFor={field.name}>Brand</FieldLabel>
                          <Select
                            value={field.state.value?.toString() || "none"}
                            onValueChange={(value) => {
                              field.handleChange(
                                value === "none"
                                  ? undefined
                                  : parseInt(value, 10),
                              );
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">No brand</SelectItem>
                              {brands.map((brand) => (
                                <SelectItem
                                  key={brand.id}
                                  value={brand.id.toString()}
                                >
                                  {brand.name}
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

                  {/* Supplier */}
                  <form.Field name="supplier">
                    {(field) => (
                      <Field>
                        <FieldLabel htmlFor={field.name}>
                          Supplier (optional)
                        </FieldLabel>
                        <Input
                          id={field.name}
                          name={field.name}
                          value={field.state.value ?? ""}
                          onBlur={field.handleBlur}
                          onChange={(e) =>
                            field.handleChange(e.target.value || "")
                          }
                          placeholder="e.g. ABC Suppliers"
                        />
                      </Field>
                    )}
                  </form.Field>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
