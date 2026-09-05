import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import dotenv from "dotenv";
import type { Context } from "../context";

dotenv.config({ path: "apps/server/.env" });

test(
  "public and QR listing reads are side-effect free; displayed views preserve freshness and access",
  {
    skip: process.env.RUN_TOLET_VIEWS_DB_TEST !== "1",
  },
  async () => {
    const [
      { db },
      { user, toletProperty, toletUnit, toletUnitListing },
      { eq },
      { createRouterClient },
      { toLetUnitListingRouter },
    ] = await Promise.all([
      import("@bikalpo-project/db"),
      import("@bikalpo-project/db/schema"),
      import("drizzle-orm"),
      import("@orpc/server"),
      import("./tolet-unit-listing"),
    ]);
    const ownerId = randomUUID(),
      propertyId = randomUUID(),
      unitId = randomUUID(),
      listingId = randomUUID(),
      qrToken = randomUUID();
    const now = new Date();
    const api = createRouterClient(toLetUnitListingRouter, {
      context: { session: null } as unknown as Context,
    });
    try {
      await db
        .insert(user)
        .values({
          id: ownerId,
          name: "View test",
          email: `${ownerId}@example.test`,
          role: "consumer",
        });
      await db.insert(toletProperty).values({
        id: propertyId,
        ownerUserId: ownerId,
        qrToken,
        name: "View test",
        ownerName: "Test",
        mobileNumber: "01700000000",
        propertyType: "residential",
        division: "Dhaka",
        district: "Dhaka",
        area: "Test",
        fullAddress: "Test",
        buildingType: "residential",
        totalFloors: 1,
        declaredTotalUnits: 1,
        coverImageUrl: "https://example.test/image.jpg",
        frontImageUrl: "https://example.test/image.jpg",
        phoneVerifiedAt: now,
        informationConfirmedAt: now,
        termsAcceptedAt: now,
        propertyPolicyAcceptedAt: now,
      });
      await db
        .insert(toletUnit)
        .values({
          id: unitId,
          propertyId,
          name: "Test",
          unitType: "flat",
          floorNumber: 1,
          sizeSqFt: 500,
        });
      const [listing] = await db
        .insert(toletUnitListing)
        .values({
          id: listingId,
          unitId,
          title: "View test",
          monthlyRent: "10000",
          availableFrom: "2026-09-01",
          status: "active",
          visibility: "public",
          publishedAt: now,
          updatedAt: now,
        })
        .returning();
      const input = {
        listingCode: `LST-${String(listing.publicNumber).padStart(6, "0")}`,
      };
      assert.equal((await api.getPublicByCode(input)).listing.viewCount, 0);
      assert.equal((await api.getPublicByCode(input)).listing.viewCount, 0);
      assert.equal((await api.recordListingView(input)).viewCount, 1);
      const [viewed] = await db
        .select()
        .from(toletUnitListing)
        .where(eq(toletUnitListing.id, listingId));
      assert.equal(viewed.updatedAt.getTime(), now.getTime());
      await db
        .update(toletUnitListing)
        .set({ visibility: "qr_only" })
        .where(eq(toletUnitListing.id, listingId));
      await assert.rejects(api.getPublicByCode(input), { code: "NOT_FOUND" });
      await assert.rejects(api.recordListingView(input), { code: "NOT_FOUND" });
      assert.equal(
        (await api.getQrListingByCode({ ...input, qrToken })).listing.viewCount,
        1,
      );
      assert.equal(
        (await api.recordListingView({ ...input, qrToken })).viewCount,
        2,
      );
      await assert.rejects(
        api.recordListingView({ ...input, qrToken: randomUUID() }),
        { code: "NOT_FOUND" },
      );
      await db
        .update(toletUnit)
        .set({ status: "inactive" })
        .where(eq(toletUnit.id, unitId));
      await assert.rejects(api.getQrListingByCode({ ...input, qrToken }), {
        code: "NOT_FOUND",
      });
      await assert.rejects(api.recordListingView({ ...input, qrToken }), {
        code: "NOT_FOUND",
      });
    } finally {
      await db
        .delete(toletUnitListing)
        .where(eq(toletUnitListing.id, listingId));
      await db.delete(toletUnit).where(eq(toletUnit.id, unitId));
      await db.delete(toletProperty).where(eq(toletProperty.id, propertyId));
      await db.delete(user).where(eq(user.id, ownerId));
    }
  },
);
