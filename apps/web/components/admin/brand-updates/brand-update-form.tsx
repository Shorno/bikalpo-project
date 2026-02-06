"use client";

import { useForm } from "@tanstack/react-form";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import * as z from "zod";
import { createBrandUpdate } from "@/actions/brand-update/create-brand-update";
import { updateBrandUpdate } from "@/actions/brand-update/update-brand-update";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { BrandUpdate } from "@/db/schema/brand-update";

const formSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  description: z.string(),
  type: z.enum(["info", "warning", "new", "offer"]),
});

interface BrandUpdateFormProps {
  brandUpdate?: BrandUpdate | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const typeOptions = [
  { value: "info", label: "Info", color: "bg-blue-500" },
  { value: "warning", label: "Warning", color: "bg-amber-500" },
  { value: "new", label: "New", color: "bg-emerald-500" },
  { value: "offer", label: "Offer", color: "bg-orange-500" },
];

export function BrandUpdateForm({
  brandUpdate,
  open,
  onOpenChange,
}: BrandUpdateFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isEditing = !!brandUpdate;

  const form = useForm({
    defaultValues: {
      title: brandUpdate?.title || "",
      description: brandUpdate?.description || "",
      type:
        (brandUpdate?.type as "info" | "warning" | "new" | "offer") || "info",
    },
    validators: {
      onSubmit: formSchema,
    },
    onSubmit: async ({ value }) => {
      setIsSubmitting(true);

      const result = isEditing
        ? await updateBrandUpdate(brandUpdate.id, value)
        : await createBrandUpdate(value);

      setIsSubmitting(false);

      if (result.success) {
        toast.success(
          isEditing ? "Brand update saved" : "Brand update created",
        );
        onOpenChange(false);
        form.reset();
      } else {
        toast.error(result.error || "Something went wrong");
      }
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit Brand Update" : "New Brand Update"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update the brand update details below."
              : "Create a new brand update that will be displayed to customers."}
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            form.handleSubmit();
          }}
          className="space-y-4"
        >
          <form.Field name="title">
            {(field) => (
              <Field>
                <FieldLabel htmlFor={field.name}>Title *</FieldLabel>
                <Input
                  id={field.name}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="e.g., New Product: Premium Coffee Beans"
                />
                {field.state.meta.isTouched &&
                  field.state.meta.errors.length > 0 && (
                    <p className="text-sm text-red-500">
                      {typeof field.state.meta.errors[0] === "string"
                        ? field.state.meta.errors[0]
                        : field.state.meta.errors[0]?.message ||
                          "Invalid value"}
                    </p>
                  )}
              </Field>
            )}
          </form.Field>

          <form.Field name="description">
            {(field) => (
              <Field>
                <FieldLabel htmlFor={field.name}>Description</FieldLabel>
                <Textarea
                  id={field.name}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="e.g., Fresh stock available now at best wholesale rates."
                  rows={3}
                />
              </Field>
            )}
          </form.Field>

          <form.Field name="type">
            {(field) => (
              <Field>
                <FieldLabel>Type</FieldLabel>
                <Select
                  value={field.state.value}
                  onValueChange={(value) =>
                    field.handleChange(
                      value as "info" | "warning" | "new" | "offer",
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {typeOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-2 h-2 rounded-full ${option.color}`}
                          />
                          {option.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}
          </form.Field>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {isEditing ? "Update" : "Create"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
