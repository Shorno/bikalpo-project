"use client";

import { useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";

import { generateSlug } from "@/utils/generate-slug";
import { orpc } from "@/utils/orpc";

export default function NewTypeDialog() {
  const [open, setOpen] = React.useState(false);
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (data: {
      name: string;
      slug: string;
      description?: string;
      displayOrder: number;
    }) => orpc.adminProductType.create.call(data),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["adminProductType"] });
      toast.success(result.message);
      form.reset();
      setOpen(false);
    },
    onError: (error) => {
      toast.error(
        error.message || "An error occurred while creating the type.",
      );
    },
  });

  const form = useForm({
    defaultValues: {
      name: "",
      slug: "",
      description: "",
      displayOrder: 0,
    },
    onSubmit: async ({ value }) => {
      mutation.mutate({
        ...value,
        slug: value.slug || generateSlug(value.name),
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>New Type</Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Product Type</DialogTitle>
          <DialogDescription>
            Define a new product type with attribute rules.
          </DialogDescription>
        </DialogHeader>
        <form
          id="new-type-form"
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            form.handleSubmit();
          }}
          className="space-y-4"
        >
          {/* Row 1: Name + Slug */}
          <div className="grid grid-cols-2 gap-4">
            <form.Field name="name">
              {(field) => (
                <Field>
                  <FieldLabel htmlFor={field.name}>Type Name *</FieldLabel>
                  <Input
                    id={field.name}
                    value={field.state.value}
                    onChange={(e) => {
                      field.handleChange(e.target.value);
                      form.setFieldValue("slug", generateSlug(e.target.value));
                    }}
                    placeholder="e.g. Grocery"
                    autoComplete="off"
                  />
                </Field>
              )}
            </form.Field>

            <form.Field name="slug">
              {(field) => (
                <Field>
                  <FieldLabel htmlFor={field.name}>Slug</FieldLabel>
                  <Input
                    id={field.name}
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder="auto-generated"
                    autoComplete="off"
                  />
                </Field>
              )}
            </form.Field>
          </div>

          {/* Row 2: Description (full width) */}
          <form.Field name="description">
            {(field) => (
              <Field>
                <FieldLabel htmlFor={field.name}>Description</FieldLabel>
                <Input
                  id={field.name}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="Brief description of this product type"
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
            form="new-type-form"
            disabled={mutation.isPending}
          >
            {mutation.isPending && (
              <Loader className="mr-2 h-4 w-4 animate-spin" />
            )}
            Create Type
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
