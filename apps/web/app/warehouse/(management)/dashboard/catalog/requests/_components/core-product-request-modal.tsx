"use client";

import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, Loader } from "lucide-react";
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
import { generateSlug } from "@/utils/generate-slug";
import { orpc } from "@/utils/orpc";

export default function CoreProductRequestModal() {
  const [open, setOpen] = React.useState(false);
  const queryClient = useQueryClient();
  const { data: options } = useQuery(
    orpc.catalogRequest.getRequestOptions.queryOptions({ input: {} }),
  );
  const [selectedTypeId, setSelectedTypeId] = React.useState<number | null>(
    null,
  );
  const [selectedCategoryId, setSelectedCategoryId] = React.useState<number>(0);

  const allCategories = options?.categories ?? [];
  const allSubCategories = options?.subCategories ?? [];

  const filteredCategories = selectedTypeId
    ? allCategories.filter((c: any) => c.typeId === selectedTypeId)
    : allCategories;

  const filteredSubcategories = selectedCategoryId
    ? allSubCategories.filter((sc: any) => sc.categoryId === selectedCategoryId)
    : [];

  const mutation = useMutation({
    mutationFn: (payload: any) =>
      orpc.catalogRequest.createRequest.call({
        requestType: "core_product" as const,
        payload,
      }),
    onSuccess: async (result) => {
      toast.success(result.message || "Core product request submitted");
      await queryClient.invalidateQueries({
        queryKey: orpc.catalogRequest.getMyRequests.key(),
      });
      form.reset();
      setSelectedTypeId(null);
      setSelectedCategoryId(0);
      setOpen(false);
    },
    onError: (error: any) => toast.error(error.message || "Request failed"),
  });

  const form = useForm({
    defaultValues: {
      sku: "",
      name: "",
      slug: "",
      description: "",
      image: "",
      typeId: null as number | null,
      categoryId: 0,
      subCategoryId: null as number | null,
    },
    onSubmit: async ({ value }) => {
      mutation.mutate({
        sku: value.sku.trim() || undefined,
        name: value.name,
        slug: value.slug,
        description: value.description || undefined,
        image: value.image,
        typeId: value.typeId,
        categoryId: value.categoryId,
        subCategoryId: value.subCategoryId,
      });
    },
  });

  const autoSlug = (v: string) => form.setFieldValue("slug", generateSlug(v));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <FileText className="h-4 w-4" />
          New Core Product
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Request a Core Product</DialogTitle>
          <DialogDescription>
            Submit a new core product identity for admin approval.
          </DialogDescription>
        </DialogHeader>
        <form
          id="core-product-request-form"
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
                      autoSlug(e.target.value);
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
                      {(options?.types ?? []).map((t: any) => (
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
            form="core-product-request-form"
            disabled={mutation.isPending}
          >
            {mutation.isPending && (
              <Loader className="mr-2 h-4 w-4 animate-spin" />
            )}
            Submit Request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
