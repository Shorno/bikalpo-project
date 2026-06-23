"use client";

import {
  INVENTORY_BEHAVIOURS,
  INVENTORY_BEHAVIOUR_LABELS,
  PRODUCT_TYPE_FAMILY_LABELS,
  buildProductTypeFulfillmentProfile,
} from "@bikalpo-project/db/fulfillment";
import type { ProductTypeRow } from "./product-type-columns";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader, Pencil } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { generateSlug } from "@/utils/generate-slug";
import { orpc } from "@/utils/orpc";

interface EditTypeDialogProps {
  type: ProductTypeRow;
}

export default function EditTypeDialog({ type }: EditTypeDialogProps) {
  const [open, setOpen] = React.useState(false);
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (data: {
      id: number;
      name: string;
      slug: string;
      description?: string;
      inventoryBehaviour: (typeof INVENTORY_BEHAVIOURS)[number];
      displayOrder?: number;
    }) => orpc.adminProductType.update.call(data),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["adminProductType"] });
      toast.success(result.message);
      setOpen(false);
    },
    onError: (error) => {
      toast.error(
        error.message || "An error occurred while updating the type.",
      );
    },
  });

  const form = useForm({
    defaultValues: {
      name: type.name,
      slug: type.slug,
      description: type.description || "",
      inventoryBehaviour: type.inventoryBehaviour,
      displayOrder: type.displayOrder,
    },
    onSubmit: async ({ value }) => {
      mutation.mutate({
        id: type.id,
        ...value,
        slug: value.slug || generateSlug(value.name),
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="w-full justify-start">
          <Pencil className="h-4 w-4 mr-2" />
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Product Type</DialogTitle>
          <DialogDescription>
            Update the details of {type.name}.
          </DialogDescription>
        </DialogHeader>
        <form
          id="edit-type-form"
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
                  placeholder="Brief description"
                  autoComplete="off"
                />
              </Field>
            )}
          </form.Field>

          <form.Field name="inventoryBehaviour">
            {(field) => (
              <Field>
                <FieldLabel htmlFor={field.name}>Inventory Behaviour</FieldLabel>
                <Select
                  value={field.state.value}
                  onValueChange={(value) =>
                    field.handleChange(value as (typeof INVENTORY_BEHAVIOURS)[number])
                  }
                >
                  <SelectTrigger id={field.name}>
                    <SelectValue placeholder="Select inventory behaviour" />
                  </SelectTrigger>
                  <SelectContent>
                    {INVENTORY_BEHAVIOURS.map((behaviour) => (
                      <SelectItem key={behaviour} value={behaviour}>
                        {INVENTORY_BEHAVIOUR_LABELS[behaviour]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}
          </form.Field>

          <form.Subscribe selector={(state) => state.values}>
            {(values) => {
              const profile = buildProductTypeFulfillmentProfile({
                name: values.name,
                slug: values.slug || generateSlug(values.name),
                inventoryBehaviour: values.inventoryBehaviour,
              });

              return (
                <div className="rounded-lg border bg-muted/30 px-4 py-3 text-sm">
                  <div className="font-medium">
                    Family: {PRODUCT_TYPE_FAMILY_LABELS[profile.family]}
                  </div>
                  <div className="text-muted-foreground">
                    Modes: {profile.supportedModes.join(", ")}
                  </div>
                  <div className="text-muted-foreground">
                    Flow: {profile.orderUnit} order {"->"} {profile.conversionUnit} conversion
                  </div>
                </div>
              );
            }}
          </form.Subscribe>
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
            form="edit-type-form"
            disabled={mutation.isPending}
          >
            {mutation.isPending && (
              <Loader className="mr-2 h-4 w-4 animate-spin" />
            )}
            Update Type
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
