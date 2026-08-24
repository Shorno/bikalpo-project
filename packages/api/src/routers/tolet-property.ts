import { db } from "@bikalpo-project/db";
import {
	type ToletProperty,
	type ToletUnit,
	type ToletUnitListing,
	toletBookingRequest,
	toletProperty,
	toletRentalContract,
	toletUnit,
	toletUnitListing,
} from "@bikalpo-project/db/schema";
import { ORPCError } from "@orpc/server";
import { and, asc, count, desc, eq, inArray, max, ne } from "drizzle-orm";
import { z } from "zod";

import { consumerProcedure } from "../index";

const PROPERTY_TYPES = [
	"apartment",
	"residential_building",
	"commercial_building",
	"office",
	"market",
	"warehouse",
	"mixed_use",
	"other",
] as const;

const BUILDING_TYPES = [
	"residential",
	"commercial",
	"mixed_use",
	"industrial",
	"other",
] as const;

const UNIT_TYPES = [
	"family_flat",
	"bachelor_room",
	"office",
	"shop",
	"warehouse",
	"garage",
	"sublet",
	"other",
] as const;

const propertyCodeSchema = z
	.string()
	.trim()
	.regex(/^PR-20\d{2}-\d{6,10}$/, "Invalid Property ID");

const unitCodeSchema = z
	.string()
	.trim()
	.regex(/^UNT-\d{6,10}$/, "Invalid Unit ID");

const isDevelopment = process.env.NODE_ENV === "development";

function normalizeMobileNumber(value: string) {
	const trimmed = value.trim();
	const digits = trimmed.replace(/\D/g, "");
	if (trimmed.startsWith("+")) return `+${digits}`;
	if (digits.startsWith("880")) return `+${digits}`;
	if (digits.startsWith("0")) return `+88${digits}`;
	return `+880${digits}`;
}

const productionMobileNumberSchema = z
	.string()
	.trim()
	.regex(/^(?:\+?88)?01[3-9]\d{8}$/, "Enter a valid Bangladesh mobile number")
	.transform(normalizeMobileNumber);

const developmentMobileNumberSchema = z
	.string()
	.trim()
	.min(1, "Mobile number is required")
	.max(30)
	.refine((value) => /\d/.test(value), "Enter a mobile number")
	.transform(normalizeMobileNumber);

const mobileNumberSchema = isDevelopment
	? developmentMobileNumberSchema
	: productionMobileNumberSchema;

function blankToUndefined(value: unknown) {
	if (value == null) return undefined;
	if (typeof value === "string" && value.trim() === "") return undefined;
	return value;
}

const optionalEmailSchema = z.preprocess(
	blankToUndefined,
	z.string().trim().email().max(320).optional(),
);

const urlSchema = z.string().trim().pipe(z.httpUrl().max(2048));
const optionalUrlSchema = z.preprocess(blankToUndefined, urlSchema.optional());

function optionalTextSchema(maxLength: number) {
	return z.preprocess(
		blankToUndefined,
		z.string().trim().max(maxLength).optional(),
	);
}

function optionalCoordinateSchema(minimum: number, maximum: number) {
	return z.preprocess(
		blankToUndefined,
		z.coerce.number().min(minimum).max(maximum).optional(),
	);
}

export const toletPropertyFieldsSchema = z
	.object({
		name: z.string().trim().min(2).max(200),
		coverImageUrl: urlSchema,
		ownerName: z.string().trim().min(2).max(150),
		mobileNumber: mobileNumberSchema,
		email: optionalEmailSchema,
		propertyType: z.enum(PROPERTY_TYPES),
		division: z.string().trim().min(2).max(100),
		district: z.string().trim().min(2).max(100),
		area: z.string().trim().min(2).max(150),
		fullAddress: z.string().trim().min(5).max(1000),
		nearbyLandmark: optionalTextSchema(500),
		latitude: optionalCoordinateSchema(-90, 90),
		longitude: optionalCoordinateSchema(-180, 180),
		buildingType: z.enum(BUILDING_TYPES),
		totalFloors: z.coerce.number().int().min(1).max(500),
		declaredTotalUnits: z.coerce.number().int().min(1).max(10_000),
		hasParking: z.boolean().default(false),
		hasLift: z.boolean().default(false),
		hasSecurityGuard: z.boolean().default(false),
		hasCctv: z.boolean().default(false),
		hasGenerator: z.boolean().default(false),
		hasWaterSupply: z.boolean().default(false),
		hasGasConnection: z.boolean().default(false),
		hasElectricity: z.boolean().default(false),
		description: optionalTextSchema(5000),
		frontImageUrl: urlSchema,
		buildingImageUrl: optionalUrlSchema,
		videoUrl: optionalUrlSchema,
	})
	.strict();

