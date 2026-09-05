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
import {
  and,
  asc,
  desc,
  eq,
  gt,
  inArray,
  isNull,
  ne,
  or,
  sql,
} from "drizzle-orm";
import { z } from "zod";

import { consumerProcedure, publicProcedure } from "../index";
import {
  toLetListingCutoff,
  toLetListingVisibleUntil,
  toLetMarketplaceStatus,
  toLetPublishedAtForPublish,
} from "./helpers/tolet-marketplace-visibility";

const propertyCodeSchema = z
  .string()
  .trim()
  .regex(/^PR-20\d{2}-\d{6,10}$/, "Invalid Property ID");

const unitCodeSchema = z
  .string()
  .trim()
  .regex(/^UNT-\d{6,10}$/, "Invalid Unit ID");

const listingCodeSchema = z
  .string()
  .trim()
  .regex(/^LST-\d{6,10}$/, "Invalid Listing ID");

const qrTokenSchema = z.uuid("Invalid property QR token");

function blankToUndefined(value: unknown) {
  if (value == null) return undefined;
  if (typeof value === "string" && value.trim() === "") return undefined;
  return value;
}

const optionalTextSchema = (maximum: number) =>
  z.preprocess(blankToUndefined, z.string().trim().max(maximum).optional());

const optionalUrlSchema = z.preprocess(
  blankToUndefined,
  z.string().trim().pipe(z.httpUrl().max(2048)).optional(),
);

const moneySchema = z.coerce.number().finite().min(0).max(1_000_000_000);

const availableFromSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Choose an available date");

export const toletUnitListingFieldsSchema = z
  .object({
    title: z.string().trim().min(5).max(200),
    description: optionalTextSchema(5000),
    monthlyRent: moneySchema.min(1, "Monthly rent is required"),
    monthlyRentVisible: z.boolean().default(true),
    advanceAmount: moneySchema,
    advanceAmountVisible: z.boolean().default(true),
    securityDeposit: moneySchema,
    securityDepositVisible: z.boolean().default(true),
    serviceCharge: moneySchema,
    serviceChargeVisible: z.boolean().default(true),
    serviceChargeIncluded: z.boolean().default(false),
    parkingCharge: moneySchema,
    parkingChargeVisible: z.boolean().default(true),
    parkingChargeIncluded: z.boolean().default(false),
    utilityCharge: moneySchema,
    utilityChargeVisible: z.boolean().default(true),
    utilityChargeIncluded: z.boolean().default(false),
    availableFrom: availableFromSchema,
    preferredTenant: z.enum(["family", "bachelor", "office", "female", "any"]),
    hasInternet: z.boolean().default(false),
    otherFacilities: optionalTextSchema(2000),
    imageUrls: z.array(z.string().trim().pipe(z.httpUrl().max(2048))).max(12),
    videoUrl: optionalUrlSchema,
    visibility: z.enum(["public", "qr_only"]),
  })
  .strict();

const listingOwnerIdentitySchema = z
  .object({
    propertyCode: propertyCodeSchema,
    unitCode: unitCodeSchema,
  })
  .strict();

const listingMutationIdentitySchema = listingOwnerIdentitySchema
  .extend({ listingCode: listingCodeSchema })
  .strict();

const createListingInputSchema = listingOwnerIdentitySchema
  .extend({ data: toletUnitListingFieldsSchema })
  .strict();

const updateListingInputSchema = listingMutationIdentitySchema
  .extend({ data: toletUnitListingFieldsSchema })
  .strict();

type ListingFields = z.infer<typeof toletUnitListingFieldsSchema>;

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
  return { year: Number(match[1]), publicNumber: Number(match[2]) };
}

function parsePublicNumber(code: string, pattern: RegExp, message: string) {
  const match = pattern.exec(code);
  if (!match?.[1]) {
    throw new ORPCError("NOT_FOUND", { message });
  }
  return Number(match[1]);
}

function parseUnitCode(unitCode: string) {
  return parsePublicNumber(unitCode, /^UNT-(\d{6,10})$/, "Unit not found");
}

function parseListingCode(listingCode: string) {
  return parsePublicNumber(
    listingCode,
    /^LST-(\d{6,10})$/,
    "Listing not found",
  );
}

function isUniqueViolation(error: unknown) {
  if (typeof error !== "object" || error === null) return false;
  const candidate = error as {
    code?: unknown;
    cause?: { code?: unknown };
  };
  return candidate.code === "23505" || candidate.cause?.code === "23505";
}

