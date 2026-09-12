import { z } from "zod";

export const toLetFacilityKeys = ["water", "gas", "electricity", "internet", "lift", "parking", "generator", "security", "cctv", "furnished"] as const;
export type ToLetFacilityKey = (typeof toLetFacilityKeys)[number];
export const toLetFacilityInclusionsSchema = z.partialRecord(z.enum(toLetFacilityKeys), z.boolean());
export type ToLetFacilityInclusions = z.infer<typeof toLetFacilityInclusionsSchema>;

// Missing legacy values are unknown, never inferred from availability.
export function facilityInclusion(inclusions: ToLetFacilityInclusions | null | undefined, key: ToLetFacilityKey) {
  return inclusions?.[key] ?? null;
}

export function normalizeFacilityInclusions(inclusions: ToLetFacilityInclusions, availability: Partial<Record<ToLetFacilityKey, boolean>>) {
  return Object.fromEntries(Object.entries(inclusions).map(([key, value]) => [key, availability[key as ToLetFacilityKey] === false ? false : value])) as ToLetFacilityInclusions;
}