export const createToletPropertyInputSchema = toletPropertyFieldsSchema
	.extend({
		phoneVerified: z.literal(true),
		informationConfirmed: z.literal(true),
		termsAccepted: z.literal(true),
		propertyPolicyAccepted: z.literal(true),
	})
	.strict();

export const updateToletPropertyInputSchema = z
	.object({
		propertyCode: propertyCodeSchema,
		data: toletPropertyFieldsSchema.extend({
			phoneVerified: z.literal(true),
		}),
	})
	.strict();

export const toletUnitFieldsSchema = z
	.object({
		name: z.string().trim().min(1).max(100),
		unitType: z.enum(UNIT_TYPES),
		floorNumber: z.coerce.number().int().min(-10).max(500),
		sizeSqFt: z.coerce.number().int().min(1).max(10_000_000),
		bedrooms: z.coerce.number().int().min(0).max(100).default(0),
		bathrooms: z.coerce.number().int().min(0).max(100).default(0),
		balconies: z.coerce.number().int().min(0).max(100).default(0),
		hasDrawingRoom: z.boolean().default(false),
		hasDiningSpace: z.boolean().default(false),
		hasKitchen: z.boolean().default(false),
		isFurnished: z.boolean().default(false),
		description: optionalTextSchema(5000),
		imageUrls: z.array(urlSchema).max(20).default([]),
	})
	.strict();

export const createToletUnitInputSchema = z
	.object({
		propertyCode: propertyCodeSchema,
		data: toletUnitFieldsSchema,
	})
	.strict();

export const updateToletUnitInputSchema = z
	.object({
		propertyCode: propertyCodeSchema,
		unitCode: unitCodeSchema,
		data: toletUnitFieldsSchema,
	})
	.strict();

type PropertyFields = z.infer<typeof toletPropertyFieldsSchema>;
type UnitFields = z.infer<typeof toletUnitFieldsSchema>;

function formatPropertyCode(
	property: Pick<ToletProperty, "createdAt" | "publicNumber">,
) {
	return `PR-${property.createdAt.getFullYear()}-${String(property.publicNumber).padStart(6, "0")}`;
}

function formatUnitCode(unit: Pick<ToletUnit, "publicNumber">) {
	return `UNT-${String(unit.publicNumber).padStart(6, "0")}`;
}

function formatListingCode(listing: Pick<ToletUnitListing, "publicNumber">) {
	return `LST-${String(listing.publicNumber).padStart(6, "0")}`;
}

function parsePropertyCode(propertyCode: string) {
	const match = /^PR-(20\d{2})-(\d{6,10})$/.exec(propertyCode);
	if (!match?.[1] || !match[2]) {
		throw new ORPCError("NOT_FOUND", { message: "Property not found" });
	}

	return {
		year: Number(match[1]),
		publicNumber: Number(match[2]),
	};
}

function parseUnitCode(unitCode: string) {
	const match = /^UNT-(\d{6,10})$/.exec(unitCode);
	if (!match?.[1]) {
		throw new ORPCError("NOT_FOUND", { message: "Unit not found" });
	}
	return Number(match[1]);
}

function propertyDto(property: ToletProperty, unitCount: number) {
	const {
		id: _id,
		ownerUserId: _ownerUserId,
		publicNumber,
		...details
	} = property;

	return {
		...details,
		propertyCode: formatPropertyCode({
			createdAt: property.createdAt,
			publicNumber,
		}),
		unitCount,
	};
}

function unitDto(unit: ToletUnit) {
	const { id: _id, propertyId: _propertyId, publicNumber, ...details } = unit;
	return {
		...details,
		unitCode: formatUnitCode({ publicNumber }),
	};
}