function listingWriteValues(input: ListingFields) {
  return {
    title: input.title,
    description: input.description ?? null,
    monthlyRent: String(input.monthlyRent),
    monthlyRentVisible: input.monthlyRentVisible,
    advanceAmount: String(input.advanceAmount),
    advanceAmountVisible: input.advanceAmountVisible,
    securityDeposit: String(input.securityDeposit),
    securityDepositVisible: input.securityDepositVisible,
    serviceCharge: String(input.serviceCharge),
    serviceChargeVisible: input.serviceChargeVisible,
    serviceChargeIncluded: input.serviceChargeIncluded,
    parkingCharge: String(input.parkingCharge),
    parkingChargeVisible: input.parkingChargeVisible,
    parkingChargeIncluded: input.parkingChargeIncluded,
    utilityCharge: String(input.utilityCharge),
    utilityChargeVisible: input.utilityChargeVisible,
    utilityChargeIncluded: input.utilityChargeIncluded,
    availableFrom: input.availableFrom,
    preferredTenant: input.preferredTenant,
    hasInternet: input.hasInternet,
    otherFacilities: input.otherFacilities ?? null,
    imageUrls: input.imageUrls,
    videoUrl: input.videoUrl ?? null,
    visibility: input.visibility,
  };
}

function ownerListingDto(listing: ToletUnitListing) {
  const {
    id: _id,
    unitId: _unitId,
    publicNumber,
    monthlyRent,
    advanceAmount,
    securityDeposit,
    serviceCharge,
    parkingCharge,
    utilityCharge,
    ...details
  } = listing;

  return {
    ...details,
    listingCode: formatListingCode({ publicNumber }),
    monthlyRent: Number(monthlyRent),
    advanceAmount: Number(advanceAmount),
    securityDeposit: Number(securityDeposit),
    serviceCharge: Number(serviceCharge),
    parkingCharge: Number(parkingCharge),
    utilityCharge: Number(utilityCharge),
  };
}

type JoinedListing = {
  listing: ToletUnitListing;
  unit: ToletUnit;
  property: ToletProperty;
};

function publicMarketplaceListingScope(now = new Date()) {
  const cutoff = toLetListingCutoff(now);
  return or(
    and(
      eq(toletUnitListing.status, "active"),
      eq(toletUnit.status, "vacant"),
      or(
        gt(toletUnitListing.publishedAt, cutoff),
        and(
          isNull(toletUnitListing.publishedAt),
          gt(toletUnitListing.createdAt, cutoff),
        ),
      ),
    ),
    and(
      eq(toletUnitListing.status, "closed"),
      gt(toletUnitListing.closedAt, cutoff),
      inArray(toletUnit.status, ["booked", "occupied"]),
      sql`NOT EXISTS (
				SELECT 1
				FROM "tolet_unit_listing" AS "newer_listing"
				WHERE "newer_listing"."unit_id" = ${toletUnitListing.unitId}
					AND "newer_listing"."public_number" > ${toletUnitListing.publicNumber}
			)`,
    ),
  );
}

