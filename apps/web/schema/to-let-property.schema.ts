import { z } from "zod";

const httpUrl = z.string().trim().max(2048).pipe(z.httpUrl());

const optionalUrl = z.union([z.literal(""), httpUrl]);

const mobileNumberSchema =
  process.env.NODE_ENV === "development"
    ? z
        .string()
        .trim()
        .min(1, "Mobile number is required")
        .max(30)
        .refine((value) => /\d/.test(value), "Enter a mobile number")
    : z
        .string()
        .trim()
        .regex(/^(?:\+?880|0)1[3-9]\d{8}$/, "Enter a valid mobile number");

function optionalCoordinate(minimum: number, maximum: number, label: string) {
  return z
    .string()
    .trim()
    .refine((value) => {
      if (value === "") return true;
      const coordinate = Number(value);
      return (
        Number.isFinite(coordinate) &&
        coordinate >= minimum &&
        coordinate <= maximum
      );
    }, `${label} must be between ${minimum} and ${maximum}`);
}

export const propertyTypeValues = [
  "apartment",
  "residential_building",
  "commercial_building",
  "office",
  "market",
  "warehouse",
  "mixed_use",
  "other",
] as const;

export const propertyTypes = [
  { value: "apartment", label: "Apartment" },
  { value: "residential_building", label: "Residential Building" },
  { value: "commercial_building", label: "Commercial Building" },
  { value: "office", label: "Office" },
  { value: "market", label: "Market" },
  { value: "warehouse", label: "Warehouse" },
  { value: "mixed_use", label: "Mixed Use" },
  { value: "other", label: "Other" },
] as const;

export const buildingTypeValues = [
  "residential",
  "commercial",
  "mixed_use",
  "industrial",
  "other",
] as const;

export const buildingTypes = [
  { value: "residential", label: "Residential" },
  { value: "commercial", label: "Commercial" },
  { value: "mixed_use", label: "Mixed Use" },
  { value: "industrial", label: "Industrial" },
  { value: "other", label: "Other" },
] as const;

export const unitTypeValues = [
  "family_flat",
  "bachelor_room",
  "office",
  "shop",
  "warehouse",
  "garage",
  "sublet",
  "other",
] as const;

export const unitTypes = [
  { value: "family_flat", label: "Family Flat" },
  { value: "bachelor_room", label: "Bachelor Room" },
  { value: "office", label: "Office" },
  { value: "shop", label: "Shop" },
  { value: "warehouse", label: "Warehouse" },
  { value: "garage", label: "Garage" },
  { value: "sublet", label: "Sublet" },
  { value: "other", label: "Other" },
] as const;

export const propertyBasicSchema = z.object({
  name: z.string().trim().min(2, "Property name is required").max(200),
  coverImageUrl: httpUrl,
  ownerName: z.string().trim().min(2, "Owner name is required").max(150),
  mobileNumber: mobileNumberSchema,
  email: z.union([z.literal(""), z.email("Enter a valid email address")]),
  propertyType: z.enum(propertyTypeValues, {
    error: "Select a property type",
  }),
  division: z.string().trim().min(2, "Division is required").max(100),
  district: z.string().trim().min(2, "District is required").max(100),
  area: z.string().trim().min(2, "Area or Upazila is required").max(150),
  fullAddress: z.string().trim().min(5, "Full address is required").max(1000),
  nearbyLandmark: z.string().trim().max(500),
  latitude: optionalCoordinate(-90, 90, "Latitude"),
  longitude: optionalCoordinate(-180, 180, "Longitude"),
});

export const propertyBuildingSchema = z.object({
  buildingType: z.enum(buildingTypeValues, {
    error: "Select a building type",
  }),
  totalFloors: z.coerce
    .number()
    .int("Use a whole number")
    .min(1, "At least one floor is required")
    .max(500),
  declaredTotalUnits: z.coerce
    .number()
    .int("Use a whole number")
    .min(1, "At least one unit is required")
    .max(10000),
  hasParking: z.boolean(),
  hasLift: z.boolean(),
  hasSecurityGuard: z.boolean(),
  hasCctv: z.boolean(),
  hasGenerator: z.boolean(),
  hasWaterSupply: z.boolean(),
  hasGasConnection: z.boolean(),
  hasElectricity: z.boolean(),
  description: z.string().trim().max(5000),
});

export const propertyVerificationSchema = z.object({
  frontImageUrl: httpUrl,
  buildingImageUrl: z.union([z.literal(""), httpUrl]),
  videoUrl: optionalUrl,
  phoneVerified: z.literal(true, {
    error: "Verify the property contact number",
  }),
});

export const propertyReviewSchema = z.object({
  informationConfirmed: z.literal(true, {
    error: "Confirm that the information is correct",
  }),
  termsAccepted: z.literal(true, { error: "Accept the property terms" }),
  propertyPolicyAccepted: z.literal(true, {
    error: "Accept the property policy",
  }),
});

export const propertyRegistrationSchema = propertyBasicSchema
  .merge(propertyBuildingSchema)
  .merge(propertyVerificationSchema)
  .merge(propertyReviewSchema);

type ParsedPropertyRegistration = z.infer<typeof propertyRegistrationSchema>;
export type PropertyRegistrationValues = Omit<
  ParsedPropertyRegistration,
  | "propertyType"
  | "buildingType"
  | "phoneVerified"
  | "informationConfirmed"
  | "termsAccepted"
  | "propertyPolicyAccepted"
> & {
  propertyType: string;
  buildingType: string;
  phoneVerified: boolean;
  informationConfirmed: boolean;
  termsAccepted: boolean;
  propertyPolicyAccepted: boolean;
};

export const propertyEditableSchema = propertyBasicSchema
  .merge(propertyBuildingSchema)
  .merge(propertyVerificationSchema);

type ParsedPropertyEditable = z.infer<typeof propertyEditableSchema>;
export type PropertyEditableValues = Omit<
  ParsedPropertyEditable,
  "propertyType" | "buildingType" | "phoneVerified"
> & {
  propertyType: string;
  buildingType: string;
  phoneVerified: boolean;
};

export const unitSchema = z.object({
  name: z.string().trim().min(1, "Unit name or number is required").max(100),
  unitType: z.enum(unitTypeValues, { error: "Select a unit type" }),
  floorNumber: z.coerce
    .number()
    .int("Use a whole floor number")
    .min(-10, "Floor number cannot be below basement 10")
    .max(500),
  sizeSqFt: z.coerce
    .number()
    .int("Use a whole number")
    .min(1, "Unit size is required")
    .max(10000000),
  bedrooms: z.coerce.number().int().min(0).max(100),
  bathrooms: z.coerce.number().int().min(0).max(100),
  balconies: z.coerce.number().int().min(0).max(100),
  hasDrawingRoom: z.boolean(),
  hasDiningSpace: z.boolean(),
  hasKitchen: z.boolean(),
  isFurnished: z.boolean(),
  description: z.string().trim().max(3000),
  imageUrls: z.array(httpUrl).max(8),
});

type ParsedUnit = z.infer<typeof unitSchema>;
export type UnitFormValues = Omit<ParsedUnit, "unitType"> & {
  unitType: string;
};
