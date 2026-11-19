import { z } from "zod";

export const toLetFacilityKeys = ["water", "gas", "electricity", "internet", "lift", "parking", "generator", "security", "cctv", "furnished"] as const;
export type ToLetFacilityKey = (typeof toLetFacilityKeys)[number];
// `notAvailable`: facilities the building has but this listing's unit does not.
export const toLetFacilityInclusionsSchema = z.strictObject({
  ...(Object.fromEntries(toLetFacilityKeys.map((key) => [key, z.boolean().optional()])) as Record<ToLetFacilityKey, z.ZodOptional<z.ZodBoolean>>),
  notAvailable: z.array(z.enum(toLetFacilityKeys)).optional(),
});
export type ToLetFacilityInclusions = z.infer<typeof toLetFacilityInclusionsSchema>;

// Missing legacy values are unknown, never inferred from availability.
export function facilityInclusion(inclusions: ToLetFacilityInclusions | null | undefined, key: ToLetFacilityKey) {
  return inclusions?.[key] ?? null;
}

export function isFacilityOffered(inclusions: ToLetFacilityInclusions | null | undefined, key: ToLetFacilityKey, buildingHasIt: boolean | undefined) {
  return buildingHasIt === true && !inclusions?.notAvailable?.includes(key);
}

export function normalizeFacilityInclusions(inclusions: ToLetFacilityInclusions, availability: Partial<Record<ToLetFacilityKey, boolean>>) {
  const { notAvailable, ...flags } = inclusions;
  const normalized = Object.fromEntries(Object.entries(flags).map(([key, value]) => [
    key,
    availability[key as ToLetFacilityKey] === false || notAvailable?.includes(key as ToLetFacilityKey) ? false : value,
  ])) as ToLetFacilityInclusions;
  return notAvailable?.length ? { ...normalized, notAvailable } : normalized;
}