function publicListingDto(row: JoinedListing, now = new Date()) {
  const { listing, unit, property } = row;
  const marketplaceStatus = toLetMarketplaceStatus(
    {
      listingStatus: listing.status,
      unitStatus: unit.status,
      publishedAt: listing.publishedAt,
      createdAt: listing.createdAt,
      closedAt: listing.closedAt,
    },
    now,
  );
  const marketplaceStartedAt =
    marketplaceStatus === "booked"
      ? listing.closedAt
      : (listing.publishedAt ?? listing.createdAt);
  const imageUrls =
    listing.imageUrls.length > 0
      ? listing.imageUrls
      : unit.imageUrls.length > 0
        ? unit.imageUrls
        : [property.coverImageUrl];

  return {
    listingCode: formatListingCode(listing),
    propertyCode: formatPropertyCode(property),
    unitCode: formatUnitCode(unit),
    title: listing.title,
    description: listing.description,
    monthlyRent: listing.monthlyRentVisible
      ? Number(listing.monthlyRent)
      : null,
    advanceAmount: listing.advanceAmountVisible
      ? Number(listing.advanceAmount)
      : null,
    securityDeposit: listing.securityDepositVisible
      ? Number(listing.securityDeposit)
      : null,
    serviceCharge: listing.serviceChargeVisible
      ? Number(listing.serviceCharge)
      : null,
    serviceChargeIncluded: listing.serviceChargeIncluded,
    parkingCharge: listing.parkingChargeVisible
      ? Number(listing.parkingCharge)
      : null,
    parkingChargeIncluded: listing.parkingChargeIncluded,
    utilityCharge: listing.utilityChargeVisible
      ? Number(listing.utilityCharge)
      : null,
    utilityChargeIncluded: listing.utilityChargeIncluded,
    availableFrom: listing.availableFrom,
    preferredTenant: listing.preferredTenant,
    hasInternet: listing.hasInternet,
    otherFacilities: listing.otherFacilities,
    imageUrls,
    videoUrl: listing.videoUrl ?? property.videoUrl,
    visibility: listing.visibility,
    marketplaceStatus: marketplaceStatus ?? "available",
    bookedAt: listing.closedAt,
    marketplaceVisibleUntil: marketplaceStartedAt
      ? toLetListingVisibleUntil(marketplaceStartedAt)
      : null,
    viewCount: listing.viewCount,
    publishedAt: listing.publishedAt,
    property: {
      name: property.name,
      propertyType: property.propertyType,
      buildingType: property.buildingType,
      coverImageUrl: property.coverImageUrl,
      division: property.division,
      district: property.district,
      area: property.area,
      nearbyLandmark: property.nearbyLandmark,
      latitude: property.latitude,
      longitude: property.longitude,
      hasParking: property.hasParking,
      hasLift: property.hasLift,
      hasSecurityGuard: property.hasSecurityGuard,
      hasCctv: property.hasCctv,
      hasGenerator: property.hasGenerator,
      hasWaterSupply: property.hasWaterSupply,
      hasGasConnection: property.hasGasConnection,
      hasElectricity: property.hasElectricity,
    },
    unit: {
      name: unit.name,
      unitType: unit.unitType,
      floorNumber: unit.floorNumber,
      sizeSqFt: unit.sizeSqFt,
      bedrooms: unit.bedrooms,
      bathrooms: unit.bathrooms,
      balconies: unit.balconies,
      hasDrawingRoom: unit.hasDrawingRoom,
      hasDiningSpace: unit.hasDiningSpace,
      hasKitchen: unit.hasKitchen,
      isFurnished: unit.isFurnished,
    },
    contact: {
      name: property.ownerName,
      phone: property.mobileNumber,
    },
    location: [property.area, property.district, property.division].join(", "),
  };
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

async function findOwnedListing(
  userId: string,
  propertyCode: string,
  unitCode: string,
  listingCode: string,
) {
  const propertyIdentity = parsePropertyCode(propertyCode);
  const unitPublicNumber = parseUnitCode(unitCode);
  const listingPublicNumber = parseListingCode(listingCode);
  const [owned] = await db
    .select({
      listing: toletUnitListing,
      unit: toletUnit,
      property: toletProperty,
    })
    .from(toletUnitListing)
    .innerJoin(toletUnit, eq(toletUnitListing.unitId, toletUnit.id))
    .innerJoin(toletProperty, eq(toletUnit.propertyId, toletProperty.id))
    .where(
      and(
        eq(toletUnitListing.publicNumber, listingPublicNumber),
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
    formatUnitCode(owned.unit) !== unitCode ||
    formatListingCode(owned.listing) !== listingCode
  ) {
    throw new ORPCError("NOT_FOUND", { message: "Listing not found" });
  }
  return owned;
}

function assertListingWritable(row: JoinedListing) {
  if (row.property.status === "blocked") {
    throw new ORPCError("FORBIDDEN", {
      message: "This property is blocked and its listing cannot be changed",
    });
  }
  if (row.property.status === "inactive") {
    throw new ORPCError("CONFLICT", {
      message: "This property registration has been deleted",
    });
  }
  if (row.listing.status === "closed") {
    throw new ORPCError("CONFLICT", {
      message: "This listing is closed and cannot be changed",
    });
  }
}

type PublicDetailInput = { listingCode: string; qrToken?: string };

function publicDetailScope(input: PublicDetailInput, now = new Date()) {
  const publicNumber = parseListingCode(input.listingCode);
  if (formatListingCode({ publicNumber }) !== input.listingCode) {
    throw new ORPCError("NOT_FOUND", { message: "Listing not found" });
  }
  return and(
    eq(toletUnitListing.publicNumber, publicNumber),
    eq(toletProperty.status, "active"),
    input.qrToken
      ? and(
          eq(toletProperty.qrToken, input.qrToken),
          eq(toletUnitListing.status, "active"),
          eq(toletUnit.status, "vacant"),
        )
      : and(
          eq(toletUnitListing.visibility, "public"),
          publicMarketplaceListingScope(now),
        ),
  );
}

async function readPublicListing(input: PublicDetailInput) {
  const now = new Date();
  const [row] = await db
    .select({
      listing: toletUnitListing,
      unit: toletUnit,
      property: toletProperty,
    })
    .from(toletUnitListing)
    .innerJoin(toletUnit, eq(toletUnitListing.unitId, toletUnit.id))
    .innerJoin(toletProperty, eq(toletUnit.propertyId, toletProperty.id))
    .where(publicDetailScope(input, now))
    .limit(1);
  if (!row) throw new ORPCError("NOT_FOUND", { message: "Listing not found" });
  return publicListingDto(row, now);
}

export const toLetUnitListingRouter = {
  listMine: consumerProcedure
    .route({
      method: "GET",
      path: "/to-let/owner/posts",
      tags: ["To-Let Unit Listing"],
      summary: "List the current user's latest To-Let post for every Unit",
    })
    .handler(async ({ context }) => {
      const rows = await db
        .select({
          listing: toletUnitListing,
          unit: toletUnit,
          property: toletProperty,
        })
        .from(toletUnitListing)
        .innerJoin(toletUnit, eq(toletUnitListing.unitId, toletUnit.id))
        .innerJoin(toletProperty, eq(toletUnit.propertyId, toletProperty.id))
        .where(
          and(
            eq(toletProperty.ownerUserId, context.session.user.id),
            ne(toletProperty.status, "inactive"),
            ne(toletUnit.status, "inactive"),
          ),
        )
        .orderBy(desc(toletUnitListing.createdAt))
        .limit(500);

      const latestRows = rows.filter(
        (row, index, allRows) =>
          allRows.findIndex(
            (candidate) => candidate.unit.id === row.unit.id,
          ) === index,
      );
      const now = new Date();

      return {
        posts: latestRows.map((row) => {
          const marketplaceStatus = toLetMarketplaceStatus(
            {
              listingStatus: row.listing.status,
              unitStatus: row.unit.status,
              publishedAt: row.listing.publishedAt,
              createdAt: row.listing.createdAt,
              closedAt: row.listing.closedAt,
            },
            now,
          );
          const marketplaceStartedAt =
            marketplaceStatus === "booked"
              ? row.listing.closedAt
              : (row.listing.publishedAt ?? row.listing.createdAt);
          const managementStatus =
            row.unit.status === "occupied"
              ? "contract"
              : row.unit.status === "booked"
                ? "booked"
                : row.listing.status;

          return {
            ...ownerListingDto(row.listing),
            propertyCode: formatPropertyCode(row.property),
            propertyName: row.property.name,
            qrToken: row.property.qrToken,
            location: [
              row.property.area,
              row.property.district,
              row.property.division,
            ].join(", "),
            unitCode: formatUnitCode(row.unit),
            unitName: row.unit.name,
            unitType: row.unit.unitType,
            unitStatus: row.unit.status,
            managementStatus,
            marketplaceStatus,
            marketplaceVisibleUntil: marketplaceStartedAt
              ? toLetListingVisibleUntil(marketplaceStartedAt)
              : null,
          };
        }),
      };
    }),

  getForUnit: consumerProcedure
    .route({
      method: "GET",
      path: "/to-let/owner/properties/{propertyCode}/units/{unitCode}/listing",
      tags: ["To-Let Unit Listing"],
      summary: "Get the current listing for an owned unit",
    })
    .input(listingOwnerIdentitySchema)
    .handler(async ({ context, input }) => {
      const owned = await findOwnedUnit(
        context.session.user.id,
        input.propertyCode,
        input.unitCode,
      );
      const [listing] = await db
        .select()
        .from(toletUnitListing)
        .where(
          and(
            eq(toletUnitListing.unitId, owned.unit.id),
            ne(toletUnitListing.status, "closed"),
          ),
        )
        .orderBy(desc(toletUnitListing.createdAt))
        .limit(1);

      return { listing: listing ? ownerListingDto(listing) : null };
    }),

  create: consumerProcedure
    .route({
      method: "POST",
      path: "/to-let/owner/properties/{propertyCode}/units/{unitCode}/listing",
      tags: ["To-Let Unit Listing"],
      summary: "Create a draft listing for an owned unit",
    })
    .input(createListingInputSchema)
    .handler(async ({ context, input }) => {
      const owned = await findOwnedUnit(
        context.session.user.id,
        input.propertyCode,
        input.unitCode,
      );
      if (owned.property.status !== "active") {
        throw new ORPCError("CONFLICT", {
          message: "Only an active property can create a listing",
        });
      }
      if (owned.unit.status !== "vacant") {
        throw new ORPCError("CONFLICT", {
          message: "Only a vacant unit can create a listing",
        });
      }

      try {
        const [created] = await db
          .insert(toletUnitListing)
          .values({
            ...listingWriteValues(input.data),
            unitId: owned.unit.id,
            status: "draft",
          })
          .returning();
        if (!created) {
          throw new ORPCError("INTERNAL_SERVER_ERROR", {
            message: "Listing creation failed",
          });
        }
        return { listing: ownerListingDto(created) };
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw new ORPCError("CONFLICT", {
            message: "This unit already has an open listing",
          });
        }
        throw error;
      }
    }),

  update: consumerProcedure
    .route({
      method: "PUT",
      path: "/to-let/owner/properties/{propertyCode}/units/{unitCode}/listing/{listingCode}",
      tags: ["To-Let Unit Listing"],
      summary: "Update an owned unit listing",
    })
    .input(updateListingInputSchema)
    .handler(async ({ context, input }) => {
      const owned = await findOwnedListing(
        context.session.user.id,
        input.propertyCode,
        input.unitCode,
        input.listingCode,
      );
      assertListingWritable(owned);

      const [updated] = await db
        .update(toletUnitListing)
        .set({ ...listingWriteValues(input.data), updatedAt: new Date() })
        .where(eq(toletUnitListing.id, owned.listing.id))
        .returning();
      if (!updated) {
        throw new ORPCError("NOT_FOUND", { message: "Listing not found" });
      }
      return { listing: ownerListingDto(updated) };
    }),

  publish: consumerProcedure
    .route({
      method: "POST",
      path: "/to-let/owner/properties/{propertyCode}/units/{unitCode}/listing/{listingCode}/publish",
      tags: ["To-Let Unit Listing"],
      summary: "Publish an owned unit listing",
    })
    .input(listingMutationIdentitySchema)
    .handler(async ({ context, input }) => {
      const listingPublicNumber = parseListingCode(input.listingCode);
      const result = await db.transaction(async (tx) => {
        const [owned] = await tx
          .select({
            listing: toletUnitListing,
            unit: toletUnit,
            property: toletProperty,
          })
          .from(toletUnitListing)
          .innerJoin(toletUnit, eq(toletUnitListing.unitId, toletUnit.id))
          .innerJoin(toletProperty, eq(toletUnit.propertyId, toletProperty.id))
          .where(
            and(
              eq(toletUnitListing.publicNumber, listingPublicNumber),
              eq(toletProperty.ownerUserId, context.session.user.id),
            ),
          )
          .limit(1)
          .for("update");

        if (
          !owned ||
          formatPropertyCode(owned.property) !== input.propertyCode ||
          formatUnitCode(owned.unit) !== input.unitCode ||
          formatListingCode(owned.listing) !== input.listingCode
        ) {
          throw new ORPCError("NOT_FOUND", { message: "Listing not found" });
        }
        assertListingWritable(owned);
        if (owned.property.status !== "active") {
          throw new ORPCError("CONFLICT", {
            message: "Only an active property can publish a listing",
          });
        }
        if (owned.unit.status !== "vacant") {
          throw new ORPCError("CONFLICT", {
            message: "Only a vacant unit can publish a listing",
          });
        }
        if (owned.listing.imageUrls.length === 0) {
          throw new ORPCError("BAD_REQUEST", {
            message: "Add at least one listing photo before publishing",
          });
        }

        const now = new Date();
        const publishedAt = toLetPublishedAtForPublish(
          {
            listingStatus: owned.listing.status,
            visibility: owned.listing.visibility,
            publishedAt: owned.listing.publishedAt,
          },
          now,
        );
        const [published] = await tx
          .update(toletUnitListing)
          .set({
            status: "active",
            publishedAt,
            pausedAt: null,
            updatedAt: now,
          })
          .where(eq(toletUnitListing.id, owned.listing.id))
          .returning();
        if (!published) {
          throw new ORPCError("NOT_FOUND", { message: "Listing not found" });
        }
        return published;
      });

      return { listing: ownerListingDto(result) };
    }),

  pause: consumerProcedure
    .route({
      method: "POST",
      path: "/to-let/owner/properties/{propertyCode}/units/{unitCode}/listing/{listingCode}/pause",
      tags: ["To-Let Unit Listing"],
      summary: "Pause an active owned unit listing",
    })
    .input(listingMutationIdentitySchema)
    .handler(async ({ context, input }) => {
      const owned = await findOwnedListing(
        context.session.user.id,
        input.propertyCode,
        input.unitCode,
        input.listingCode,
      );
      assertListingWritable(owned);
      if (owned.listing.status !== "active") {
        throw new ORPCError("CONFLICT", {
          message: "Only an active listing can be paused",
        });
      }

      const now = new Date();
      const [paused] = await db
        .update(toletUnitListing)
        .set({ status: "paused", pausedAt: now, updatedAt: now })
        .where(
          and(
            eq(toletUnitListing.id, owned.listing.id),
            eq(toletUnitListing.status, "active"),
          ),
        )
        .returning();
      if (!paused) {
        throw new ORPCError("CONFLICT", {
          message: "The listing status changed before it could be paused",
        });
      }
      return { listing: ownerListingDto(paused) };
    }),

  markRented: consumerProcedure
    .route({
      method: "POST",
      path: "/to-let/owner/properties/{propertyCode}/units/{unitCode}/listing/{listingCode}/mark-rented",
      tags: ["To-Let Unit Listing"],
      summary: "Mark an active owned listing as booked through an offline deal",
    })
    .input(listingMutationIdentitySchema)
    .handler(async ({ context, input }) => {
      const propertyIdentity = parsePropertyCode(input.propertyCode);
      const unitPublicNumber = parseUnitCode(input.unitCode);
      const listingPublicNumber = parseListingCode(input.listingCode);

      const result = await db.transaction(async (tx) => {
        const [owned] = await tx
          .select({
            listing: toletUnitListing,
            unit: toletUnit,
            property: toletProperty,
          })
          .from(toletUnitListing)
          .innerJoin(toletUnit, eq(toletUnitListing.unitId, toletUnit.id))
          .innerJoin(toletProperty, eq(toletUnit.propertyId, toletProperty.id))
          .where(
            and(
              eq(toletUnitListing.publicNumber, listingPublicNumber),
              eq(toletUnit.publicNumber, unitPublicNumber),
              eq(toletProperty.publicNumber, propertyIdentity.publicNumber),
              eq(toletProperty.ownerUserId, context.session.user.id),
            ),
          )
          .limit(1)
          .for("update");

        if (
          !owned ||
          owned.property.createdAt.getFullYear() !== propertyIdentity.year ||
          formatPropertyCode(owned.property) !== input.propertyCode ||
          formatUnitCode(owned.unit) !== input.unitCode ||
          formatListingCode(owned.listing) !== input.listingCode
        ) {
          throw new ORPCError("NOT_FOUND", { message: "Listing not found" });
        }
        if (owned.property.status !== "active") {
          throw new ORPCError("CONFLICT", {
            message: "Only an active property can mark a listing as booked",
          });
        }
        if (owned.unit.status !== "vacant") {
          throw new ORPCError("CONFLICT", {
            message: "Only a vacant unit can be marked as booked",
          });
        }
        if (owned.listing.status !== "active") {
          throw new ORPCError("CONFLICT", {
            message: "Only an active listing can be marked as rented",
          });
        }

        const [acceptedBooking] = await tx
          .select({ id: toletBookingRequest.id })
          .from(toletBookingRequest)
          .where(
            and(
              eq(toletBookingRequest.listingId, owned.listing.id),
              eq(toletBookingRequest.status, "accepted"),
            ),
          )
          .limit(1)
          .for("update");
        if (acceptedBooking) {
          throw new ORPCError("CONFLICT", {
            message:
              "This listing already has an accepted online booking request",
          });
        }

        const now = new Date();
        const [bookedUnit] = await tx
          .update(toletUnit)
          .set({ status: "booked", updatedAt: now })
          .where(
            and(
              eq(toletUnit.id, owned.unit.id),
              eq(toletUnit.status, "vacant"),
            ),
          )
          .returning();
        if (!bookedUnit) {
          throw new ORPCError("CONFLICT", {
            message: "The unit status changed before it could be marked rented",
          });
        }

        const [closedListing] = await tx
          .update(toletUnitListing)
          .set({ status: "closed", closedAt: now, updatedAt: now })
          .where(
            and(
              eq(toletUnitListing.id, owned.listing.id),
              eq(toletUnitListing.status, "active"),
            ),
          )
          .returning();
        if (!closedListing) {
          throw new ORPCError("CONFLICT", {
            message: "The listing status changed before it could be closed",
          });
        }

        await tx
          .update(toletBookingRequest)
          .set({
            status: "rejected",
            responseNote: "The owner marked this offline deal as booked",
            respondedAt: now,
            updatedAt: now,
          })
          .where(
            and(
              eq(toletBookingRequest.listingId, owned.listing.id),
              eq(toletBookingRequest.status, "pending"),
            ),
          );

        return { listing: closedListing, unit: bookedUnit };
      });

      return {
        listing: ownerListingDto(result.listing),
        unit: {
          unitCode: formatUnitCode(result.unit),
          status: result.unit.status,
        },
      };
    }),

  reactivateUnit: consumerProcedure
    .route({
      method: "POST",
      path: "/to-let/owner/properties/{propertyCode}/units/{unitCode}/reactivate",
      tags: ["To-Let Unit Listing"],
      summary: "Return a safely offline-booked owned unit to vacant status",
    })
    .input(listingOwnerIdentitySchema)
    .handler(async ({ context, input }) => {
      const propertyIdentity = parsePropertyCode(input.propertyCode);
      const unitPublicNumber = parseUnitCode(input.unitCode);

      const unit = await db.transaction(async (tx) => {
        const [owned] = await tx
          .select({ unit: toletUnit, property: toletProperty })
          .from(toletUnit)
          .innerJoin(toletProperty, eq(toletUnit.propertyId, toletProperty.id))
          .where(
            and(
              eq(toletUnit.publicNumber, unitPublicNumber),
              eq(toletProperty.publicNumber, propertyIdentity.publicNumber),
              eq(toletProperty.ownerUserId, context.session.user.id),
            ),
          )
          .limit(1)
          .for("update");

        if (
          !owned ||
          owned.property.createdAt.getFullYear() !== propertyIdentity.year ||
          formatPropertyCode(owned.property) !== input.propertyCode ||
          formatUnitCode(owned.unit) !== input.unitCode
        ) {
          throw new ORPCError("NOT_FOUND", { message: "Unit not found" });
        }
        if (owned.property.status !== "active") {
          throw new ORPCError("CONFLICT", {
            message: "Only a unit in an active property can be reactivated",
          });
        }
        if (owned.unit.status !== "booked") {
          throw new ORPCError("CONFLICT", {
            message: "Only an offline-booked unit can be reactivated",
          });
        }

        const [latestClosedListing] = await tx
          .select({ id: toletUnitListing.id })
          .from(toletUnitListing)
          .where(
            and(
              eq(toletUnitListing.unitId, owned.unit.id),
              eq(toletUnitListing.status, "closed"),
            ),
          )
          .orderBy(desc(toletUnitListing.publicNumber))
          .limit(1)
          .for("update");
        if (!latestClosedListing) {
          throw new ORPCError("CONFLICT", {
            message: "The Unit's latest booking cycle could not be verified",
          });
        }

        const [acceptedBooking] = await tx
          .select({ id: toletBookingRequest.id })
          .from(toletBookingRequest)
          .where(
            and(
              eq(toletBookingRequest.listingId, latestClosedListing.id),
              eq(toletBookingRequest.status, "accepted"),
            ),
          )
          .limit(1)
          .for("update");
        if (acceptedBooking) {
          throw new ORPCError("CONFLICT", {
            message:
              "This unit has an accepted online booking and cannot use offline reactivation",
          });
        }

        const [currentRental] = await tx
          .select({ id: toletRentalContract.id })
          .from(toletRentalContract)
          .where(
            and(
              eq(toletRentalContract.unitId, owned.unit.id),
              ne(toletRentalContract.status, "completed"),
            ),
          )
          .limit(1)
          .for("update");
        if (currentRental) {
          throw new ORPCError("CONFLICT", {
            message: "This unit has an active rental contract",
          });
        }

        const [openListing] = await tx
          .select({ id: toletUnitListing.id })
          .from(toletUnitListing)
          .where(
            and(
              eq(toletUnitListing.unitId, owned.unit.id),
              ne(toletUnitListing.status, "closed"),
            ),
          )
          .limit(1)
          .for("update");
        if (openListing) {
          throw new ORPCError("CONFLICT", {
            message: "Close the unit's current listing before reactivation",
          });
        }

        const [reactivated] = await tx
          .update(toletUnit)
          .set({ status: "vacant", updatedAt: new Date() })
          .where(
            and(
              eq(toletUnit.id, owned.unit.id),
              eq(toletUnit.status, "booked"),
            ),
          )
          .returning();
        if (!reactivated) {
          throw new ORPCError("CONFLICT", {
            message: "The unit status changed before it could be reactivated",
          });
        }
        return reactivated;
      });

      return {
        unit: {
          unitCode: formatUnitCode(unit),
          status: unit.status,
        },
      };
    }),

  listPublic: publicProcedure
    .route({
      method: "GET",
      path: "/to-let/marketplace/listings",
      tags: ["To-Let Marketplace"],
      summary: "List current public unit listings for the To-Let marketplace",
    })
    .handler(async () => {
      const now = new Date();
      const rows = await db
        .select({
          listing: toletUnitListing,
          unit: toletUnit,
          property: toletProperty,
        })
        .from(toletUnitListing)
        .innerJoin(toletUnit, eq(toletUnitListing.unitId, toletUnit.id))
        .innerJoin(toletProperty, eq(toletUnit.propertyId, toletProperty.id))
        .where(
          and(
            eq(toletUnitListing.visibility, "public"),
            publicMarketplaceListingScope(now),
            eq(toletProperty.status, "active"),
          ),
        )
        .orderBy(
          desc(toletUnitListing.publishedAt),
          desc(toletUnitListing.createdAt),
        )
        .limit(300);

      return { listings: rows.map((row) => publicListingDto(row, now)) };
    }),

  getPublicByCode: publicProcedure
    .route({
      method: "GET",
      path: "/to-let/marketplace/listings/{listingCode}",
      tags: ["To-Let Marketplace"],
      summary: "Read a public listing",
    })
    .input(z.object({ listingCode: listingCodeSchema }).strict())
    .handler(async ({ input }) => ({
      listing: await readPublicListing(input),
    })),

  getQrListingByCode: publicProcedure
    .route({
      method: "GET",
      path: "/to-let/qr/properties/{qrToken}/listings/{listingCode}",
      tags: ["To-Let Property QR"],
      summary: "Read an available QR listing",
    })
    .input(
      z
        .object({ qrToken: qrTokenSchema, listingCode: listingCodeSchema })
        .strict(),
    )
    .handler(async ({ input }) => ({
      listing: await readPublicListing(input),
    })),

  recordListingView: publicProcedure
    .route({
      method: "POST",
      path: "/to-let/listing-views",
      tags: ["To-Let Marketplace"],
      summary: "Record a displayed listing",
    })
    .input(
      z
        .object({
          listingCode: listingCodeSchema,
          qrToken: qrTokenSchema.optional(),
        })
        .strict(),
    )
    .handler(async ({ input }) => {
      const eligible = db
        .select({ id: toletUnitListing.id })
        .from(toletUnitListing)
        .innerJoin(toletUnit, eq(toletUnitListing.unitId, toletUnit.id))
        .innerJoin(toletProperty, eq(toletUnit.propertyId, toletProperty.id))
        .where(publicDetailScope(input));
      const [viewed] = await db
        .update(toletUnitListing)
        .set({
          viewCount: sql`${toletUnitListing.viewCount} + 1`,
          updatedAt: sql`${toletUnitListing.updatedAt}`,
        })
        .where(inArray(toletUnitListing.id, eligible))
        .returning({ viewCount: toletUnitListing.viewCount });
      if (!viewed)
        throw new ORPCError("NOT_FOUND", { message: "Listing not found" });
      return viewed;
    }),

  getQrProperty: publicProcedure
    .route({
      method: "GET",
      path: "/to-let/qr/properties/{qrToken}",
      tags: ["To-Let Property QR"],
      summary: "Get active listings through a permanent property QR token",
    })
    .input(z.object({ qrToken: qrTokenSchema }).strict())
    .handler(async ({ input }) => {
      const property = await db.query.toletProperty.findFirst({
        where: and(
          eq(toletProperty.qrToken, input.qrToken),
          eq(toletProperty.status, "active"),
        ),
      });
      if (!property) {
        throw new ORPCError("NOT_FOUND", { message: "Property not found" });
      }

      const rows = await db
        .select({
          listing: toletUnitListing,
          unit: toletUnit,
          property: toletProperty,
        })
        .from(toletUnitListing)
        .innerJoin(toletUnit, eq(toletUnitListing.unitId, toletUnit.id))
        .innerJoin(toletProperty, eq(toletUnit.propertyId, toletProperty.id))
        .where(
          and(
            eq(toletProperty.id, property.id),
            eq(toletUnitListing.status, "active"),
            eq(toletUnit.status, "vacant"),
            eq(toletProperty.status, "active"),
          ),
        )
        .orderBy(asc(toletUnit.floorNumber), asc(toletUnit.name));

      return {
        property: {
          propertyCode: formatPropertyCode(property),
          name: property.name,
          propertyType: property.propertyType,
          buildingType: property.buildingType,
          coverImageUrl: property.coverImageUrl,
          area: property.area,
          district: property.district,
          division: property.division,
          nearbyLandmark: property.nearbyLandmark,
        },
        listings: rows.map((row) => publicListingDto(row)),
      };
    }),
};
