import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

const runDatabaseIntegration =
  process.env.RUN_ADMIN_USER_OVERVIEW_DB_TEST === "1";

type ProcedureLike = {
  "~orpc": {
    handler(args: { context: unknown; input: unknown }): Promise<unknown>;
  };
};

async function invokeProcedure<Result>(
  procedure: unknown,
  context: unknown,
  input: unknown,
) {
  return (procedure as ProcedureLike)["~orpc"].handler({
    context,
    input,
  }) as Promise<Result>;
}

test(
  "role-user status, filters, and KPI counts share one canonical projection",
  { skip: !runDatabaseIntegration },
  async () => {
    const [{ db }, schema, drizzle, routerModule] = await Promise.all([
      import("@bikalpo-project/db"),
      import("@bikalpo-project/db/schema"),
      import("drizzle-orm"),
      import("./admin-user-management"),
    ]);
    const { kycVerification, user, warehouseApplication } = schema;
    const { eq, inArray } = drizzle;
    const { adminUserManagementRouter } = routerModule;
    const suffix = randomUUID();
    const warehouseId = `overview-warehouse-${suffix}`;
    const legacyShopId = `overview-shop-${suffix}`;
    const suspendedWarehouseId = `overview-suspended-${suffix}`;
    const newUnapprovedConsumerId = `overview-consumer-${suffix}`;
    const ids = [
      warehouseId,
      legacyShopId,
      suspendedWarehouseId,
      newUnapprovedConsumerId,
    ];
    const district = `Overview District ${suffix}`;
    const adminContext = {
      session: { user: { id: `overview-admin-${suffix}`, role: "admin" } },
    };

    try {
      await db.insert(user).values([
        {
          id: warehouseId,
          name: `Active Warehouse ${suffix}`,
          email: `${warehouseId}@example.test`,
          role: "warehouse",
          banned: false,
          sellerStatus: null,
          warehouseName: `Active Warehouse ${suffix}`,
          createdAt: new Date("2020-01-01T00:00:00.000Z"),
        },
        {
          id: legacyShopId,
          name: `Legacy Shop ${suffix}`,
          email: `${legacyShopId}@example.test`,
          role: "shop_owner",
          banned: false,
          sellerStatus: null,
          shopName: `Legacy Shop ${suffix}`,
        },
        {
          id: suspendedWarehouseId,
          name: `Suspended Warehouse ${suffix}`,
          email: `${suspendedWarehouseId}@example.test`,
          role: "warehouse",
          banned: true,
          sellerStatus: null,
          warehouseName: `Suspended Warehouse ${suffix}`,
        },
        {
          id: newUnapprovedConsumerId,
          name: `New Unapproved Consumer ${suffix}`,
          email: `${newUnapprovedConsumerId}@example.test`,
          role: "consumer",
          createdAt: new Date(),
        },
      ]);

      await db.insert(warehouseApplication).values([
        {
          id: `overview-app-active-${suffix}`,
          userId: warehouseId,
          applicationNumber: `OVERVIEW-ACTIVE-${suffix}`,
          warehouseName: `Active Warehouse ${suffix}`,
          ownerName: "Active Owner",
          phoneNumber: `active-${suffix}`,
          warehouseAddress: district,
          district,
          businessNature: "wholesaler",
          businessCategory: "Test Product Type",
          status: "approved",
          reviewedAt: new Date(),
        },
        {
          id: `overview-app-suspended-${suffix}`,
          userId: suspendedWarehouseId,
          applicationNumber: `OVERVIEW-SUSPENDED-${suffix}`,
          warehouseName: `Suspended Warehouse ${suffix}`,
          ownerName: "Suspended Owner",
          phoneNumber: `suspended-${suffix}`,
          warehouseAddress: district,
          district,
          businessNature: "distributor",
          status: "approved",
          reviewedAt: new Date(),
        },
      ]);

      await db.insert(kycVerification).values({
        id: `overview-kyc-${suffix}`,
        userId: warehouseId,
        status: "verified",
      });

      const activeList = await invokeProcedure<{
        users: Array<{
          id: string;
          accountStatus: string;
          businessNature: string | null;
          productTypeName: string | null;
        }>;
        pagination: { totalCount: number };
      }>(adminUserManagementRouter.list, adminContext, {
        role: "warehouse",
        status: "active",
        kyc: "verified",
        district,
        businessNature: "wholesaler",
        search: suffix,
        page: 1,
        pageSize: 20,
      });

      assert.equal(activeList.pagination.totalCount, 1);
      assert.deepEqual(activeList.users[0], {
        ...activeList.users[0],
        id: warehouseId,
        accountStatus: "active",
        businessNature: "wholesaler",
        productTypeName: "Test Product Type",
      });

      const warehouseStats = await invokeProcedure<{
        stats: {
          total: number;
          active: number;
          pendingRoleUsers: number;
          suspended: number;
          verifiedKyc: number;
        };
      }>(adminUserManagementRouter.getStats, adminContext, {
        role: "warehouse",
        status: "all",
        kyc: "verified",
        district,
        businessNature: "wholesaler",
        search: suffix,
      });

      assert.deepEqual(warehouseStats.stats, {
        total: 1,
        active: 1,
        pendingRoleUsers: 0,
        suspended: 0,
        verifiedKyc: 1,
      });

      const growth = await invokeProcedure<{
        points: Array<{ label: string; value: number }>;
        newApprovals: number;
        previousApprovals: number;
      }>(adminUserManagementRouter.getGrowthTrend, adminContext, {
        role: "warehouse",
        status: "active",
        kyc: "verified",
        district,
        businessNature: "wholesaler",
        search: suffix,
        days: 30,
      });

      assert.equal(growth.newApprovals, 1);
      assert.equal(growth.previousApprovals, 0);
      assert.equal(growth.points.length, 30);
      assert.equal(growth.points.at(-1)?.value, 1);

      const suspendedList = await invokeProcedure<{
        users: Array<{ id: string; accountStatus: string }>;
        pagination: { totalCount: number };
      }>(adminUserManagementRouter.list, adminContext, {
        role: "warehouse",
        status: "suspended",
        kyc: "all",
        district,
        businessNature: "distributor",
        search: suffix,
        page: 1,
        pageSize: 20,
      });

      assert.equal(suspendedList.pagination.totalCount, 1);
      assert.equal(suspendedList.users[0]?.id, suspendedWarehouseId);
      assert.equal(suspendedList.users[0]?.accountStatus, "suspended");

      const suspendedStats = await invokeProcedure<{
        stats: {
          total: number;
          active: number;
          pendingRoleUsers: number;
          suspended: number;
          verifiedKyc: number;
        };
      }>(adminUserManagementRouter.getStats, adminContext, {
        role: "warehouse",
        status: "suspended",
        kyc: "all",
        district,
        businessNature: "distributor",
        search: suffix,
      });

      assert.deepEqual(suspendedStats.stats, {
        total: 1,
        active: 0,
        pendingRoleUsers: 0,
        suspended: 1,
        verifiedKyc: 0,
      });

      const legacyList = await invokeProcedure<{
        users: Array<{
          id: string;
          accountStatus: string;
          businessNature: string | null;
        }>;
        pagination: { totalCount: number };
      }>(adminUserManagementRouter.list, adminContext, {
        role: "shop_owner",
        status: "active",
        kyc: "all",
        businessNature: "unspecified",
        search: suffix,
        page: 1,
        pageSize: 20,
      });

      assert.equal(legacyList.pagination.totalCount, 1);
      assert.equal(legacyList.users[0]?.id, legacyShopId);
      assert.equal(legacyList.users[0]?.accountStatus, "active");
      assert.equal(legacyList.users[0]?.businessNature, null);
    } finally {
      await db
        .delete(kycVerification)
        .where(eq(kycVerification.userId, warehouseId));
      await db
        .delete(warehouseApplication)
        .where(inArray(warehouseApplication.userId, ids));
      await db.delete(user).where(inArray(user.id, ids));
    }
  },
);