function currentListingDto(
	listing: ToletUnitListing,
	bookingCount: number,
) {
	return {
		listingCode: formatListingCode(listing),
		title: listing.title,
		description: listing.description,
		monthlyRent: Number(listing.monthlyRent),
		imageUrls: listing.imageUrls,
		videoUrl: listing.videoUrl,
		visibility: listing.visibility,
		status: listing.status,
		viewCount: listing.viewCount,
		publishedAt: listing.publishedAt,
		bookingCount,
	};
}

function propertyWriteValues(input: PropertyFields) {
	return {
		name: input.name,
		coverImageUrl: input.coverImageUrl,
		ownerName: input.ownerName,
		mobileNumber: input.mobileNumber,
		email: input.email ?? null,
		propertyType: input.propertyType,
		division: input.division,
		district: input.district,
		area: input.area,
		fullAddress: input.fullAddress,
		nearbyLandmark: input.nearbyLandmark ?? null,
		latitude: input.latitude == null ? null : String(input.latitude),
		longitude: input.longitude == null ? null : String(input.longitude),
		buildingType: input.buildingType,
		totalFloors: input.totalFloors,
		declaredTotalUnits: input.declaredTotalUnits,
		hasParking: input.hasParking,
		hasLift: input.hasLift,
		hasSecurityGuard: input.hasSecurityGuard,
		hasCctv: input.hasCctv,
		hasGenerator: input.hasGenerator,
		hasWaterSupply: input.hasWaterSupply,
		hasGasConnection: input.hasGasConnection,
		hasElectricity: input.hasElectricity,
		description: input.description ?? null,
		frontImageUrl: input.frontImageUrl,
		buildingImageUrl: input.buildingImageUrl ?? null,
		videoUrl: input.videoUrl ?? null,
	};
}

function unitWriteValues(input: UnitFields) {
	return {
		name: input.name,
		unitType: input.unitType,
		floorNumber: input.floorNumber,
		sizeSqFt: input.sizeSqFt,
		bedrooms: input.bedrooms,
		bathrooms: input.bathrooms,
		balconies: input.balconies,
		hasDrawingRoom: input.hasDrawingRoom,
		hasDiningSpace: input.hasDiningSpace,
		hasKitchen: input.hasKitchen,
		isFurnished: input.isFurnished,
		description: input.description ?? null,
		imageUrls: input.imageUrls,
	};
}

function isUniqueViolation(error: unknown) {
	if (typeof error !== "object" || error === null) return false;
	const candidate = error as {
		code?: unknown;
		cause?: { code?: unknown };
	};
	return candidate.code === "23505" || candidate.cause?.code === "23505";
}

function assertPropertyCodeMatches(
	property: ToletProperty,
	propertyCode: string,
) {
	if (formatPropertyCode(property) !== propertyCode) {
		throw new ORPCError("NOT_FOUND", { message: "Property not found" });
	}
}

function assertPropertyIsWritable(property: ToletProperty) {
	if (property.status === "blocked") {
		throw new ORPCError("FORBIDDEN", {
			message: "This property is blocked and cannot be changed",
		});
	}
	if (property.status === "inactive") {
		throw new ORPCError("CONFLICT", {
			message: "This property registration has been deleted",
		});
	}
}

async function findOwnedUnit(
	userId: string,
	propertyCode: string,
	unitCode: string,
) {
	const propertyIdentity = parsePropertyCode(propertyCode);
	const unitPublicNumber = parseUnitCode(unitCode);
	const [owned] = await db
		.select({ unit: toletUnit, property: toletProperty })
		.from(toletUnit)
		.innerJoin(toletProperty, eq(toletUnit.propertyId, toletProperty.id))
		.where(
			and(
				eq(toletUnit.publicNumber, unitPublicNumber),
				eq(toletProperty.publicNumber, propertyIdentity.publicNumber),
				eq(toletProperty.ownerUserId, userId),
			),
		)
		.limit(1);

	if (
		!owned ||
		owned.property.createdAt.getFullYear() !== propertyIdentity.year ||
		formatPropertyCode(owned.property) !== propertyCode ||
		formatUnitCode(owned.unit) !== unitCode
	) {
		throw new ORPCError("NOT_FOUND", { message: "Unit not found" });
	}
	return owned;
}

