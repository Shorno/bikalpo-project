import assert from "node:assert/strict";
import test from "node:test";

test(
  "admin profile uses the current owner settings and scoped financial accounts",
  {
    skip: process.env.RUN_ADMIN_USER_OVERVIEW_DB_TEST !== "1",
  },
  async () => {
    const [
      { db },
      { adminUserManagementRouter: admin },
      { shopOwnerRouter: owner },
      { getUserFinancialAccounts },
    ] = await Promise.all([
      import("@bikalpo-project/db"),
      import("./admin-user-management"),
      import("./shop-owner"),
      import("./helpers/user-financial-accounts"),
    ]);
    try {
      // Read existing records only. Existing KYC avoids the admin read's legacy
      // initialization side effect; this check never creates profile/test data.
      const applications = await db.query.sellerApplication.findMany({
        columns: { userId: true },
        with: { user: { columns: { role: true } } },
      });
      const kyc = await db.query.kycVerification.findMany({
        columns: { userId: true },
      });
      const retailerId = applications.find(
        (application) =>
          application.user.role === "shop_owner" &&
          kyc.some((record) => record.userId === application.userId),
      )?.userId;
      assert.ok(
        retailerId,
        "An existing retailer with a saved profile and KYC is required",
      );
      const context = {
        session: { user: { id: retailerId, role: "shop_owner" } },
      };
      const profile = await owner.getMyRegistrationProfile["~orpc"].handler!({
        context,
        input: undefined,
      } as never);
      const detail = await admin.getById["~orpc"].handler!({
        context,
        input: { userId: retailerId },
      } as never);
      assert.equal(detail.applicationId, profile.application.id);
      for (const [field, value] of Object.entries(profile.application)) {
        assert.deepEqual(
          detail.application?.[field],
          value,
          `Saved settings field differs: ${field}`,
        );
      }
      assert.equal(detail.user.shopLogo, profile.account.shopLogo);
      assert.equal(detail.user.shopAddress, profile.account.shopAddress);

      const businessAccounts = await db.query.user.findMany({
        where: (table, { inArray }) =>
          inArray(table.role, ["shop_owner", "warehouse"]),
        columns: { id: true, role: true },
      });
      const recorded = await db.query.financePaymentAccount.findMany({
        columns: {
          id: true,
          ownerId: true,
          ownerType: true,
          type: true,
          name: true,
          providerName: true,
          accountNumber: true,
          isActive: true,
        },
      });
      for (const account of businessAccounts) {
        const actual = await getUserFinancialAccounts(account.id, account.role);
        const expected = recorded.filter(
          (payment) =>
            payment.ownerId === account.id &&
            payment.ownerType ===
              (account.role === "shop_owner" ? "shop" : "warehouse") &&
            payment.type !== "cash",
        );
        assert.deepEqual(
          actual.map((payment) => payment.id).sort(),
          expected.map((payment) => String(payment.id)).sort(),
        );
        for (const payment of actual) {
          const saved = expected.find((row) => String(row.id) === payment.id)!;
          assert.equal(payment.accountName, saved.name);
          assert.equal(payment.providerName, saved.providerName || saved.name);
          assert.equal(payment.accountNumber, saved.accountNumber);
          assert.equal(payment.isActive, saved.isActive);
        }
      }
      assert.deepEqual(
        detail.financialAccounts,
        await getUserFinancialAccounts(retailerId, "shop_owner"),
      );
      assert.deepEqual(
        await getUserFinancialAccounts(retailerId, "customer"),
        [],
      );
    } finally {
      await db.$client.end();
    }
  },
);