test(
  "admin phone edits keep phone-auth identity synchronized",
  { skip: !runDatabaseIntegration },
  async () => {
    const [{ db }, schema, drizzle, routerModule, phoneIdentity] =
      await Promise.all([
        import("@bikalpo-project/db"),
        import("@bikalpo-project/db/schema"),
        import("drizzle-orm"),
        import("./admin-user-management"),
        import("@bikalpo-project/auth/phone-identity"),
      ]);
    const { user } = schema;
    const { eq } = drizzle;
    const { adminUserManagementRouter } = routerModule;
    const { getPhoneAuthEmail } = phoneIdentity;
    const suffix = randomUUID();
    const numericSuffix = (BigInt(`0x${suffix.replaceAll("-", "")}`) % 100000000n)
      .toString()
      .padStart(8, "0");
    const userId = `phone-identity-${suffix}`;
    const originalPhone = `+88018${numericSuffix}`;
    const nextPhone = `+88019${numericSuffix}`;
    const nextLocalPhone = `019${numericSuffix}`;
    const adminContext = {
      session: { user: { id: `phone-admin-${suffix}`, role: "admin" } },
    };

    try {
      await db.insert(user).values({
        id: userId,
        name: "Phone Identity Consumer",
        email: getPhoneAuthEmail(originalPhone),
        role: "consumer",
        phoneNumber: originalPhone,
        phoneNumberVerified: true,
      });

      await invokeProcedure(
        adminUserManagementRouter.updateInfo,
        adminContext,
        { userId, phoneNumber: nextLocalPhone },
      );

      const updated = await db.query.user.findFirst({
        where: eq(user.id, userId),
        columns: {
          email: true,
          phoneNumber: true,
          phoneNumberVerified: true,
        },
      });
      assert.deepEqual(updated, {
        email: getPhoneAuthEmail(nextPhone),
        phoneNumber: nextPhone,
        phoneNumberVerified: false,
      });
    } finally {
      await db.delete(user).where(eq(user.id, userId));
    }
  },
);