export const toLetPropertyRouter = {
	listMine: consumerProcedure
		.route({
			method: "GET",
			path: "/to-let/owner/properties",
			tags: ["To-Let Property Owner"],
			summary: "List properties owned by the current user",
		})
		.handler(async ({ context }) => {
			const rows = await db.query.toletProperty.findMany({
				where: and(
					eq(toletProperty.ownerUserId, context.session.user.id),
					ne(toletProperty.status, "inactive"),
				),
				with: {
					units: {
						columns: { id: true, status: true },
					},
				},
				orderBy: [desc(toletProperty.createdAt)],
			});

			return {
				properties: rows.map(({ units, ...property }) =>
					propertyDto(
						property,
						units.filter((unit) => unit.status !== "inactive").length,
					),
				),
			};
		}),

	getMine: consumerProcedure
		.route({
			method: "GET",
			path: "/to-let/owner/properties/{propertyCode}",
			tags: ["To-Let Property Owner"],
			summary: "Get an owned property and its units",
		})
		.input(z.object({ propertyCode: propertyCodeSchema }).strict())
		.handler(async ({ context, input }) => {
			const identity = parsePropertyCode(input.propertyCode);
			const found = await db.query.toletProperty.findFirst({
				where: and(
					eq(toletProperty.publicNumber, identity.publicNumber),
					eq(toletProperty.ownerUserId, context.session.user.id),
					ne(toletProperty.status, "inactive"),
				),
				with: {
					units: {
						orderBy: [asc(toletUnit.floorNumber), asc(toletUnit.name)],
					},
				},
			});

			if (!found || found.createdAt.getFullYear() !== identity.year) {
				throw new ORPCError("NOT_FOUND", { message: "Property not found" });
			}
			assertPropertyCodeMatches(found, input.propertyCode);

			const { units, ...property } = found;
			const activeUnits = units.filter((unit) => unit.status !== "inactive");
			const unitIds = activeUnits.map((unit) => unit.id);
			const listingCandidates =
				unitIds.length > 0
					? await db
							.select()
							.from(toletUnitListing)
							.where(inArray(toletUnitListing.unitId, unitIds))
							.orderBy(desc(toletUnitListing.createdAt))
					: [];
			const listingByUnitId = new Map<string, ToletUnitListing>();
			for (const listing of listingCandidates) {
				if (
					listing.status !== "closed" &&
					!listingByUnitId.has(listing.unitId)
				) {
					listingByUnitId.set(listing.unitId, listing);
				}
			}
			for (const listing of listingCandidates) {
				if (!listingByUnitId.has(listing.unitId)) {
					listingByUnitId.set(listing.unitId, listing);
				}
			}
			const listingIds = [...listingByUnitId.values()].map(
				(listing) => listing.id,
			);
			const bookingCounts =
				listingIds.length > 0
					? await db
							.select({
								listingId: toletBookingRequest.listingId,
								bookingCount: count(),
							})
							.from(toletBookingRequest)
							.where(inArray(toletBookingRequest.listingId, listingIds))
							.groupBy(toletBookingRequest.listingId)
					: [];
			const bookingCountByListingId = new Map(
				bookingCounts.map((row) => [
					row.listingId,
					Number(row.bookingCount),
				]),
			);
			return {
				property: {
					...propertyDto(property, activeUnits.length),
					units: activeUnits.map((unit) => {
						const listing = listingByUnitId.get(unit.id);
						return {
							...unitDto(unit),
							currentListing: listing
								? currentListingDto(
										listing,
										bookingCountByListingId.get(listing.id) ?? 0,
									)
								: null,
						};
					}),
				},
			};
		}),

	create: consumerProcedure
		.route({
			method: "POST",
			path: "/to-let/owner/properties",
			tags: ["To-Let Property Owner"],
			summary: "Register a property for the current user",
		})
		.input(createToletPropertyInputSchema)
		.handler(async ({ context, input }) => {
			const userId = context.session.user.id;
			const now = new Date();

			const [created] = await db
				.insert(toletProperty)
				.values({
					...propertyWriteValues(input),
					ownerUserId: userId,
					phoneVerifiedAt: now,
					informationConfirmedAt: now,
					termsAcceptedAt: now,
					propertyPolicyAcceptedAt: now,
				})
				.returning();

			if (!created) {
				throw new ORPCError("INTERNAL_SERVER_ERROR", {
					message: "Property registration failed",
				});
			}

			return { property: propertyDto(created, 0) };
		}),

	archiveProperty: consumerProcedure
		.route({
			method: "POST",
			path: "/to-let/owner/properties/{propertyCode}/archive",
			tags: ["To-Let Property Owner"],
			summary: "Remove an owned property registration while preserving history",
		})
		.input(z.object({ propertyCode: propertyCodeSchema }).strict())
		.handler(async ({ context, input }) => {
			const identity = parsePropertyCode(input.propertyCode);
			const userId = context.session.user.id;

			return db.transaction(async (tx) => {
				const [property] = await tx
					.select()
					.from(toletProperty)
					.where(
						and(
							eq(toletProperty.publicNumber, identity.publicNumber),
							eq(toletProperty.ownerUserId, userId),
						),
					)
					.limit(1)
					.for("update");

				if (
					!property ||
					property.createdAt.getFullYear() !== identity.year ||
					formatPropertyCode(property) !== input.propertyCode
				) {
					throw new ORPCError("NOT_FOUND", { message: "Property not found" });
				}
				if (property.status === "blocked") {
					throw new ORPCError("FORBIDDEN", {
						message: "A blocked property registration cannot be deleted",
					});
				}
				if (property.status === "inactive") {
					return { success: true as const, propertyCode: input.propertyCode };
				}

				const units = await tx
					.select({ id: toletUnit.id, status: toletUnit.status })
					.from(toletUnit)
					.where(eq(toletUnit.propertyId, property.id))
					.for("update");
				const activeUnits = units.filter((unit) => unit.status !== "inactive");
				if (activeUnits.some((unit) => unit.status !== "vacant")) {
					throw new ORPCError("CONFLICT", {
						message:
							"This property has a booked or occupied unit. Complete the rental before deleting it.",
					});
				}

				const [currentRental] = await tx
					.select({ id: toletRentalContract.id })
					.from(toletRentalContract)
					.where(
						and(
							eq(toletRentalContract.propertyId, property.id),
							ne(toletRentalContract.status, "completed"),
						),
					)
					.limit(1)
					.for("update");
				if (currentRental) {
					throw new ORPCError("CONFLICT", {
						message:
							"This property has an active rental. Complete it before deleting the property.",
					});
				}

				const propertyUnitIds = units.map((unit) => unit.id);
				const activeUnitIds = activeUnits.map((unit) => unit.id);
				const openListings =
					propertyUnitIds.length > 0
						? await tx
								.select({ id: toletUnitListing.id })
								.from(toletUnitListing)
								.where(
									and(
										inArray(toletUnitListing.unitId, propertyUnitIds),
										ne(toletUnitListing.status, "closed"),
									),
								)
								.for("update")
						: [];
				const listingIds = openListings.map((listing) => listing.id);
				const now = new Date();

				if (listingIds.length > 0) {
					await tx
						.update(toletBookingRequest)
						.set({
							status: "rejected",
							responseNote: "The owner deleted this property registration",
							respondedAt: now,
							updatedAt: now,
						})
						.where(
							and(
								inArray(toletBookingRequest.listingId, listingIds),
								eq(toletBookingRequest.status, "pending"),
							),
						);

					await tx
						.update(toletUnitListing)
						.set({ status: "closed", closedAt: now, updatedAt: now })
						.where(inArray(toletUnitListing.id, listingIds));
				}

				if (activeUnitIds.length > 0) {
					await tx
						.update(toletUnit)
						.set({ status: "inactive", updatedAt: now })
						.where(
							and(
								eq(toletUnit.propertyId, property.id),
								inArray(toletUnit.id, activeUnitIds),
								eq(toletUnit.status, "vacant"),
							),
						);
				}

				const [archived] = await tx
					.update(toletProperty)
					.set({ status: "inactive", updatedAt: now })
					.where(
						and(
							eq(toletProperty.id, property.id),
							eq(toletProperty.ownerUserId, userId),
							eq(toletProperty.status, "active"),
						),
					)
					.returning({ id: toletProperty.id });
				if (!archived) {
					throw new ORPCError("CONFLICT", {
						message: "The property status changed before it could be deleted",
					});
				}

				return { success: true as const, propertyCode: input.propertyCode };
			});
		}),

	update: consumerProcedure
		.route({
			method: "PUT",
			path: "/to-let/owner/properties/{propertyCode}",
			tags: ["To-Let Property Owner"],
			summary: "Update an owned property",
		})
		.input(updateToletPropertyInputSchema)
		.handler(async ({ context, input }) => {
			const userId = context.session.user.id;
			const identity = parsePropertyCode(input.propertyCode);

			const result = await db.transaction(async (tx) => {
				const [existing] = await tx
					.select()
					.from(toletProperty)
					.where(
						and(
							eq(toletProperty.publicNumber, identity.publicNumber),
							eq(toletProperty.ownerUserId, userId),
						),
					)
					.limit(1)
					.for("update");

				if (!existing || existing.createdAt.getFullYear() !== identity.year) {
					throw new ORPCError("NOT_FOUND", { message: "Property not found" });
				}
				assertPropertyCodeMatches(existing, input.propertyCode);
				assertPropertyIsWritable(existing);

				const [unitStats] = await tx
					.select({
						unitCount: count(),
						highestFloor: max(toletUnit.floorNumber),
					})
					.from(toletUnit)
					.where(
						and(
							eq(toletUnit.propertyId, existing.id),
							ne(toletUnit.status, "inactive"),
						),
					);

				const currentUnitCount = Number(unitStats?.unitCount ?? 0);
				const highestFloor = Number(unitStats?.highestFloor ?? 0);
				if (input.data.declaredTotalUnits < currentUnitCount) {
					throw new ORPCError("BAD_REQUEST", {
						message: `Total units cannot be lower than the ${currentUnitCount} units already created`,
					});
				}
				if (input.data.totalFloors < highestFloor) {
					throw new ORPCError("BAD_REQUEST", {
						message: `Total floors cannot be lower than existing floor ${highestFloor}`,
					});
				}

				const [updated] = await tx
					.update(toletProperty)
					.set({
						...propertyWriteValues(input.data),
						phoneVerifiedAt: new Date(),
						updatedAt: new Date(),
					})
					.where(
						and(
							eq(toletProperty.id, existing.id),
							eq(toletProperty.ownerUserId, userId),
						),
					)
					.returning();

				if (!updated) {
					throw new ORPCError("NOT_FOUND", { message: "Property not found" });
				}
				return { updated, unitCount: currentUnitCount };
			});

			return {
				property: propertyDto(result.updated, result.unitCount),
			};
		}),

	createUnit: consumerProcedure
		.route({
			method: "POST",
			path: "/to-let/owner/properties/{propertyCode}/units",
			tags: ["To-Let Property Owner"],
			summary: "Create a physical unit in an owned property",
		})
		.input(createToletUnitInputSchema)
		.handler(async ({ context, input }) => {
			const userId = context.session.user.id;
			const identity = parsePropertyCode(input.propertyCode);

			try {
				const created = await db.transaction(async (tx) => {
					const [property] = await tx
						.select()
						.from(toletProperty)
						.where(
							and(
								eq(toletProperty.publicNumber, identity.publicNumber),
								eq(toletProperty.ownerUserId, userId),
							),
						)
						.limit(1)
						.for("update");

					if (!property || property.createdAt.getFullYear() !== identity.year) {
						throw new ORPCError("NOT_FOUND", { message: "Property not found" });
					}
					assertPropertyCodeMatches(property, input.propertyCode);
					assertPropertyIsWritable(property);

					if (input.data.floorNumber > property.totalFloors) {
						throw new ORPCError("BAD_REQUEST", {
							message: `Floor cannot be above ${property.totalFloors}`,
						});
					}

					const [stats] = await tx
						.select({ unitCount: count() })
						.from(toletUnit)
						.where(
							and(
								eq(toletUnit.propertyId, property.id),
								ne(toletUnit.status, "inactive"),
							),
						);
					if (Number(stats?.unitCount ?? 0) >= property.declaredTotalUnits) {
						throw new ORPCError("CONFLICT", {
							message: "This property has reached its declared unit capacity",
						});
					}

					const [unit] = await tx
						.insert(toletUnit)
						.values({
							...unitWriteValues(input.data),
							propertyId: property.id,
						})
						.returning();

					if (!unit) {
						throw new ORPCError("INTERNAL_SERVER_ERROR", {
							message: "Unit creation failed",
						});
					}
					return unit;
				});

				return { unit: unitDto(created) };
			} catch (error) {
				if (isUniqueViolation(error)) {
					throw new ORPCError("CONFLICT", {
						message: "A unit with this name already exists in the property",
					});
				}
				throw error;
			}
		}),

	updateUnit: consumerProcedure
		.route({
			method: "PUT",
			path: "/to-let/owner/units/{unitCode}",
			tags: ["To-Let Property Owner"],
			summary: "Update an owned physical unit",
		})
		.input(updateToletUnitInputSchema)
		.handler(async ({ context, input }) => {
			const owned = await findOwnedUnit(
				context.session.user.id,
				input.propertyCode,
				input.unitCode,
			);
			assertPropertyIsWritable(owned.property);
			if (input.data.floorNumber > owned.property.totalFloors) {
				throw new ORPCError("BAD_REQUEST", {
					message: `Floor cannot be above ${owned.property.totalFloors}`,
				});
			}

			try {
				const [updated] = await db
					.update(toletUnit)
					.set({
						...unitWriteValues(input.data),
						updatedAt: new Date(),
					})
					.where(
						and(
							eq(toletUnit.id, owned.unit.id),
							eq(toletUnit.propertyId, owned.property.id),
						),
					)
					.returning();

				if (!updated) {
					throw new ORPCError("NOT_FOUND", { message: "Unit not found" });
				}
				return { unit: unitDto(updated) };
			} catch (error) {
				if (isUniqueViolation(error)) {
					throw new ORPCError("CONFLICT", {
						message: "A unit with this name already exists in the property",
					});
				}
				throw error;
			}
		}),

	archiveUnit: consumerProcedure
		.route({
			method: "POST",
			path: "/to-let/owner/units/{unitCode}/archive",
			tags: ["To-Let Property Owner"],
			summary: "Archive a vacant owned unit",
		})
		.input(
			z
				.object({
					propertyCode: propertyCodeSchema,
					unitCode: unitCodeSchema,
				})
				.strict(),
		)
		.handler(async ({ context, input }) => {
			const owned = await findOwnedUnit(
				context.session.user.id,
				input.propertyCode,
				input.unitCode,
			);
			assertPropertyIsWritable(owned.property);
			if (owned.unit.status !== "vacant") {
				throw new ORPCError("CONFLICT", {
					message: "Only a vacant unit can be archived",
				});
			}

			const [openListing] = await db
				.select({ id: toletUnitListing.id })
				.from(toletUnitListing)
				.where(
					and(
						eq(toletUnitListing.unitId, owned.unit.id),
						ne(toletUnitListing.status, "closed"),
					),
				)
				.limit(1);

			const now = new Date();
			const archived = await db.transaction(async (tx) => {
				if (openListing) {
					await tx
						.update(toletBookingRequest)
						.set({
							status: "rejected",
							responseNote: "The owner removed this Unit",
							respondedAt: now,
							updatedAt: now,
						})
						.where(
							and(
								eq(toletBookingRequest.listingId, openListing.id),
								eq(toletBookingRequest.status, "pending"),
							),
						);

					await tx
						.update(toletUnitListing)
						.set({ status: "closed", closedAt: now, updatedAt: now })
						.where(eq(toletUnitListing.id, openListing.id));
				}

				const [updated] = await tx
					.update(toletUnit)
					.set({ status: "inactive", updatedAt: now })
					.where(
						and(
							eq(toletUnit.id, owned.unit.id),
							eq(toletUnit.propertyId, owned.property.id),
							eq(toletUnit.status, "vacant"),
						),
					)
					.returning();
				if (!updated) {
					throw new ORPCError("CONFLICT", {
						message: "The unit status changed before it could be removed",
					});
				}
				return updated;
			});
			return { success: true as const, unit: unitDto(archived) };
		}),
};
