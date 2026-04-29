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
} from "@/components/ui/dialog";
import {
  Field,
  FieldContent,
  FieldDescription,
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
import { client, orpc } from "@/utils/orpc";
import { type VariantOptionRow } from "./variant-option-columns";

const UNITS = [
  "KG", "ML", "L", "Pc", "Size", "Box", "Carton", "Ton", "Pair", "Unit",
];

interface EditVariantOptionDialogProps {
  variantOption: VariantOptionRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function EditVariantOptionDialog({
  variantOption: vo,
  open,
  onOpenChange,
}: EditVariantOptionDialogProps) {
  const queryClient = useQueryClient();

  // Fetch types for the dropdown
  const { data: typesData } = useQuery({
    ...orpc.adminProductType.getAll.queryOptions({ input: {} }),
    enabled: open,
  });
  const productTypes = typesData?.types ?? [];

  // Fetch all categories
  const { data: categoriesData } = useQuery({
    ...orpc.category.getAll.queryOptions(),
    enabled: open,
  });
  const allCategories = (categoriesData ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    typeId: c.typeId,
  }));

  // Derive initial type selection
  const initialTypeId = vo.typeId ? String(vo.typeId) : "global";
  const [selectedTypeId, setSelectedTypeId] =
    React.useState<string>(initialTypeId);

  // Reset when dialog re-opens with new data
  React.useEffect(() => {
    if (open) {
      setSelectedTypeId(vo.typeId ? String(vo.typeId) : "global");
    }
  }, [open, vo.typeId]);

  // Categories filtered by selected type
  const filteredCategories = React.useMemo(() => {
    if (selectedTypeId === "global" || !selectedTypeId) return [];
    return allCategories.filter((c) => c.typeId === Number(selectedTypeId));
  }, [allCategories, selectedTypeId]);

  const mutation = useMutation({
    mutationFn: (
      data: Parameters<typeof client.adminVariantOption.update>[0],
    ) => client.adminVariantOption.update(data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: orpc.adminVariantOption.getAll.key(),
      });
      toast.success("Variant option updated successfully");
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update variant option.");
    },
  });

  const form = useForm({
    defaultValues: {
      id: vo.id,
      name: vo.name,
      unit: vo.unit,
      size: vo.size ?? "",
      variantType: vo.variantType as "pack" | "loose",
      typeId: vo.typeId,
      categoryId: vo.categoryId,
      isActive: vo.isActive,
      sortOrder: vo.sortOrder,
    },
    onSubmit: async ({ value }) => {
      mutation.mutate(value);
    },
  });

  const handleTypeChange = (value: string) => {
    setSelectedTypeId(value);
    if (value === "global") {
      form.setFieldValue("typeId", null);
      form.setFieldValue("categoryId", null);
    } else {
      form.setFieldValue("typeId", Number(value));
      form.setFieldValue("categoryId", null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Variant Option</DialogTitle>
          <DialogDescription>
            Update the details of &quot;{vo.name}&quot; variant option.
          </DialogDescription>
        </DialogHeader>
        <form
          id="edit-variant-option-form"
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            form.handleSubmit();
          }}
          className="space-y-4"
        >
          {/* Type → Category cascade */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field>
              <FieldLabel>Product Type *</FieldLabel>
              <Select value={selectedTypeId} onValueChange={handleTypeChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select type scope" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="global">🌐 Global (All Types)</SelectItem>
                  {productTypes.map((t) => (
                    <SelectItem key={t.id} value={String(t.id)}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldDescription>
                Global variants are available to all product types
              </FieldDescription>
            </Field>

            <form.Field name="categoryId">
              {(field) => (
                <Field>
                  <FieldLabel>Category</FieldLabel>
                  <Select
                    value={
                      field.state.value ? String(field.state.value) : "none"
                    }
                    onValueChange={(v) =>
                      field.handleChange(v === "none" ? null : Number(v))
                    }
                    disabled={selectedTypeId === "global"}
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder={
                          selectedTypeId === "global"
                            ? "N/A for Global"
                            : "All categories of type"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">
                        All categories of this type
                      </SelectItem>
                      {filteredCategories.map((c) => (
                        <SelectItem key={c.id} value={String(c.id)}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              )}
            </form.Field>
          </div>

          {/* Variant Type */}
          <form.Field name="variantType">
            {(field) => (
              <Field>
                <FieldLabel>Variant Type *</FieldLabel>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="editVariantType"
                      value="pack"
                      checked={field.state.value === "pack"}
                      onChange={() => field.handleChange("pack")}
                      className="h-4 w-4"
                    />
                    <span className="text-sm font-medium">📦 Pack</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="editVariantType"
                      value="loose"
                      checked={field.state.value === "loose"}
                      onChange={() => field.handleChange("loose")}
                      className="h-4 w-4"
                    />
                    <span className="text-sm font-medium">⚖️ Loose</span>
                  </label>
                </div>
              </Field>
            )}
          </form.Field>

          {/* Name, Unit, Size */}
          <form.Subscribe selector={(state) => state.values.variantType}>
            {(variantType) => (
              <div className={`grid grid-cols-1 ${variantType === "loose" ? "sm:grid-cols-2" : "sm:grid-cols-3"} gap-4`}>
                <form.Field name="name">
                  {(field) => (
                    <Field>
                      <FieldLabel htmlFor={field.name}>Variant Name *</FieldLabel>
                      <Input
                        id={field.name}
                        name={field.name}
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                        placeholder={variantType === "loose" ? "e.g. Per Piece" : "e.g. 1KG Pack"}
                        autoComplete="off"
                      />
                    </Field>
                  )}
                </form.Field>

                <form.Field name="unit">
                  {(field) => (
                    <Field>
                      <FieldLabel>Unit *</FieldLabel>
                      <Select
                        value={field.state.value}
                        onValueChange={field.handleChange}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select unit" />
                        </SelectTrigger>
                        <SelectContent>
                          {UNITS.map((u) => (
                            <SelectItem key={u} value={u}>
                              {u}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                  )}
                </form.Field>

                {variantType !== "loose" && (
                  <form.Field name="size">
                    {(field) => (
                      <Field>
                        <FieldLabel htmlFor={field.name}>Size</FieldLabel>
                        <Input
                          id={field.name}
                          name={field.name}
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(e) => field.handleChange(e.target.value)}
                          placeholder="e.g. 1, S, 38"
                          autoComplete="off"
                        />
                      </Field>
                    )}
                  </form.Field>
                )}
              </div>
            )}
          </form.Subscribe>

          {/* Sort Order & Active */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <form.Field name="sortOrder">
              {(field) => (
                <Field>
                  <FieldLabel htmlFor={field.name}>Sort Order</FieldLabel>
                  <Input
                    id={field.name}
                    name={field.name}
                    type="number"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) =>
                      field.handleChange(Number(e.target.value))
                    }
                    placeholder="0"
                    min={0}
                    autoComplete="off"
                  />
                  <FieldDescription>
                    Lower numbers appear first
                  </FieldDescription>
                </Field>
              )}
            </form.Field>

            <form.Field name="isActive">
              {(field) => (
                <Field orientation="horizontal">
                  <FieldContent>
                    <FieldLabel htmlFor={field.name}>Active Status</FieldLabel>
                    <FieldDescription>
                      Disabled variants won&apos;t be available for selection
                    </FieldDescription>
                  </FieldContent>
                  <Switch
                    id="isActive"
                    checked={field.state.value}
                    onCheckedChange={field.handleChange}
                  />
                </Field>
              )}
            </form.Field>
          </div>
        </form>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={mutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="edit-variant-option-form"
            disabled={mutation.isPending}
          >
            {mutation.isPending && (
              <Loader className="mr-2 h-4 w-4 animate-spin" />
            )}
            Update Variant
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
