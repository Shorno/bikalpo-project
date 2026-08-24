import assert from "node:assert/strict";
import test from "node:test";
import { canCreateToLetBookingRequest } from "./tolet-booking-access";

const now = new Date("2026-08-05T12:00:00.000Z");
const baseListing = {
	listingStatus: "active" as const,
	unitStatus: "vacant" as const,
	propertyStatus: "active" as const,
	visibility: "public" as const,
	publishedAt: new Date("2026-08-01T12:00:00.000Z"),
	createdAt: new Date("2026-08-01T12:00:00.000Z"),
	closedAt: null,
	propertyQrToken: "property-qr-token",
};

test("a current public listing accepts a public booking request", () => {
	assert.equal(canCreateToLetBookingRequest(baseListing, now), true);
});

test("an expired public listing rejects a public booking request", () => {
	const expiredAt = new Date("2026-07-06T12:00:00.000Z");

	assert.equal(
		canCreateToLetBookingRequest(
			{
				...baseListing,
				publishedAt: expiredAt,
				createdAt: expiredAt,
			},
			now,
		),
		false,
	);
});

test("a valid property QR token keeps an expired listing bookable", () => {
	const expiredAt = new Date("2026-07-06T12:00:00.000Z");

	assert.equal(
		canCreateToLetBookingRequest(
			{
				...baseListing,
				publishedAt: expiredAt,
				createdAt: expiredAt,
				requestedQrToken: baseListing.propertyQrToken,
			},
			now,
		),
		true,
	);
});

test("an invalid QR token does not bypass the expired public window", () => {
	const expiredAt = new Date("2026-07-06T12:00:00.000Z");

	assert.equal(
		canCreateToLetBookingRequest(
			{
				...baseListing,
				publishedAt: expiredAt,
				createdAt: expiredAt,
				requestedQrToken: "wrong-token",
			},
			now,
		),
		false,
	);
});

test("a QR token cannot bypass booked or inactive state", () => {
	assert.equal(
		canCreateToLetBookingRequest(
			{
				...baseListing,
				listingStatus: "closed",
				unitStatus: "booked",
				requestedQrToken: baseListing.propertyQrToken,
			},
			now,
		),
		false,
	);
});
