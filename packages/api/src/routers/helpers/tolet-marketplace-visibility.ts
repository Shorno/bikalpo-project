export const TO_LET_LISTING_VISIBILITY_DAYS = 30;

const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1_000;
const TO_LET_LISTING_VISIBILITY_MILLISECONDS =
	TO_LET_LISTING_VISIBILITY_DAYS * DAY_IN_MILLISECONDS;

type ListingStatus = "draft" | "active" | "paused" | "closed";
type UnitStatus = "vacant" | "booked" | "occupied" | "inactive";
type ListingVisibility = "public" | "qr_only";

export type ToLetMarketplaceStatus = "available" | "booked";

/**
 * Units that may carry an active listing. A rented (occupied) unit may be
 * advertised ahead for the next tenant; booking acceptance still waits until
 * the unit is vacant.
 */
export function isToLetListableUnitStatus(status: UnitStatus) {
	return status === "vacant" || status === "occupied";
}

export function toLetListingVisibleUntil(startedAt: Date) {
	return new Date(startedAt.getTime() + TO_LET_LISTING_VISIBILITY_MILLISECONDS);
}

export function toLetListingCutoff(now = new Date()) {
	return new Date(now.getTime() - TO_LET_LISTING_VISIBILITY_MILLISECONDS);
}

export function toLetPublishedAtForPublish(
	input: {
		listingStatus: ListingStatus;
		visibility: ListingVisibility;
		publishedAt: Date | null;
	},
	now = new Date(),
) {
	if (input.listingStatus === "draft" || !input.publishedAt) return now;

	if (
		input.visibility === "public" &&
		toLetListingVisibleUntil(input.publishedAt).getTime() <= now.getTime()
	) {
		return now;
	}

	return input.publishedAt;
}

export function isToLetPublicListingRenewalDue(
	input: {
		listingStatus: ListingStatus;
		visibility: ListingVisibility;
		unitStatus: UnitStatus;
		publishedAt: Date | null;
		createdAt: Date;
	},
	now = new Date(),
) {
	if (
		input.visibility !== "public" ||
		input.listingStatus !== "active" ||
		!isToLetListableUnitStatus(input.unitStatus)
	) {
		return false;
	}

	return (
		toLetMarketplaceStatus(
			{
				listingStatus: input.listingStatus,
				unitStatus: input.unitStatus,
				publishedAt: input.publishedAt,
				createdAt: input.createdAt,
				closedAt: null,
			},
			now,
		) === null
	);
}

export function toLetMarketplaceStatus(
	input: {
		listingStatus: ListingStatus;
		unitStatus: UnitStatus;
		publishedAt: Date | null;
		createdAt: Date;
		closedAt: Date | null;
	},
	now = new Date(),
): ToLetMarketplaceStatus | null {
	const publishedAt = input.publishedAt ?? input.createdAt;
	if (
		input.listingStatus === "active" &&
		isToLetListableUnitStatus(input.unitStatus) &&
		toLetListingVisibleUntil(publishedAt).getTime() > now.getTime()
	) {
		return "available";
	}

	if (
		input.listingStatus === "closed" &&
		(input.unitStatus === "booked" || input.unitStatus === "occupied") &&
		input.closedAt &&
		toLetListingVisibleUntil(input.closedAt).getTime() > now.getTime()
	) {
		return "booked";
	}

	return null;
}
