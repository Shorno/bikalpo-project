"use client";

import { Building2, Loader2, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import AdditionalImagesUploader from "@/components/AdditionalImagesUploader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  useCreateToLetUnit,
  useMyToLetProperty,
  useUpdateToLetUnit,
} from "@/hooks/use-to-let-property-api";
import {
  type UnitFormValues,
  unitSchema,
  unitTypes,
} from "@/schema/to-let-property.schema";
import { IncludedExcludedButtons } from "./included-excluded-buttons";
import { propertyFromResponse } from "./property-details-client";
import {
  PropertyDetailsSkeleton,
  PropertyErrorState,
  PropertyPageHeader,
} from "./property-ui";
import type { ToLetPropertyView, ToLetUnitView } from "./types";

const emptyUnit: UnitFormValues = {
  name: "",
  unitType: "",
  floorNumber: 0,
  sizeSqFt: 1,
  bedrooms: 0,
  bathrooms: 0,
  balconies: 0,
  hasDrawingRoom: false,
  hasDiningSpace: false,
  hasKitchen: false,
  isFurnished: false,
  description: "",
  imageUrls: [],
};

function valuesFromUnit(unit?: ToLetUnitView): UnitFormValues {
  return unit
    ? {
        name: unit.name,
        unitType: unit.unitType,
        floorNumber: unit.floorNumber,
        sizeSqFt: unit.sizeSqFt,
        bedrooms: unit.bedrooms,
        bathrooms: unit.bathrooms,
        balconies: unit.balconies,
        hasDrawingRoom: unit.hasDrawingRoom,
        hasDiningSpace: unit.hasDiningSpace,
        hasKitchen: unit.hasKitchen,
        isFurnished: unit.isFurnished,
        description: unit.description ?? "",
        imageUrls: unit.imageUrls,
      }
    : emptyUnit;
}

function UnitError({ message }: { message?: string }) {
  return message ? (
    <p role="alert" className="text-xs text-red-600">
      {message}
    </p>
  ) : null;
}

function UnitToggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex min-h-12 cursor-pointer items-center justify-between rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700">
      {label}
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  );
}

