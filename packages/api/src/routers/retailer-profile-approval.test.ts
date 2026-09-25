import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { db } from "@bikalpo-project/db";
import {
  kycVerification,
  type retailerSubscription,
  retailerSubscriptionPlan,
  sellerApplication,
  user,
} from "@bikalpo-project/db/schema";
import { retailerRegistrationProfileSchema } from "./helpers/retailer-profile-fields";
import { retailerSubscriptionRouter } from "./retailer-subscription";
import { shopOwnerRouter } from "./shop-owner";

function profileFixture(t: TestContext) {
  const input = retailerRegistrationProfileSchema.parse({
    business: {
      shopLogo: null,
      shopName: "Retail shop",
      businessType: "retail",
      productTypeId: null,
      businessNature: "retail_shop",
      yearsInBusiness: null,
      monthlyRevenue: null,
      binNumber: null,
      tinNumber: null,
      tradeLicenseNumber: null,
      shopAddress: "Dhaka shop address",
      division: "Dhaka",
      district: "Dhaka",
      thana: "Mirpur",
      area: "Mirpur 10",
      postCode: null,
      latitude: null,
      longitude: null,
    },
    contacts: {
      phoneNumber: "01700000000",
      email: null,
      whatsappNumber: null,
      facebookUrl: null,
      messengerUrl: null,
      instagramUrl: null,
      websiteUrl: null,
      telegramUrl: null,
      tiktokUrl: null,
      twitterUrl: null,
    },
    documents: {
      tradeLicense: "https://example.test/license.png",
      nid: "https://example.test/nid.png",
      shopPhoto: null,
      storeFront: null,
      warehouse: null,
    },
  });
  const owner = {
    id: "approved-retailer",
    role: "shop_owner",
    businessType: "retail",
    sellerStatus: "approved",
    banned: false,
    banExpires: null,
  };
  const application = {
    ...input.business,
    id: "approved-application",
    userId: owner.id,
    status: "approved",
    createdAt: new Date("2026-08-01T00:00:00Z"),
    reviewedAt: new Date("2026-09-01T00:00:00Z") as Date | null,
    reviewedBy: "admin" as string | null,
    documentUrls: {
      tradeLicense: input.documents.tradeLicense,
      nid: input.documents.nid,
    } as Partial<Record<keyof typeof input.documents, string | null>>,
  };
  const state = {
    subscription: undefined as
      | typeof retailerSubscription.$inferSelect
      | undefined,
    applicationPresent: true,
    approvedApplicationCount: 1,
  };
  const kycSubmissions: Record<string, unknown>[] = [];
  const update = (table: unknown) => ({
    set: (values: Record<string, unknown>) => ({
      where: async () => {
        assert.ok(table === user || table === sellerApplication);
        Object.assign(table === user ? owner : application, values);
      },
    }),
  });
  // Every database seam is mocked: the regression never modifies real accounts.
  t.mock.method(
    db.query.sellerApplication,
    "findFirst",
    async () => application,
  );
  t.mock.method(db, "transaction", async (work) =>
    work({
      update,
      insert: (table: unknown) => ({
        values: async (values: Record<string, unknown>) => {
          assert.equal(table, kycVerification);
          kycSubmissions.push(values);
        },
      }),
      select: () => ({
        from: (table: unknown) => ({
          where: () => {
            if (table === user) return Promise.resolve([owner]);
            assert.equal(table, retailerSubscriptionPlan);
            return { orderBy: async () => [] };
          },
        }),
      }),
      query: {
        sellerApplication: {
          findFirst: async () =>
            state.applicationPresent ? application : undefined,
          findMany: async () =>
            state.applicationPresent &&
            application.status === "approved" &&
            application.businessType === "retail"
              ? Array.from(
                  { length: state.approvedApplicationCount },
                  () => application,
                )
              : [],
        },
        retailerSubscription: { findFirst: async () => state.subscription },
      },
    }),
  );
  const context = { session: { user: owner } };
  const current = () =>
    retailerSubscriptionRouter.current["~orpc"].handler!({ context } as never);
  const save = () =>
    shopOwnerRouter.updateRegistrationProfile["~orpc"].handler!({
      context,
      input,
    } as never);
  const withPreviousApproval = () => {
    state.subscription = {
      id: "approval-subscription",
      shopId: owner.id,
      planId: "free-plan",
      purchaseId: null,
      planCode: "free",
      planName: "Free",
      durationMonths: null,
      amountMinor: 0,
      currency: "BDT",
      startsAt: new Date("2026-09-01T00:00:00Z"),
      expiresAt: null,
      isCurrent: true,
      supersededAt: null,
      source: "approval",
      autoRenew: false,
      nextBillingAt: null,
    };
  };
  return {
    owner,
    application,
    input,
    current,
    save,
    kycSubmissions,
    withPreviousApproval,
    state,
  };
}

