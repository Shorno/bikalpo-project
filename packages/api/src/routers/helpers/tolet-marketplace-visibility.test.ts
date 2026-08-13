import assert from "node:assert/strict";
import test from "node:test";
import {
	isToLetPublicListingRenewalDue,
	toLetListingVisibleUntil,
	toLetMarketplaceStatus,
	toLetPublishedAtForPublish,
} from "./tolet-marketplace-visibility";

const now = new Date("2026-08-05T12:00:00.000Z");

test("an active vacant listing is available", () => {
	assert.equal(
		toLetMarketplaceStatus(
			{
				listingStatus: "active",
				unitStatus: "vacant",
				publishedAt: new Date("2026-08-01T12:00:00.000Z"),
				createdAt: new Date("2026-07-01T12:00:00.000Z"),
				closedAt: null,
			},
			now,
		),
		"available",
	);
});

test("an available listing disappears at its 30-day publication boundary", () => {
	const publishedAt = new Date("2026-07-06T12:00:00.000Z");

	assert.equal(toLetListingVisibleUntil(publishedAt).getTime(), now.getTime());
	assert.equal(
		toLetMarketplaceStatus(
			{
				listingStatus: "active",
				unitStatus: "vacant",
				publishedAt,
				createdAt: publishedAt,
				closedAt: null,
			},
			now,
		),
		null,
	);
});

test("online and offline booked listings remain public before day 30", () => {
	const closedAt = new Date(now.getTime() - 29 * 24 * 60 * 60 * 1_000);

	for (const unitStatus of ["booked", "occupied"] as const) {
		assert.equal(
			toLetMarketplaceStatus(
				{
					listingStatus: "closed",
					unitStatus,
					publishedAt: new Date("2026-06-01T12:00:00.000Z"),
					createdAt: new Date("2026-06-01T12:00:00.000Z"),
					closedAt,
				},
				now,
			),
			"booked",
		);
	}
});

test("a booked listing disappears at the exact 30-day boundary", () => {
	const closedAt = new Date("2026-07-06T12:00:00.000Z");

	assert.equal(toLetListingVisibleUntil(closedAt).getTime(), now.getTime());
	assert.equal(
		toLetMarketplaceStatus(
			{
				listingStatus: "closed",
				unitStatus: "booked",
				publishedAt: new Date("2026-06-01T12:00:00.000Z"),
				createdAt: new Date("2026-06-01T12:00:00.000Z"),
				closedAt,
			},
			now,
		),
		null,
	);
});

test("a closed listing is hidden after the unit becomes vacant or inactive", () => {
	const closedAt = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1_000);

	for (const unitStatus of ["vacant", "inactive"] as const) {
		assert.equal(
			toLetMarketplaceStatus(
				{
					listingStatus: "closed",
					unitStatus,
					publishedAt: new Date("2026-07-01T12:00:00.000Z"),
					createdAt: new Date("2026-07-01T12:00:00.000Z"),
					closedAt,
				},
				now,
			),
			null,
		);
	}
});

test("draft and paused listings are never public", () => {
	for (const listingStatus of ["draft", "paused"] as const) {
		assert.equal(
			toLetMarketplaceStatus(
				{
					listingStatus,
					unitStatus: "vacant",
					publishedAt: new Date("2026-08-01T12:00:00.000Z"),
					createdAt: new Date("2026-08-01T12:00:00.000Z"),
					closedAt: null,
				},
				now,
			),
			null,
		);
	}
});

test("publishing an expired public listing starts a new visibility window", () => {
	const previousPublishedAt = new Date("2026-07-06T12:00:00.000Z");

	assert.equal(
		toLetPublishedAtForPublish(
			{
				listingStatus: "active",
				visibility: "public",
				publishedAt: previousPublishedAt,
			},
			now,
		).getTime(),
		now.getTime(),
	);
});

test("an owner can renew an expired active public listing for a vacant unit", () => {
	assert.equal(
		isToLetPublicListingRenewalDue(
			{
				listingStatus: "active",
				visibility: "public",
				unitStatus: "vacant",
				publishedAt: new Date("2026-07-06T12:00:00.000Z"),
				createdAt: new Date("2026-07-01T12:00:00.000Z"),
			},
			now,
		),
		true,
	);
});

test("renewal is not offered before expiry or for QR-only listings", () => {
	const base = {
		listingStatus: "active" as const,
		unitStatus: "vacant" as const,
		publishedAt: new Date("2026-08-01T12:00:00.000Z"),
		createdAt: new Date("2026-07-01T12:00:00.000Z"),
	};

	assert.equal(
		isToLetPublicListingRenewalDue({ ...base, visibility: "public" }, now),
		false,
	);
	assert.equal(
		isToLetPublicListingRenewalDue(
			{
				...base,
				visibility: "qr_only",
				publishedAt: new Date("2026-06-01T12:00:00.000Z"),
			},
			now,
		),
		false,
	);
});

test("publishing before expiry does not extend the public window", () => {
	const previousPublishedAt = new Date("2026-08-01T12:00:00.000Z");

	assert.equal(
		toLetPublishedAtForPublish(
			{
				listingStatus: "paused",
				visibility: "public",
				publishedAt: previousPublishedAt,
			},
			now,
		).getTime(),
		previousPublishedAt.getTime(),
	);
});

test("publishing a QR-only listing preserves its original publication date", () => {
	const previousPublishedAt = new Date("2026-06-01T12:00:00.000Z");

	assert.equal(
		toLetPublishedAtForPublish(
			{
				listingStatus: "paused",
				visibility: "qr_only",
				publishedAt: previousPublishedAt,
			},
			now,
		).getTime(),
		previousPublishedAt.getTime(),
	);
});
