"use client";

import { useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader, Package } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { orpc } from "@/utils/orpc";

const UNITS = ["KG", "ML", "L", "Pc", "Size", "Box", "Carton", "Ton", "Pair", "Unit"];

interface Props {
  options: any;
}

export default function VariantRequestModal({ options }: Props) {
  const [open, setOpen] = React.useState(false);
  const queryClient = useQueryClient();
  const [selectedTypeId, setSelectedTypeId] = React.useState<string>("global");

  const filteredCategories = React.useMemo(() => {
    if (selectedTypeId === "global" || !selectedTypeId) return [];
    return (options?.categories ?? []).filter(
      (c: any) => c.typeId === Number(selectedTypeId),
    );
  }, [options?.categories, selectedTypeId]);

  const mutation = useMutation({
    mutationFn: (payload: any) =>
      orpc.warehouseCatalogApproval.createRequest.call({
        requestType: "variant_option" as const,
        payload,
      }),
    onSuccess: async (result) => {
      toast.success(result.message || "Variant request submitted");
      await queryClient.invalidateQueries({
        queryKey: ["warehouseCatalogApproval", "myRequests"],
      });
      form.reset();
      setSelectedTypeId("global");
      setOpen(false);
    },
    onError: (error: any) => toast.error(error.message || "Request failed"),
  });

  const form = useForm({
    defaultValues: {
      name: "",
      unit: "KG",
      size: "",
      variantType: "pack" as "pack" | "loose",
      typeId: null as number | null,
      categoryId: null as number | null,
      sortOrder: 0,
    },
    onSubmit: async ({ value }) => mutation.mutate(value),
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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Package className="h-4 w-4" />
          New Variant
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Request a Variant Option</DialogTitle>
          <DialogDescription>
            Submit a new variant option for admin approval.
          </DialogDescription>
        </DialogHeader>
        <form
          id="variant-request-form"
          onSubmit={(e) => { e.preventDefault(); e.stopPropagation(); form.handleSubmit(); }}
          className="space-y-4"
        >
          {/* Type → Category cascade */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field>
              <FieldLabel>Product Type *</FieldLabel>
              <Select value={selectedTypeId} onValueChange={handleTypeChange}>
                <SelectTrigger><SelectValue placeholder="Select type scope" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="global">🌐 Global (All Types)</SelectItem>
                  {(options?.types ?? []).map((t: any) => (
                    <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldDescription>Global variants are available to all product types</FieldDescription>
            </Field>

            <form.Field name="categoryId">
              {(field) => (
                <Field>
                  <FieldLabel>Category {selectedTypeId !== "global" ? "(optional)" : ""}</FieldLabel>
                  <Select
                    value={field.state.value ? String(field.state.value) : "none"}
                    onValueChange={(v) => field.handleChange(v === "none" ? null : Number(v))}
                    disabled={selectedTypeId === "global"}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={selectedTypeId === "global" ? "N/A for Global" : "All categories of type"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">All categories of this type</SelectItem>
                      {filteredCategories.map((c: any) => (
                        <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FieldDescription>
                    {selectedTypeId === "global" ? "Not applicable for global variants" : "Leave as 'All' for type-wide scope"}
                  </FieldDescription>
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
                    <input type="radio" name="variantType" value="pack" checked={field.state.value === "pack"} onChange={() => field.handleChange("pack")} className="h-4 w-4" />
                    <span className="text-sm font-medium">📦 Pack</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="variantType" value="loose" checked={field.state.value === "loose"} onChange={() => field.handleChange("loose")} className="h-4 w-4" />
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
                      <Input id={field.name} value={field.state.value} onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                        placeholder={variantType === "loose" ? "e.g. Per Piece" : "e.g. 1KG Pack"} autoComplete="off" />
                    </Field>
                  )}
                </form.Field>

                <form.Field name="unit">
                  {(field) => (
                    <Field>
                      <FieldLabel>Unit *</FieldLabel>
                      <Select value={field.state.value} onValueChange={field.handleChange}>
                        <SelectTrigger><SelectValue placeholder="Select unit" /></SelectTrigger>
                        <SelectContent>
                          {UNITS.map((u) => (<SelectItem key={u} value={u}>{u}</SelectItem>))}
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
                        <Input id={field.name} value={field.state.value} onBlur={field.handleBlur}
                          onChange={(e) => field.handleChange(e.target.value)}
                          placeholder="e.g. 1, S, 38" autoComplete="off" />
                        <FieldDescription>Leave empty for generic variants</FieldDescription>
                      </Field>
                    )}
                  </form.Field>
                )}
              </div>
            )}
          </form.Subscribe>

          {/* Sort Order */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <form.Field name="sortOrder">
              {(field) => (
                <Field>
                  <FieldLabel htmlFor={field.name}>Sort Order</FieldLabel>
                  <Input id={field.name} type="number" value={field.state.value} onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(Number(e.target.value))} placeholder="0" min={0} autoComplete="off" />
                  <FieldDescription>Lower numbers appear first</FieldDescription>
                </Field>
              )}
            </form.Field>
          </div>
        </form>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={mutation.isPending}>Cancel</Button>
          <Button type="submit" form="variant-request-form" disabled={mutation.isPending}>
            {mutation.isPending && <Loader className="mr-2 h-4 w-4 animate-spin" />}
            Submit Request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