test("completing an approved retailer's profile preserves subscription access", async (t) => {
  const fixture = profileFixture(t);
  await assert.doesNotReject(fixture.current);
  fixture.input.business.binNumber = "BIN-123456";
  await fixture.save();
  await assert.doesNotReject(fixture.current);
  assert.equal(fixture.application.status, "approved");
  assert.equal(fixture.application.reviewedBy, "admin");
  assert.deepEqual(
    fixture.application.reviewedAt,
    new Date("2026-09-01T00:00:00Z"),
  );
});

test("an ordinary contact edit preserves approval when blank registration fields normalize to null", async (t) => {
  const fixture = profileFixture(t);
  fixture.application.binNumber = "";
  fixture.input.contacts.email = "updated@example.test";
  await fixture.save();
  await assert.doesNotReject(fixture.current);
  assert.equal(fixture.application.status, "approved");
  assert.equal(fixture.application.reviewedBy, "admin");
});

test("an ordinary contact edit with identical stored values retains approval and KYC", async (t) => {
  const fixture = profileFixture(t);
  fixture.input.contacts.email = "updated@example.test";
  const result = await fixture.save();
  await assert.doesNotReject(fixture.current);
  assert.equal(result.verificationReset, false);
  assert.equal(fixture.application.status, "approved");
});

test("an already approved subscriber can load their plan after a legacy profile save reset the application", async (t) => {
  const fixture = profileFixture(t);
  fixture.withPreviousApproval();
  fixture.application.status = "pending";
  fixture.application.reviewedAt = null;
  fixture.application.reviewedBy = null;
  const result = await fixture.current();
  assert.equal(result.current?.planCode, "free");
  assert.equal(
    fixture.application.status,
    "pending",
    "Reading a subscription must not approve an application",
  );
});

test("changing a document requests KYC review without revoking account approval", async (t) => {
  const fixture = profileFixture(t);
  fixture.input.documents.nid = "https://example.test/replacement.png";
  const result = await fixture.save();
  assert.equal(result.verificationReset, true);
  assert.deepEqual(fixture.kycSubmissions, [
    { userId: fixture.owner.id, status: "pending" },
  ]);
  assert.equal(fixture.application.status, "approved");
  await assert.doesNotReject(fixture.current);
  const unchanged = await fixture.save();
  assert.equal(unchanged.verificationReset, false);
  assert.equal(fixture.kycSubmissions.length, 1);
});

test("subscription recovery does not admit unapproved, rejected, banned, or unrelated registrations", async (t) => {
  for (const scenario of [
    "never-approved",
    "rejected",
    "banned",
    "pending-account",
    "reviewed-pending",
    "new-registration",
    "missing-registration",
    "ambiguous-approval",
    "restaurant",
    "staff",
  ] as const) {
    await t.test(scenario, async (t) => {
      const fixture = profileFixture(t);
      fixture.application.status = "pending";
      fixture.application.reviewedAt = null;
      fixture.application.reviewedBy = null;
      if (scenario !== "never-approved") fixture.withPreviousApproval();
      if (scenario === "rejected") fixture.application.status = "rejected";
      if (scenario === "banned") fixture.owner.banned = true;
      if (scenario === "pending-account")
        fixture.owner.sellerStatus = "pending";
      if (scenario === "reviewed-pending")
        fixture.application.reviewedBy = "admin";
      if (scenario === "new-registration")
        fixture.application.createdAt = new Date("2026-09-02T00:00:00Z");
      if (scenario === "missing-registration")
        fixture.state.applicationPresent = false;
      if (scenario === "ambiguous-approval") {
        fixture.application.status = "approved";
        fixture.state.approvedApplicationCount = 2;
      }
      if (scenario === "restaurant") fixture.owner.businessType = "restaurant";
      if (scenario === "staff") fixture.owner.role = "shop_staff";
      await assert.rejects(
        fixture.current,
        /An approved retail shop owner account is required/,
      );
    });
  }
});

test("saving unchanged documents in database key order preserves verified KYC", async (t) => {
  const fixture = profileFixture(t);
  fixture.application.documentUrls = {
    nid: fixture.input.documents.nid,
    tradeLicense: fixture.input.documents.tradeLicense,
  };
  fixture.input.contacts.email = "updated@example.test";
  const result = await fixture.save();
  assert.equal(result.verificationReset, false);
  assert.deepEqual(fixture.kycSubmissions, []);
  await assert.doesNotReject(fixture.current);
});
