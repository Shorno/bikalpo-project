import { unitTypeValues } from "../schema/to-let-property.schema";

export type ToLetMarketRentalType = (typeof unitTypeValues)[number];

export interface ToLetMarketplaceSearchParams {
  q?: string | string[];
  type?: string | string[];
}

export interface SearchableToLetListing {
  listingCode: string;
  propertyCode: string;
  unitCode: string;
  title: string;
  description: string | null;
  location: string;
  property: {
    name: string;
    area: string;
    district: string;
    division: string;
  };
  unit: {
    name: string;
    unitType: string;
  };
}

const rentalTypeSet = new Set<string>(unitTypeValues);

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function isToLetRentalType(
  value: string | undefined,
): value is ToLetMarketRentalType {
  return Boolean(value && rentalTypeSet.has(value));
}

export function parseToLetSearchParams(params: ToLetMarketplaceSearchParams) {
  const query = (firstValue(params.q) ?? "").trim().slice(0, 200);
  const type = firstValue(params.type);

  return {
    query,
    selectedType: isToLetRentalType(type) ? type : undefined,
  };
}

export function toLetMarketHref(query: string, type?: ToLetMarketRentalType) {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (type) params.set("type", type);
  const search = params.toString();
  return `/to-let${search ? `?${search}` : ""}#listings`;
}

export function searchableToLetListingText(listing: SearchableToLetListing) {
  return [
    listing.listingCode,
    listing.propertyCode,
    listing.unitCode,
    listing.title,
    listing.description,
    listing.location,
    listing.property.name,
    listing.property.area,
    listing.property.district,
    listing.property.division,
    listing.unit.name,
    listing.unit.unitType,
  ]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase();
}

export function filterToLetMarketplaceListings<
  Listing extends SearchableToLetListing,
>(listings: Listing[], query: string, selectedType?: ToLetMarketRentalType) {
  const normalizedQuery = query.toLocaleLowerCase();
  const queryMatched = normalizedQuery
    ? listings.filter((listing) =>
        searchableToLetListingText(listing).includes(normalizedQuery),
      )
    : listings;
  const filtered = selectedType
    ? queryMatched.filter((listing) => listing.unit.unitType === selectedType)
    : queryMatched;

  return { queryMatched, filtered };
}