function LoadedUnitForm({
  property,
  unit,
}: {
  property: ToLetPropertyView;
  unit?: ToLetUnitView;
}) {
  const router = useRouter();
  const createMutation = useCreateToLetUnit();
  const updateMutation = useUpdateToLetUnit();
  const [values, setValues] = useState(() => valuesFromUnit(unit));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const isEditing = Boolean(unit);
  const isPending = createMutation.isPending || updateMutation.isPending;

  const update = <K extends keyof UnitFormValues>(
    key: K,
    value: UnitFormValues[K],
  ) => {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const parsed = unitSchema.safeParse(values);
    if (!parsed.success) {
      const nextErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "form");
        if (!nextErrors[key]) nextErrors[key] = issue.message;
      }
      setErrors(nextErrors);
      toast.error("Please review the highlighted fields");
      return;
    }

    const data = {
      ...parsed.data,
      description: parsed.data.description || undefined,
    };

    try {
      if (unit) {
        await updateMutation.mutateAsync({
          propertyCode: property.propertyCode,
          unitCode: unit.unitCode,
          data,
        });
        router.push(
          `/account/to-let/properties/${property.propertyCode}/units/${unit.unitCode}`,
        );
      } else {
        await createMutation.mutateAsync({
          propertyCode: property.propertyCode,
          data,
        });
        router.push(`/account/to-let/properties/${property.propertyCode}`);
      }
    } catch {
      // Mutation hooks display API errors.
    }
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      <PropertyPageHeader
        title={isEditing ? "Edit Unit" : "Create Unit"}
        description={`${property.name} · ${property.propertyCode}`}
        backHref={
          unit
            ? `/account/to-let/properties/${property.propertyCode}/units/${unit.unitCode}`
            : `/account/to-let/properties/${property.propertyCode}`
        }
      />

      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
        <div className="flex items-start gap-3">
          <Building2 className="mt-0.5 size-5 shrink-0 text-emerald-600" />
          <div>
            <p className="text-sm font-semibold text-emerald-900">
              Physical unit only
            </p>
            <p className="mt-0.5 text-xs leading-5 text-emerald-700">
              Rent, availability, contact and publishing belong to a future
              listing. This unit can be reused for multiple listings over time.
            </p>
          </div>
        </div>
      </div>

      <section className="rounded-lg border border-gray-200 bg-white p-5 sm:p-6">
        <h2 className="font-semibold text-gray-900">Unit identity</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="unit-name">Unit Name / Number *</Label>
            <Input
              id="unit-name"
              value={values.name}
              onChange={(event) => update("name", event.target.value)}
              placeholder="e.g. Flat-A2"
              aria-invalid={Boolean(errors.name)}
            />
            <UnitError message={errors.name} />
          </div>
          <div className="space-y-1.5">
            <Label>Unit Type *</Label>
            <Select
              value={values.unitType}
              onValueChange={(value) => update("unitType", value)}
            >
              <SelectTrigger aria-invalid={Boolean(errors.unitType)}>
                <SelectValue placeholder="Select unit type" />
              </SelectTrigger>
              <SelectContent>
                {unitTypes.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <UnitError message={errors.unitType} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="floor-number">Floor Number *</Label>
            <Input
              id="floor-number"
              type="number"
              min={-10}
              max={property.totalFloors}
              value={values.floorNumber}
              onChange={(event) =>
                update("floorNumber", Number(event.target.value))
              }
              aria-invalid={Boolean(errors.floorNumber)}
            />
            <p className="text-xs text-gray-500">
              Use 0 for ground floor and a negative number for a basement. The
              highest floor is {property.totalFloors}.
            </p>
            <UnitError message={errors.floorNumber} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="unit-size">Unit Size *</Label>
            <div className="relative">
              <Input
                id="unit-size"
                type="number"
                min={1}
                value={values.sizeSqFt}
                onChange={(event) =>
                  update("sizeSqFt", Number(event.target.value))
                }
                aria-invalid={Boolean(errors.sizeSqFt)}
                className="pr-16"
              />
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-gray-500">
                sq ft
              </span>
            </div>
            <UnitError message={errors.sizeSqFt} />
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-5 sm:p-6">
        <h2 className="font-semibold text-gray-900">Physical details</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {(
            [
              ["bedrooms", "Bedrooms"],
              ["bathrooms", "Bathrooms"],
              ["balconies", "Balconies"],
            ] as const
          ).map(([key, label]) => (
            <div key={key} className="space-y-1.5">
              <Label htmlFor={`unit-${key}`}>{label}</Label>
              <Input
                id={`unit-${key}`}
                type="number"
                min={0}
                value={values[key]}
                onChange={(event) => update(key, Number(event.target.value))}
                aria-invalid={Boolean(errors[key])}
              />
              <UnitError message={errors[key]} />
            </div>
          ))}
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {(
            [
              ["hasDrawingRoom", "Drawing room"],
              ["hasDiningSpace", "Dining space"],
              ["hasKitchen", "Kitchen"],
              ["isFurnished", "Furnished"],
            ] as const
          ).map(([key, label]) =>
            key === "isFurnished" ? (
              <div
                key={key}
                className="flex min-h-14 items-center justify-between gap-3 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700"
              >
                {label}
                <IncludedExcludedButtons
                  label={label}
                  included={values[key]}
                  onChange={(included) => update(key, included)}
                />
              </div>
            ) : (
              <UnitToggle
                key={key}
                label={label}
                checked={values[key]}
                onChange={(checked) => update(key, checked)}
              />
            ),
          )}
        </div>
        <div className="mt-4 space-y-1.5">
          <Label htmlFor="unit-description">Unit Description</Label>
          <Textarea
            id="unit-description"
            value={values.description}
            onChange={(event) => update("description", event.target.value)}
            placeholder="Optional physical description of the unit"
            rows={5}
          />
          <UnitError message={errors.description} />
        </div>
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-5 sm:p-6">
        <h2 className="font-semibold text-gray-900">Unit photos</h2>
        <p className="mt-1 text-sm text-gray-500">
          Add up to 8 reusable JPG, PNG or WebP photos.
        </p>
        <div className="mt-4">
          <AdditionalImagesUploader
            value={values.imageUrls}
            onChange={(urls) => update("imageUrls", urls)}
            folder="to-let/units"
            maxFiles={8}
            compact
          />
          <UnitError message={errors.imageUrls} />
        </div>
      </section>

      <div className="sticky bottom-0 z-10 -mx-4 border-t border-gray-200 bg-white px-4 py-4 sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0">
        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isPending}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {isPending ? <Loader2 className="animate-spin" /> : <Save />}
            {isPending
              ? "Saving..."
              : isEditing
                ? "Save Changes"
                : "Create Unit"}
          </Button>
        </div>
      </div>
    </form>
  );
}

export function UnitForm({
  propertyCode,
  unitCode,
}: {
  propertyCode: string;
  unitCode?: string;
}) {
  const query = useMyToLetProperty(propertyCode);
  if (query.isLoading) return <PropertyDetailsSkeleton />;
  if (query.isError) {
    return <PropertyErrorState onRetry={() => query.refetch()} />;
  }

  const property = propertyFromResponse(query.data);
  if (!property) {
    return <PropertyErrorState message="This property could not be found." />;
  }
  if (property.status === "blocked") {
    return (
      <PropertyErrorState message="This property is blocked and its units cannot be changed." />
    );
  }

  const unit = unitCode
    ? property.units?.find((item) => item.unitCode === unitCode)
    : undefined;
  if (unitCode && !unit) {
    return <PropertyErrorState message="This unit could not be found." />;
  }

  return <LoadedUnitForm property={property} unit={unit} />;
}
