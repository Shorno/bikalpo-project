import { z } from "zod";

const coordinate = (limit: number) => z.string().trim().refine(
  value => value !== "" && Number.isFinite(Number(value)) && Math.abs(Number(value)) <= limit,
  "Enter a valid map coordinate",
).nullable().default(null);

export const unitAddressSchema = z.object({
  division: z.string().trim().min(2, "Select a division").max(100),
  district: z.string().trim().min(2, "Select a district").max(100),
  upazila: z.string().trim().min(2, "Select an Upazila / Thana").max(150),
  area: z.string().trim().min(2, "Select an area").max(150),
  fullAddress: z.string().trim().min(5, "Enter the unit's full address").max(1000),
  nearbyLandmark: z.string().trim().max(300).default(""),
  latitude: coordinate(90),
  longitude: coordinate(180),
}).strict().refine(value => value.latitude !== null && value.longitude !== null, {
  message: "Capture the unit GPS location", path: ["latitude"],
});

export type UnitAddress = z.infer<typeof unitAddressSchema>;

/** Null means inherit the property's current address; never mix two addresses. */
export function effectiveUnitAddress<T extends {
  division: string; district: string; area: string; fullAddress: string;
  upazila?: string | null; nearbyLandmark?: string | null;
  latitude?: string | null; longitude?: string | null;
}>(property: T, unit: { addressOverride?: UnitAddress | null }) {
  return unit.addressOverride ?? property;
}

export function unitLocationLabel(property: Parameters<typeof effectiveUnitAddress>[0], unit: {addressOverride?: UnitAddress | null}) {
  const address = effectiveUnitAddress(property, unit);
  return [address.area, address.upazila, address.district, address.division].filter(Boolean).join(", ");
}
