export type PropertyStatus = "active" | "inactive" | "blocked";
export type UnitStatus = "vacant" | "booked" | "occupied" | "inactive";
export type ListingStatus = "draft" | "active" | "paused" | "closed";
export type ListingVisibility = "public" | "qr_only";
export type PreferredTenant =
  | "family"
  | "bachelor"
  | "office"
  | "female"
  | "any";

export interface ToLetUnitListingView {
  listingCode: string;
  title: string;
  description: string | null;
  monthlyRent: number;
  monthlyRentVisible: boolean;
  advanceAmount: number;
  advanceAmountVisible: boolean;
  securityDeposit: number;
  securityDepositVisible: boolean;
  serviceCharge: number;
  serviceChargeVisible: boolean;
  serviceChargeIncluded: boolean;
  parkingCharge: number;
  parkingChargeVisible: boolean;
  parkingChargeIncluded: boolean;
  utilityCharge: number;
  utilityChargeVisible: boolean;
  utilityChargeIncluded: boolean;
  availableFrom: string;
  preferredTenant: PreferredTenant;
  hasInternet: boolean;
  otherFacilities: string | null;
  imageUrls: string[];
  videoUrl: string | null;
  visibility: ListingVisibility;
  status: ListingStatus;
  viewCount: number;
  publishedAt: Date | string | null;
  pausedAt: Date | string | null;
  closedAt: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface ToLetUnitView {
  id?: string;
  unitCode: string;
  name: string;
  unitType: string;
  status: UnitStatus;
  floorNumber: number;
  sizeSqFt: number;
  bedrooms: number;
  bathrooms: number;
  balconies: number;
  hasDrawingRoom: boolean;
  hasDiningSpace: boolean;
  hasKitchen: boolean;
  isFurnished: boolean;
  description: string | null;
  imageUrls: string[];
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export interface ToLetPropertyView {
  id?: string;
  propertyCode: string;
  qrToken: string;
  name: string;
  coverImageUrl: string;
  ownerName: string;
  mobileNumber: string;
  email: string | null;
  propertyType: string;
  division: string;
  district: string;
  area: string;
  fullAddress: string;
  nearbyLandmark: string | null;
  latitude: string | null;
  longitude: string | null;
  buildingType: string;
  totalFloors: number;
  declaredTotalUnits: number;
  hasParking: boolean;
  hasLift: boolean;
  hasSecurityGuard: boolean;
  hasCctv: boolean;
  hasGenerator: boolean;
  hasWaterSupply: boolean;
  hasGasConnection: boolean;
  hasElectricity: boolean;
  description: string | null;
  frontImageUrl: string;
  buildingImageUrl: string | null;
  videoUrl: string | null;
  phoneVerifiedAt?: Date | string;
  status: PropertyStatus;
  unitCount?: number;
  units?: ToLetUnitView[];
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export function humanize(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
