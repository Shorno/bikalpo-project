import {
  BUSINESS_NATURES as BUSINESS_NATURE_IDS,
  type BusinessNature,
  resolveBusinessRegistration,
  WAREHOUSE_OWNER_BUSINESS_NATURES,
} from "@bikalpo-project/api/business-registration";

const BUSINESS_NATURE_LABELS: Record<BusinessNature, string> = {
  retail_shop: "Retail Shop",
  wholesaler: "Wholesaler",
  distributor: "Distributor",
  manufacturer: "Manufacturer",
  importer: "Importer",
};

/** Business nature options for business registration (Step 2). */
export const BUSINESS_NATURES = BUSINESS_NATURE_IDS.map((id) => ({
  id,
  label: BUSINESS_NATURE_LABELS[id],
}));

export type BusinessNatureId = BusinessNature;

/** Business natures that enter the Warehouse Owner application path. */
export const WAREHOUSE_NATURES: readonly BusinessNatureId[] =
  WAREHOUSE_OWNER_BUSINESS_NATURES;

export function isWarehouseNature(nature: string): boolean {
  if (!BUSINESS_NATURE_IDS.includes(nature as BusinessNature)) return false;
  return (
    resolveBusinessRegistration(nature as BusinessNature).applicationPath ===
    "warehouse"
  );
}

export const YEARS_IN_BUSINESS = [
  "New Business",
  "Less Than 1 Year",
  "1 - 5 Years",
  "5+ Years",
] as const;

export const MONTHLY_SALES_VOLUME = [
  "Under ৳50,000",
  "৳50,000 - ৳2 Lakh",
  "৳2 Lakh - ৳10 Lakh",
  "Above ৳10 Lakh",
] as const;

export const GENDERS = [
  { id: "male", label: "Male" },
  { id: "female", label: "Female" },
  { id: "other", label: "Other" },
] as const;

/** Common Bangladesh banks for registration bank select */
export const BANKS = [
  "Sonali Bank",
  "Janata Bank",
  "Agrani Bank",
  "Rupali Bank",
  "BKB",
  "Rajshahi Krishi Unnayan Bank",
  "Pubali Bank",
  "UCB",
  "City Bank",
  "Eastern Bank",
  "BRAC Bank",
  "Dutch-Bangla Bank",
  "Islami Bank Bangladesh",
  "Al-Arafah Islami Bank",
  "Prime Bank",
  "Mercantile Bank",
  "Standard Bank",
  "One Bank",
  "Exim Bank",
  "Bangladesh Commerce Bank",
  "Mutual Trust Bank",
  "NCC Bank",
  "IFIC Bank",
  "Jamuna Bank",
  "Shimanto Bank",
  "Trust Bank",
  "Bank Asia",
  "Midland Bank",
  "NRB Bank",
  "Meghna Bank",
  "Modhumoti Bank",
  "SBAC Bank",
  "Shahjalal Islami Bank",
  "South Bangla Agriculture and Commerce Bank",
  "The Premier Bank",
  "Union Bank",
  "Uttara Bank",
  "bKash",
  "Nagad",
  "Rocket",
  "Other",
] as const;

export type LocationData = {
  address: string;
  addressBn: string;
  division: string;
  district: string;
  area: string;
  postCode: string;
  latitude: number;
  longitude: number;
};

export const EMPTY_LOCATION: LocationData = {
  address: "",
  addressBn: "",
  division: "",
  district: "",
  area: "",
  postCode: "",
  latitude: 0,
  longitude: 0,
};

export type DocumentUrls = {
  tradeLicense?: string;
  nid?: string;
  shopPhoto?: string;
  storeFront?: string;
  warehouse?: string;
};
