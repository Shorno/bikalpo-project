import { districtsForDivision } from "./bangladesh-locations";
import locations from "./property-location-data.json";

const data: Record<string, Record<string, string[]>> = locations;
const key = (value: string) => value.trim().toLowerCase();

export function upazilasForDistrict(
  division: string,
  district: string,
): string[] {
  if (!districtsForDivision(division).includes(district)) return [];
  return Object.keys(data[district] ?? {});
}

export function areasForUpazila(
  division: string,
  district: string,
  upazila: string,
): string[] {
  const match = upazilasForDistrict(division, district).find(
    (name) => key(name) === key(upazila),
  );
  return match ? data[district][match] : [];
}
