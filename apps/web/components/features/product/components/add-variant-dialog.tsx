"use client";

import {
  formatVariantDefinition,
  RECOMMENDED_VARIANT_CONTAINERS,
  VARIANT_CONTAINERS,
  type VariantContainerCode,
  type VariantDefinition,
  type VariantProductFamily,
} from "@bikalpo-project/db/variant-definition";
import { Loader2, Plus } from "lucide-react";
import { useEffect, useState } from "react";
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
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** Packed variants are measured in any of these; loose ones by weight or volume. */
const PACK_UNITS = ["KG", "Gram", "ML", "L", "Piece"] as const;
const LOOSE_UNITS = ["KG", "L", "ML"] as const;

const LOOSE = "loose";

export type NewVariantDefinition = Extract<
  VariantDefinition,
  { kind: "measurement" } | { kind: "loose" }
>;

/**
 * "+ variant" from Create Product: Type (container), Size and Inventory Unit.
 * Admin creates a global variant; sellers create a store-only variant.
 * Options are limited to what fits the product type.
 */
export function AddVariantDialog({
  open,
  onOpenChange,
  family,
  scopeLabel,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  family: VariantProductFamily;
  /** Who will see the new variant, shown under the title. */
  scopeLabel: string;
  /** Creates (or reuses) the variant; resolves once it can be selected. */
  onCreate: (definition: NewVariantDefinition) => Promise<unknown>;
}) {
  const recommended = RECOMMENDED_VARIANT_CONTAINERS[family];
  const others = (
    Object.keys(VARIANT_CONTAINERS) as VariantContainerCode[]
  ).filter((code) => !recommended.includes(code));
  // Cylinders are never sold loose.
  const looseAllowed = family !== "lpg";

  const [container, setContainer] = useState<string>(recommended[0] ?? "unit");
  const [size, setSize] = useState("");
  const [unit, setUnit] = useState<string>(family === "lpg" ? "KG" : "Piece");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setContainer(recommended[0] ?? "unit");
    setSize("");
    setUnit(family === "lpg" ? "KG" : "Piece");
    setError("");
  }, [open, family, recommended]);

  const isLoose = container === LOOSE;
  const units: readonly string[] = isLoose ? LOOSE_UNITS : PACK_UNITS;
  const definition: NewVariantDefinition | null = isLoose
    ? { kind: "loose", measurementUnit: unit }
    : size.trim()
      ? {
          kind: "measurement",
          value: size.trim(),
          measurementUnit: unit,
          container,
        }
      : null;

  const changeContainer = (next: string) => {
    setContainer(next);
    if (next === LOOSE && !LOOSE_UNITS.includes(unit as never)) setUnit("KG");
  };

  const submit = async () => {
    if (!definition) {
      setError("Enter the size, for example 12 or 500.");
      return;
    }
    if (!isLoose && !/^\d+(\.\d+)?$/.test(size.trim())) {
      setError("Size must be a number, for example 12 or 0.5.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onCreate(definition);
      toast.success(`${formatVariantDefinition(definition)} added`);
      onOpenChange(false);
    } catch (cause) {
      setError(
        cause instanceof Error && cause.message
          ? cause.message
          : "The variant could not be added. Try again.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add variant</DialogTitle>
          <DialogDescription>{scopeLabel}</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <Field>
            <FieldLabel htmlFor="add-variant-type">Type</FieldLabel>
            <Select value={container} onValueChange={changeContainer}>
              <SelectTrigger id="add-variant-type" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>Recommended</SelectLabel>
                  {recommended.map((code) => (
                    <SelectItem key={code} value={code}>
                      {VARIANT_CONTAINERS[code]}
                    </SelectItem>
                  ))}
                  {looseAllowed && <SelectItem value={LOOSE}>Loose</SelectItem>}
                </SelectGroup>
                {others.length > 0 && family !== "lpg" && (
                  <SelectGroup>
                    <SelectLabel>More types</SelectLabel>
                    {others.map((code) => (
                      <SelectItem key={code} value={code}>
                        {VARIANT_CONTAINERS[code]}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                )}
              </SelectContent>
            </Select>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field>
              <FieldLabel htmlFor="add-variant-size">Size</FieldLabel>
              <Input
                id="add-variant-size"
                inputMode="decimal"
                autoComplete="off"
                placeholder={isLoose ? "Sold by weight" : "e.g. 12"}
                disabled={isLoose || saving}
                value={isLoose ? "" : size}
                onChange={(event) => setSize(event.target.value)}
                aria-invalid={!!error && !isLoose}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="add-variant-unit">Inventory Unit</FieldLabel>
              <Select value={unit} onValueChange={setUnit}>
                <SelectTrigger id="add-variant-unit" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {units.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <FieldDescription>
            {definition
              ? `Will appear as “${formatVariantDefinition(definition)}”.`
              : "Enter a size to preview the variant name."}
            {container === "cylinder" &&
              " Cylinder variants get Exchange and New prices automatically."}
          </FieldDescription>

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              disabled={saving}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Plus className="size-4" aria-hidden="true" />
              )}
              {saving ? "Adding…" : "Add variant"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
