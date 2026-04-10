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
  FieldContent,
  FieldDescription,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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

export default function NewTypeDialog() {
  const [open, setOpen] = React.useState(false);
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (data: {
      name: string;
      slug: string;
      description?: string;
      enableBrand: boolean;
      enableColor: boolean;
      enableSize: boolean;
      enableDesign: boolean;
      enableVariant: boolean;
      inventoryBehaviour: "auto_break" | "loose_convert" | "fixed_pack";
      isActive: boolean;
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
      enableBrand: true,
      enableColor: false,
      enableSize: true,
      enableDesign: false,
      enableVariant: true,
      inventoryBehaviour: "fixed_pack" as
        | "auto_break"
        | "loose_convert"
        | "fixed_pack",
      isActive: true,
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
            Define a new product type with attribute rules and inventory
            behaviour.
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

          {/* Row 3: Status + Display Order */}
          <div className="grid grid-cols-2 gap-4">
            <form.Field name="isActive">
              {(field) => (
                <Field>
                  <FieldLabel>Status</FieldLabel>
                  <RadioGroup
                    value={field.state.value ? "active" : "draft"}
                    onValueChange={(v) => field.handleChange(v === "active")}
                    className="flex gap-4"
                  >
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="active" id="status-active" />
                      <Label htmlFor="status-active">Active</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="draft" id="status-draft" />
                      <Label htmlFor="status-draft">Draft</Label>
                    </div>
                  </RadioGroup>
                </Field>
              )}
            </form.Field>

            <form.Field name="displayOrder">
              {(field) => (
                <Field>
                  <FieldLabel htmlFor={field.name}>Display Order</FieldLabel>
                  <Input
                    id={field.name}
                    type="number"
                    value={field.state.value}
                    onChange={(e) =>
                      field.handleChange(Number(e.target.value))
                    }
                    placeholder="0"
                    min={0}
                    autoComplete="off"
                  />
                </Field>
              )}
            </form.Field>
          </div>

          {/* Row 4: Attributes + Inventory side by side */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <FieldLabel>Attribute Toggles</FieldLabel>
              <div className="space-y-1">
                {(
                  [
                    { key: "enableBrand", label: "Brand" },
                    { key: "enableColor", label: "Color" },
                    { key: "enableSize", label: "Size" },
                    { key: "enableDesign", label: "Design" },
                    { key: "enableVariant", label: "Variant" },
                  ] as const
                ).map((attr) => (
                  <form.Field key={attr.key} name={attr.key}>
                    {(field) => (
                      <Field orientation="horizontal">
                        <FieldContent>
                          <FieldLabel htmlFor={attr.key}>
                            {attr.label}
                          </FieldLabel>
                        </FieldContent>
                        <Switch
                          id={attr.key}
                          checked={field.state.value}
                          onCheckedChange={field.handleChange}
                        />
                      </Field>
                    )}
                  </form.Field>
                ))}
              </div>
            </div>

            <form.Field name="inventoryBehaviour">
              {(field) => (
                <Field>
                  <FieldLabel htmlFor={field.name}>
                    Inventory Behaviour
                  </FieldLabel>
                  <Select
                    value={field.state.value}
                    onValueChange={(v) =>
                      field.handleChange(
                        v as "auto_break" | "loose_convert" | "fixed_pack",
                      )
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fixed_pack">
                        Fixed Pack — Same pack warehouse to shop
                      </SelectItem>
                      <SelectItem value="auto_break">
                        Auto Break — Carton breaks into packs
                      </SelectItem>
                      <SelectItem value="loose_convert">
                        Loose Convert — Sack converts to weight
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FieldDescription>
                    How stock flows from warehouse to shop.
                  </FieldDescription>
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
