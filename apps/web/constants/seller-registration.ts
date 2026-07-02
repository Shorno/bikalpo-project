/** Business nature options for seller registration (Step 2) */
export const BUSINESS_NATURES = [
  { id: "retail_shop", label: "Retail Shop" },
  { id: "wholesaler", label: "Wholesaler" },
  { id: "distributor", label: "Distributor" },
  { id: "manufacturer", label: "Manufacturer" },
  { id: "importer", label: "Importer" },
] as const;

export type BusinessNatureId = (typeof BUSINESS_NATURES)[number]["id"];

/** Route to warehouse application API when nature is wholesaler or distributor */
export const WAREHOUSE_NATURES: BusinessNatureId[] = [
  "wholesaler",
  "distributor",
];

export function isWarehouseNature(nature: string): boolean {
  return WAREHOUSE_NATURES.includes(nature as BusinessNatureId);
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
