import { db } from "@bikalpo-project/db";
import {
  toletBookingRequest,
  toletProperty,
  toletRentalContract,
  toletUnit,
  toletUnitListing,
} from "@bikalpo-project/db/schema";
import { ORPCError } from "@orpc/server";
import { count, desc, eq, ilike, inArray, or, type SQL } from "drizzle-orm";
import { z } from "zod";

import { adminProcedure } from "../index";

const unitCodeSchema = z
  .string()
  .trim()
  .regex(/^UNT-\d{6,10}$/, "Invalid Unit ID");

function padded(value: number) {
  return String(value).padStart(6, "0");
}

function unitCode(unit: { publicNumber: number }) {
  return `UNT-${padded(unit.publicNumber)}`;
}

function propertyCode(property: { publicNumber: number; createdAt: Date }) {
  return `PR-${property.createdAt.getFullYear()}-${padded(property.publicNumber)}`;
}

function listingCode(listing: { publicNumber: number }) {
  return `LST-${padded(listing.publicNumber)}`;
}

function searchCondition(query: string): SQL | undefined {
  const text = query.trim();
  if (!text) return undefined;
  const number = /^(?:UNT-|PR-20\d{2}-|LST-)?0*(\d{1,10})$/i.exec(text)?.[1];
  const pattern = `%${text.replace(/[%_\\]/g, "\\$&")}%`;
  return or(
    ilike(toletUnit.name, pattern),
    ilike(toletProperty.name, pattern),
    ilike(toletProperty.ownerName, pattern),
    ilike(toletProperty.mobileNumber, pattern),
    ...(number
      ? [
          eq(toletUnit.publicNumber, Number(number)),
          eq(toletProperty.publicNumber, Number(number)),
        ]
      : []),
  );
}

export const adminToLetUnitRouter = {
  list: adminProcedure
    .route({
      method: "GET",
      path: "/admin/to-let/units",
      tags: ["Admin To-Let"],
      summary: "List every To-Let unit with its property, listing and booking state",
    })
    .input(
      z
        .object({
          q: z.string().trim().max(100).default(""),
          limit: z.number().int().min(1).max(200).default(100),
        })
        .strict(),
    )
    .handler(async ({ input }) => {
      const rows = await db
        .select({ unit: toletUnit, property: toletProperty })
        .from(toletUnit)
        .innerJoin(toletProperty, eq(toletUnit.propertyId, toletProperty.id))
        .where(searchCondition(input.q))
        .orderBy(desc(toletUnit.createdAt))
        .limit(input.limit);

      const unitIds = rows.map(({ unit }) => unit.id);
      if (unitIds.length === 0) return { units: [] };

      const [listings, bookings, contracts] = await Promise.all([
        db
          .select({
            unitId: toletUnitListing.unitId,
            publicNumber: toletUnitListing.publicNumber,
            status: toletUnitListing.status,
          })
          .from(toletUnitListing)
          .where(inArray(toletUnitListing.unitId, unitIds))
          .orderBy(desc(toletUnitListing.createdAt)),
        db
          .select({
            unitId: toletUnitListing.unitId,
            status: toletBookingRequest.status,
            total: count(),
          })
          .from(toletBookingRequest)
          .innerJoin(
            toletUnitListing,
            eq(toletBookingRequest.listingId, toletUnitListing.id),
          )
          .where(inArray(toletUnitListing.unitId, unitIds))
          .groupBy(toletUnitListing.unitId, toletBookingRequest.status),
        db
          .select({
            unitId: toletRentalContract.unitId,
            status: toletRentalContract.status,
          })
          .from(toletRentalContract)
          .where(inArray(toletRentalContract.unitId, unitIds)),
      ]);

      return {
        units: rows.map(({ unit, property }) => {
          const unitListings = listings.filter((row) => row.unitId === unit.id);
          const latest = unitListings[0];
          const bookingCount = (status: string) =>
            bookings
              .filter((row) => row.unitId === unit.id && row.status === status)
              .reduce((sum, row) => sum + Number(row.total), 0);
          const unitContracts = contracts.filter((row) => row.unitId === unit.id);
          return {
            unitCode: unitCode(unit),
            name: unit.name,
            unitType: unit.unitType,
            status: unit.status,
            floorNumber: unit.floorNumber,
            sizeSqFt: unit.sizeSqFt,
            createdAt: unit.createdAt.toISOString(),
            property: {
              propertyCode: propertyCode(property),
              name: property.name,
              ownerName: property.ownerName,
              mobileNumber: property.mobileNumber,
              status: property.status,
            },
            latestListing: latest
              ? { listingCode: listingCode(latest), status: latest.status }
              : null,
            listingCount: unitListings.length,
            pendingBookings: bookingCount("pending"),
            acceptedBookings: bookingCount("accepted"),
            totalBookings: bookings
              .filter((row) => row.unitId === unit.id)
              .reduce((sum, row) => sum + Number(row.total), 0),
            contractCount: unitContracts.length,
            hasOngoingContract: unitContracts.some(
              (contract) =>
                contract.status === "active" || contract.status === "leaving",
            ),
          };
        }),
      };
    }),

  delete: adminProcedure
    .route({
      method: "DELETE",
      path: "/admin/to-let/units/{unitCode}",
      tags: ["Admin To-Let"],
      summary:
        "Permanently delete a To-Let unit with its listings, booking requests, contracts and rent payments",
    })
    .input(z.object({ unitCode: unitCodeSchema }).strict())
    .handler(async ({ input }) => {
      const publicNumber = Number(input.unitCode.slice(4));

      return db.transaction(async (tx) => {
        const [unit] = await tx
          .select({ id: toletUnit.id, publicNumber: toletUnit.publicNumber })
          .from(toletUnit)
          .where(eq(toletUnit.publicNumber, publicNumber))
          .limit(1)
          .for("update");
        if (!unit || unitCode(unit) !== input.unitCode) {
          throw new ORPCError("NOT_FOUND", { message: "Unit not found" });
        }

        const listingIds = (
          await tx
            .select({ id: toletUnitListing.id })
            .from(toletUnitListing)
            .where(eq(toletUnitListing.unitId, unit.id))
        ).map((row) => row.id);

        // Children first: every foreign key into these rows is ON DELETE RESTRICT.
        // Contracts cascade to rent payments and rental comments.
        const contracts = await tx
          .delete(toletRentalContract)
          .where(eq(toletRentalContract.unitId, unit.id))
          .returning({ id: toletRentalContract.id });
        const bookings = listingIds.length
          ? await tx
              .delete(toletBookingRequest)
              .where(inArray(toletBookingRequest.listingId, listingIds))
              .returning({ id: toletBookingRequest.id })
          : [];
        // Listings cascade to alert notifications.
        const listings = await tx
          .delete(toletUnitListing)
          .where(eq(toletUnitListing.unitId, unit.id))
          .returning({ id: toletUnitListing.id });
        const [deleted] = await tx
          .delete(toletUnit)
          .where(eq(toletUnit.id, unit.id))
          .returning({ id: toletUnit.id });
        if (!deleted) {
          throw new ORPCError("CONFLICT", {
            message: "The unit could not be deleted. Please try again.",
          });
        }

        return {
          success: true as const,
          unitCode: input.unitCode,
          deleted: {
            listings: listings.length,
            bookingRequests: bookings.length,
            contracts: contracts.length,
          },
        };
      });
    }),
};
