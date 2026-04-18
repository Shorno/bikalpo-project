"use client";

import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

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
import { Switch } from "@/components/ui/switch";
import { createCategorySchema } from "@/schema/category.scheam";
import { generateSlug } from "@/utils/generate-slug";
import { orpc } from "@/utils/orpc";

export default function NewCategoryDialog() {
  const [open, setOpen] = React.useState(false);
  const queryClient = useQueryClient();

  const { data: typesData } = useQuery(
    orpc.adminProductType.getAll.queryOptions({ input: {} }),
  );
  const productTypes = typesData?.types ?? [];

  const mutation = useMutation(
    orpc.category.create.mutationOptions({
      onSuccess: (result) => {
        queryClient.invalidateQueries({ queryKey: orpc.category.getAll.key() });
        toast.success(result.message);
        form.reset();
        setOpen(false);
      },
      onError: (error) => {
        toast.error(
          error.message ||
            "An unexpected error occurred while creating the category.",
        );
      },
    }),
  );

  const form = useForm({
    defaultValues: {
      name: "",
      slug: "",
      typeId: null as number | null,
    },

    validators: {
      onSubmit: createCategorySchema,
    },
    onSubmit: async ({ value }) => {
      mutation.mutate(value);
    },
  });

  const autoGenerateSlugFromName = (value: string) => {
    const generatedSlug = generateSlug(value);
    form.setFieldValue("slug", generatedSlug);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>New Category</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Category</DialogTitle>
          <DialogDescription>
            Add a new category to organize your products.
          </DialogDescription>
        </DialogHeader>
        <form
          id="new-category-form"
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            form.handleSubmit();
          }}
          className="space-y-4"
        >


          {/* Name & Slug — side by side */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <form.Field name="name">
              {(field) => {
                const isInvalid =
                  field.state.meta.isTouched && !field.state.meta.isValid;
                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel htmlFor={field.name}>Category Name *</FieldLabel>
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
                      placeholder="Electronics"
                      autoComplete="off"
                    />
                    {isInvalid && <FieldError errors={field.state.meta.errors} />}
                  </Field>
                );
              }}
            </form.Field>

            <form.Field name="slug">
              {(field) => {
                const isInvalid =
                  field.state.meta.isTouched && !field.state.meta.isValid;
                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel htmlFor={field.name}>Slug *</FieldLabel>
                    <Input
                      id={field.name}
                      name={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      aria-invalid={isInvalid}
                      placeholder="electronics"
                      autoComplete="off"
                    />
                    <FieldDescription>Auto-generated from name</FieldDescription>
                    {isInvalid && <FieldError errors={field.state.meta.errors} />}
                  </Field>
                );
              }}
            </form.Field>
          </div>

          {/* Type */}
          <div className="grid grid-cols-1 gap-4">
            <form.Field name="typeId">
              {(field) => (
                <Field>
                  <FieldLabel htmlFor={field.name}>Product Type</FieldLabel>
                  <Select
                    value={field.state.value ? String(field.state.value) : "none"}
                    onValueChange={(v) =>
                      field.handleChange(v === "none" ? null : Number(v))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No Type</SelectItem>
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
            form="new-category-form"
            disabled={mutation.isPending}
          >
            {mutation.isPending && (
              <Loader className="mr-2 h-4 w-4 animate-spin" />
            )}
            Create Category
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
