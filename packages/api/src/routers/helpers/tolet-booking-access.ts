import { toLetMarketplaceStatus } from "./tolet-marketplace-visibility";

type ListingStatus = "draft" | "active" | "paused" | "closed";
type UnitStatus = "vacant" | "booked" | "occupied" | "inactive";
type PropertyStatus = "active" | "inactive" | "blocked";
type ListingVisibility = "public" | "qr_only";

export function canCreateToLetBookingRequest(
	input: {
		listingStatus: ListingStatus;
		unitStatus: UnitStatus;
		propertyStatus: PropertyStatus;
		visibility: ListingVisibility;
		publishedAt: Date | null;
		createdAt: Date;
		closedAt: Date | null;
		requestedQrToken?: string;
		propertyQrToken: string;
	},
	now = new Date(),
) {
	if (
		input.listingStatus !== "active" ||
		input.unitStatus !== "vacant" ||
		input.propertyStatus !== "active"
	) {
		return false;
	}

	if (
		input.requestedQrToken &&
		input.requestedQrToken === input.propertyQrToken
	) {
		return true;
	}

	return (
		input.visibility === "public" &&
		toLetMarketplaceStatus(input, now) === "available"
	);
}
