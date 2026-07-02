"use client";

import { useEffect, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Field, FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  BUSINESS_NATURES,
  MONTHLY_SALES_VOLUME,
  YEARS_IN_BUSINESS,
} from "@/constants/seller-registration";
import type { LocationData } from "@/constants/seller-registration";
import { client } from "@/utils/orpc";
import {
  RegistrationActions,
  RegistrationFieldLabel,
  RegistrationSection,
} from "./registration-primitives";
import {
  LocationPickerSection,
  isLocationComplete,
} from "./location-picker-section";

export interface StepBusinessData {
  shopName: string;
  businessNature: string;
  productTypeId: number | null;
  productTypeName: string;
  businessLocation: LocationData;
  yearsInBusiness: string;
  monthlyRevenue: string;
}

interface StepBusinessProfileProps {
  data: StepBusinessData;
  onUpdate: (data: StepBusinessData) => void;
  onNext: () => void;
  onBack: () => void;
}

export function StepBusinessProfile({
  data,
  onUpdate,
  onNext,
  onBack,
}: StepBusinessProfileProps) {
  const [productTypes, setProductTypes] = useState<
    { id: number; name: string }[]
  >([]);
  const [loadingTypes, setLoadingTypes] = useState(true);

  useEffect(() => {
    client.adminProductType
      .getActiveTypes()
      .then((result) => {
        setProductTypes(result.types.map((t) => ({ id: t.id, name: t.name })));
      })
      .catch(() => setProductTypes([]))
      .finally(() => setLoadingTypes(false));
  }, []);

  const canProceed =
    data.shopName &&
    data.businessNature &&
    data.productTypeId &&
    isLocationComplete(data.businessLocation);

  return (
    <div className="w-full">
      <RegistrationSection title="Business identity">
        <FieldGroup>
          <Field>
            <RegistrationFieldLabel required htmlFor="shopName">
              Business name
            </RegistrationFieldLabel>
            <Input
              id="shopName"
              type="text"
              value={data.shopName}
              onChange={(e) => onUpdate({ ...data, shopName: e.target.value })}
              placeholder="Enter business name"
              className="h-9"
            />
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field>
              <RegistrationFieldLabel required>Business nature</RegistrationFieldLabel>
              <Select
                value={data.businessNature}
                onValueChange={(value) =>
                  onUpdate({ ...data, businessNature: value })
                }
              >
                <SelectTrigger className="h-9 w-full">
                  <SelectValue placeholder="Select nature" />
                </SelectTrigger>
                <SelectContent>
                  {BUSINESS_NATURES.map((nature) => (
                    <SelectItem key={nature.id} value={nature.id}>
                      {nature.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <RegistrationFieldLabel required>Business type</RegistrationFieldLabel>
              {loadingTypes ? (
                <div className="h-9 w-full animate-pulse rounded-lg bg-muted" />
              ) : (
                <Select
                  value={data.productTypeId ? String(data.productTypeId) : ""}
                  onValueChange={(value) => {
                    const selected = productTypes.find(
                      (t) => t.id === Number(value),
                    );
                    onUpdate({
                      ...data,
                      productTypeId: Number(value),
                      productTypeName: selected?.name || "",
                    });
                  }}
                  disabled={productTypes.length === 0}
                >
                  <SelectTrigger className="h-9 w-full">
                    <SelectValue
                      placeholder={
                        productTypes.length === 0
                          ? "No types available"
                          : "Select type"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {productTypes.map((type) => (
                      <SelectItem key={type.id} value={String(type.id)}>
                        {type.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </Field>
          </div>
        </FieldGroup>
      </RegistrationSection>

      <RegistrationSection
        title="Business location"
        description="Where is your business located?"
      >
        <LocationPickerSection
          label="Business address"
          data={data.businessLocation}
          onUpdate={(businessLocation) =>
            onUpdate({ ...data, businessLocation })
          }
        />
      </RegistrationSection>

      <RegistrationSection title="Business history">
        <FieldGroup>
          <Field>
            <RegistrationFieldLabel optional>Business age</RegistrationFieldLabel>
            <ToggleGroup
              type="single"
              variant="outline"
              size="sm"
              value={data.yearsInBusiness}
              onValueChange={(value) =>
                value && onUpdate({ ...data, yearsInBusiness: value })
              }
              className="flex flex-wrap gap-2"
            >
              {YEARS_IN_BUSINESS.map((option) => (
                <ToggleGroupItem
                  key={option}
                  value={option}
                  className="min-h-9 px-3 text-xs"
                >
                  {option}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </Field>

          <Field>
            <RegistrationFieldLabel optional>Monthly sales volume</RegistrationFieldLabel>
            <ToggleGroup
              type="single"
              variant="outline"
              size="sm"
              value={data.monthlyRevenue}
              onValueChange={(value) =>
                value && onUpdate({ ...data, monthlyRevenue: value })
              }
              className="flex flex-wrap gap-2"
            >
              {MONTHLY_SALES_VOLUME.map((option) => (
                <ToggleGroupItem
                  key={option}
                  value={option}
                  className="min-h-9 px-3 text-xs"
                >
                  {option}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </Field>
        </FieldGroup>
      </RegistrationSection>

      <RegistrationActions
        onBack={onBack}
        onPrimary={onNext}
        primaryLabel="Continue"
        primaryDisabled={!canProceed}
      />
    </div>
  );
}
