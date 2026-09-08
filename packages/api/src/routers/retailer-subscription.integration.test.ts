import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

type Procedure = {
  "~orpc": {
    handler(args: { context: unknown; input: unknown }): Promise<unknown>;
  };
};
function invoke<T>(procedure: unknown, shopId: string, input: unknown = {}) {
  return (procedure as Procedure)["~orpc"].handler({
    context: { session: { user: { id: shopId, role: "shop_owner" } } },
    input,
  }) as Promise<T>;
}

test(
  "retailer subscriptions persist, serialize purchases, and reject stale or unauthorized confirmations",
  {
    skip: process.env.RUN_RETAILER_SUBSCRIPTION_DB_TEST !== "1",
  },
  async () => {
    const [
      { db },
      schema,
      { and, eq, inArray },
      {
        retailerSubscriptionRouter: router,
        adminRetailerSubscriptionRouter: admin,
      },
      provisioning,
    ] = await Promise.all([
      import("@bikalpo-project/db"),
      import("@bikalpo-project/db/schema"),
      import("drizzle-orm"),
      import("./retailer-subscription"),
      import("@bikalpo-project/db/retailer-subscription-provisioning"),
    ]);
    const {
      user,
      sellerApplication,
      retailerSubscription: terms,
      retailerSubscriptionPlan: plans,
      retailerSubscriptionPurchase: purchases,
    } = schema;
    type Term = typeof terms.$inferSelect & {
      status: string;
      paymentStatus: string;
    };
    type Quote = typeof purchases.$inferSelect;
    const ids = Array.from(
      { length: 3 },
      () => `subscription-test-${randomUUID()}`,
    );
    const [owner, other, pending] = ids as [string, string, string];
    const testPlanCode = `test_${randomUUID().replaceAll("-", "")}`;
    const current = (id = owner) =>
      invoke<{ current: Term; plans: unknown[] }>(router.current, id);
    const quote = (planId: string, id = owner) =>
      invoke<Quote>(router.quote, id, { planId });
    const confirm = (q: Quote, key = randomUUID(), id = owner) =>
      invoke<Term>(router.confirm, id, {
        quoteId: q.id,
        idempotencyKey: key,
        acceptDummyPayment: true,
      });
    try {
      const { call } = await import("@orpc/server");
      assert.equal(router.current["~orpc"].route.method, "GET");
      assert.equal(admin.listPlans["~orpc"].route.method, "GET");
      await assert.rejects(
        call(router.current, undefined, {
          context: { session: null } as never,
        }),
        { code: "UNAUTHORIZED" },
      );
      await assert.rejects(
        call(admin.listPlans, undefined, {
          context: {
            session: { user: { id: owner, role: "shop_owner" } },
          } as never,
        }),
        { code: "FORBIDDEN" },
      );
      await assert.rejects(
        call(
          router.quote,
          { planId: "unused" },
          {
            context: {
              session: { user: { id: owner, role: "shop_staff" } },
            } as never,
          },
        ),
        { code: "FORBIDDEN" },
      );
      await db.insert(user).values(
        ids.map((id) => ({
          id,
          name: "Subscription test",
          email: `${id}@example.test`,
          role: "shop_owner",
          businessType: "retail",
          sellerStatus: id === pending ? "pending" : "approved",
        })),
      );
      await db.insert(sellerApplication).values(
        ids.map((id) => ({
          userId: id,
          shopName: "Subscription test",
          ownerName: "Test",
          phoneNumber: "01700000000",
          businessType: "retail",
          shopAddress: "Test address",
          status: id === pending ? "pending" : "approved",
        })),
      );
      assert.deepEqual(
        await db.transaction(provisioning.seedRetailerSubscriptionPlans),
        { created: 0, existing: 4 },
      );
      await db
        .transaction(async (tx) => {
          await provisioning.lockSubscriptionCatalog(tx);
          const before = await tx
            .select()
            .from(plans)
            .where(eq(plans.code, "monthly"));
          await tx
            .update(plans)
            .set({
              description: "Edited by admin",
              version: before[0]!.version + 1,
            })
            .where(eq(plans.code, "monthly"));
          await provisioning.seedRetailerSubscriptionPlans(tx);
          const [after] = await tx
            .select()
            .from(plans)
            .where(eq(plans.code, "monthly"));
          assert.equal(after?.description, "Edited by admin");
          assert.equal(after?.version, before[0]!.version + 1);
          throw new Error("intentional rollback");
        })
        .then(
          () => assert.fail("Expected rollback"),
          (error) => assert.match(error.message, /intentional rollback/),
        );

      assert.equal(
        await db.transaction((tx) =>
          provisioning.provisionRetailerFreeSubscription(
            tx,
            owner,
            "backfill",
            true,
          ),
        ),
        "created",
      );
      assert.equal(
        (await db.select().from(terms).where(eq(terms.shopId, owner))).length,
        0,
      );
      const provisioned = await Promise.all(
        [1, 2].map(() =>
          db.transaction((tx) =>
            provisioning.provisionRetailerFreeSubscription(
              tx,
              owner,
              "backfill",
            ),
          ),
        ),
      );
      assert.deepEqual(provisioned.sort(), ["created", "existing"]);
      await db.transaction((tx) =>
        provisioning.provisionRetailerFreeSubscription(tx, other, "backfill"),
      );
      assert.equal(
        await db.transaction((tx) =>
          provisioning.provisionRetailerFreeSubscription(
            tx,
            pending,
            "backfill",
          ),
        ),
        "ineligible",
      );
      const free = (await current()).current;
      const [duplicateApplication] = await db
        .insert(sellerApplication)
        .values({
          userId: owner,
          shopName: "Duplicate fixture",
          ownerName: "Test",
          phoneNumber: "01700000000",
          businessType: "retail",
          shopAddress: "Test",
          status: "approved",
          selectedPlan: "unknown_test_preference",
        })
        .returning();
      assert.equal(
        await db.transaction((tx) =>
          provisioning.provisionRetailerFreeSubscription(tx, owner, "backfill"),
        ),
        "ambiguous_application",
      );
      await assert.rejects(current(), /approved retail/i);
      const { seedRetailerSubscriptions } = await import(
        "@bikalpo-project/db/retailer-subscription-seed"
      );
      const preview = await seedRetailerSubscriptions(true);
      assert.ok(preview.anomalies.ambiguousApplicationOwnerIds.includes(owner));
      assert.ok(preview.anomalies.unknownPreferenceOwnerIds.includes(owner));
      await db
        .delete(sellerApplication)
        .where(eq(sellerApplication.id, duplicateApplication!.id));
      assert.equal(free.planCode, "free");
      assert.equal(free.expiresAt, null);
      assert.equal(free.autoRenew, false);
      assert.equal(free.nextBillingAt, null);
      assert.equal(free.paymentStatus, "Not required");

      const catalog = await db.select().from(plans);
      const monthly = catalog.find((p) => p.code === "monthly")!;
      const six = catalog.find((p) => p.code === "six_monthly")!;
      const yearly = catalog.find((p) => p.code === "yearly")!;
      const abandoned = await quote(monthly.id);
      assert.equal((await current()).current.id, free.id);
      await assert.rejects(
        confirm(abandoned, randomUUID(), other),
        /not found/i,
      );
      await assert.rejects(quote(monthly.id, pending), /approved retail/i);
      await db.update(user).set({ banned: true }).where(eq(user.id, owner));
      await assert.rejects(confirm(abandoned), /approved retail/i);
      await db.update(user).set({ banned: false }).where(eq(user.id, owner));
      for (const changes of [
        { role: "shop_staff" },
        { businessType: "restaurant" },
        { role: "warehouse" },
        { sellerStatus: "disabled" },
      ]) {
        await db.update(user).set(changes).where(eq(user.id, owner));
        await assert.rejects(quote(monthly.id), /approved retail/i);
        await db
          .update(user)
          .set({
            role: "shop_owner",
            businessType: "retail",
            sellerStatus: "approved",
          })
          .where(eq(user.id, owner));
      }
      const expiredQuote = await quote(monthly.id);
      await db
        .update(purchases)
        .set({ quoteExpiresAt: new Date(0) })
        .where(eq(purchases.id, expiredQuote.id));
      await assert.rejects(confirm(expiredQuote), /changed|expired/i);
      const stale = await quote(monthly.id);
      await db
        .update(purchases)
        .set({ planVersion: -1 })
        .where(eq(purchases.id, stale.id));
      await assert.rejects(confirm(stale), /changed/i);
      assert.equal((await current()).current.id, free.id);

      const key = randomUUID();
      // Force the final term insert to violate its check after the earlier writes.
      // The entire payment/activation transaction must roll back.
      const failedActivation = await quote(monthly.id);
      await db
        .update(purchases)
        .set({ planCode: "free" })
        .where(eq(purchases.id, failedActivation.id));
      await assert.rejects(confirm(failedActivation));
      assert.equal((await current()).current.id, free.id);
      const [rolledBackPayment] = await db
        .select()
        .from(purchases)
        .where(eq(purchases.id, failedActivation.id));
      assert.equal(rolledBackPayment!.confirmedAt, null);
      assert.equal(rolledBackPayment!.idempotencyKey, null);
      const bought = await confirm(abandoned, key);
      const replay = await confirm(abandoned, key);
      assert.equal(replay.id, bought.id);
      assert.equal(replay.startsAt.getTime(), bought.startsAt.getTime());
      assert.equal(bought.paymentStatus, "Paid (Dummy)");
      assert.equal(bought.amountMinor, monthly.amountMinor);
      assert.equal((await current()).current.id, bought.id);
      await assert.rejects(confirm(abandoned), /already confirmed/i);
      await assert.rejects(quote(monthly.id), /not available/i);
      const upgrade = await quote(six.id);
      const competing = await quote(yearly.id);
      await assert.rejects(confirm(upgrade, key), /different purchase/i);
      const raced = await Promise.allSettled([
        confirm(upgrade),
        confirm(competing),
      ]);
      assert.equal(raced.filter((r) => r.status === "fulfilled").length, 1);
      assert.equal(raced.filter((r) => r.status === "rejected").length, 1);
      const activeRows = await db
        .select()
        .from(terms)
        .where(and(eq(terms.shopId, owner), eq(terms.isCurrent, true)));
      assert.equal(activeRows.length, 1);
      assert.equal(
        await db.transaction((tx) =>
          provisioning.provisionRetailerFreeSubscription(tx, owner, "backfill"),
        ),
        "existing",
      );
      assert.equal((await current()).current.id, activeRows[0]!.id);
      await db
        .update(terms)
        .set({
          startsAt: new Date("2020-01-01"),
          expiresAt: new Date("2020-02-01"),
        })
        .where(eq(terms.id, activeRows[0]!.id));
      assert.equal((await current()).current.status, "Expired");
      assert.equal((await current()).current.paymentStatus, "Paid (Dummy)");
      const renewal = await confirm(await quote(monthly.id));
      assert.equal(renewal.status, "Active");
      assert.ok(renewal.startsAt.getFullYear() >= 2026);

      // An inactive custom plan exercises admin edits without changing the live offers.
      const data = {
        code: testPlanCode,
        name: "Test offer",
        description: "Test",
        durationMonths: 1,
        amountMinor: 123000,
        active: false,
        sortOrder: 10,
      };
      const created = await invoke<typeof plans.$inferSelect>(
        admin.createPlan,
        owner,
        data,
      );
      await assert.rejects(
        invoke(admin.updatePlan, owner, { id: created.id, version: 99, data }),
        /changed/i,
      );
      const edited = await invoke<typeof plans.$inferSelect>(
        admin.updatePlan,
        owner,
        {
          id: created.id,
          version: created.version,
          data: { ...data, name: "Updated offer" },
        },
      );
      assert.equal(edited.version, created.version + 1);
      await assert.rejects(
        invoke(admin.updatePlan, owner, {
          id: edited.id,
          version: edited.version,
          data: { ...data, active: true },
        }),
        /one active plan/i,
      );
      assert.equal((await current()).current.planName, renewal.planName);
      await assert.rejects(
        db.insert(plans).values({
          code: `${testPlanCode}_invalid`,
          name: "Invalid",
          durationMonths: null,
          amountMinor: 100,
          active: false,
        }),
      );
      const { approveSellerApplicationById } = await import(
        "./helpers/approve-application"
      );
      const [application] = await db
        .select()
        .from(sellerApplication)
        .where(eq(sellerApplication.userId, pending));
      await db.update(user).set({ banned: true }).where(eq(user.id, pending));
      await assert.rejects(
        approveSellerApplicationById(application!.id, { adminId: owner }),
        /could not be initialized/,
      );
      const [stillPending] = await db
        .select()
        .from(sellerApplication)
        .where(eq(sellerApplication.id, application!.id));
      assert.equal(stillPending!.status, "pending");
      await db.update(user).set({ banned: false }).where(eq(user.id, pending));
      await approveSellerApplicationById(application!.id, { adminId: owner });
      assert.equal((await current(pending)).current.source, "approval");
      await assert.rejects(
        approveSellerApplicationById(application!.id, { adminId: owner }),
        /already approved/,
      );
    } finally {
      // Remove only the explicitly created fixtures; cascades remove their own purchases/terms.
      try {
        await db
          .delete(sellerApplication)
          .where(inArray(sellerApplication.userId, ids));
        await db.delete(terms).where(inArray(terms.shopId, ids));
        await db.delete(purchases).where(inArray(purchases.shopId, ids));
        await db.delete(plans).where(eq(plans.code, testPlanCode));
        await db.delete(user).where(inArray(user.id, ids));
      } finally {
        await db.$client.end();
      }
    }
  },
);
