import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

const runDatabaseIntegration =
  process.env.RUN_ADMIN_USER_OVERVIEW_DB_TEST === "1";

test(
  "request filters and pagination match recorded application and account data",
  { skip: !runDatabaseIntegration },
  async () => {
    const [{ db }, routerModule] = await Promise.all([
      import("@bikalpo-project/db"),
      import("./admin-application"),
    ]);
    const { adminApplicationRouter: router } = routerModule;
    const relations = {
      user: { columns: { banned: true } },
      productType: { columns: { name: true } },
    } as const;
    const columns = {
      id: true,
      userId: true,
      applicationNumber: true,
      ownerName: true,
      phoneNumber: true,
      district: true,
      area: true,
      businessCategory: true,
      status: true,
      createdAt: true,
    } as const;
    const [seller, warehouse, kyc] = await Promise.all([
      db.query.sellerApplication.findMany({
        columns: { ...columns, shopName: true },
        with: relations,
      }),
      db.query.warehouseApplication.findMany({
        columns: { ...columns, warehouseName: true },
        with: relations,
      }),
      db.query.kycVerification.findMany({
        columns: { id: true, userId: true, status: true, createdAt: true },
      }),
    ]);
    const latestKyc = new Map<string, string>();
    for (const row of kyc.sort(
      (a, b) =>
        b.createdAt.getTime() - a.createdAt.getTime() ||
        b.id.localeCompare(a.id),
    )) {
      if (!latestKyc.has(row.userId)) latestKyc.set(row.userId, row.status);
    }
    const recorded = [
      ...seller.map((row) => ({
        ...row,
        type: "seller",
        businessName: row.shopName,
      })),
      ...warehouse.map((row) => ({
        ...row,
        type: "warehouse",
        businessName: row.warehouseName,
      })),
    ]
      .map((row) => ({
        ...row,
        location: row.district || row.area || null,
        productTypeName: row.productType?.name || row.businessCategory || null,
        suspended: row.user.banned === true,
        verified: latestKyc.get(row.userId) === "verified",
      }))
      .sort(
        (a, b) =>
          b.createdAt.getTime() - a.createdAt.getTime() ||
          a.type.localeCompare(b.type) ||
          a.id.localeCompare(b.id),
      );
    type Filters = {
      status?: string;
      type?: string;
      businessType?: string;
      district?: string;
      search?: string;
    };
    const category =
      recorded.find((row) => row.productTypeName)?.productTypeName ?? undefined;
    const location =
      recorded.find((row) => row.location)?.location ?? undefined;
    const scenarios: Filters[] = [
      ...["all", "active", "verified", "pending", "suspended"].map(
        (status) => ({ status }),
      ),
      { type: "seller" },
      { type: "warehouse" },
      { businessType: category },
      { district: location },
      { businessType: category, district: location, status: "active" },
      { search: recorded[0]?.applicationNumber ?? "no-existing-application" },
      { search: "%" },
      { search: "_" },
    ];
    for (const filters of scenarios) {
      const expected = recorded.filter((row) => {
        if (
          filters.status === "active" &&
          (row.status !== "approved" || row.suspended)
        )
          return false;
        if (filters.status === "verified" && (!row.verified || row.suspended))
          return false;
        if (
          filters.status === "pending" &&
          (row.status !== "pending" || row.suspended)
        )
          return false;
        if (filters.status === "suspended" && !row.suspended) return false;
        if (filters.type && row.type !== filters.type) return false;
        if (
          filters.businessType &&
          row.productTypeName !== filters.businessType
        )
          return false;
        if (filters.district && row.location !== filters.district) return false;
        return (
          !filters.search ||
          [
            row.applicationNumber,
            row.ownerName,
            row.phoneNumber,
            row.businessName,
          ].some((value) =>
            value?.toLowerCase().includes(filters.search!.toLowerCase()),
          )
        );
      });
      const overview = await invokeProcedure<{
        total: number;
        suspended: number;
        frozen: null;
      }>(router.getOverview, {}, filters);
      assert.equal(overview.total, expected.length, JSON.stringify(filters));
      assert.equal(
        overview.suspended,
        expected.filter((row) => row.suspended).length,
      );
      assert.equal(overview.frozen, null);
      for (const page of new Set([
        1,
        Math.max(1, Math.ceil(expected.length / 3)),
      ])) {
        const list = await invokeProcedure<{
          items: { id: string; productTypeName: string | null }[];
          total: number;
        }>(router.list, {}, { ...filters, page, limit: 3 });
        assert.equal(list.total, expected.length);
        assert.deepEqual(
          list.items.map((row) => row.id),
          expected.slice((page - 1) * 3, page * 3).map((row) => row.id),
        );
        assert.deepEqual(
          list.items.map((row) => row.productTypeName),
          expected
            .slice((page - 1) * 3, page * 3)
            .map((row) => row.productTypeName),
        );
      }
    }
    const options = await invokeProcedure<{
      businessTypes: string[];
      districts: string[];
    }>(router.getFilterOptions, {}, {});
    assert.deepEqual(
      new Set(options.businessTypes),
      new Set(recorded.map((row) => row.productTypeName).filter(Boolean)),
    );
    assert.deepEqual(
      new Set(options.districts),
      new Set(recorded.map((row) => row.location).filter(Boolean)),
    );
  },
);

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
  "approval KPI counts match the filtered application list",
  { skip: !runDatabaseIntegration },
  async () => {
    const [{ db }, schema, drizzle, routerModule] = await Promise.all([
      import("@bikalpo-project/db"),
      import("@bikalpo-project/db/schema"),
      import("drizzle-orm"),
      import("./admin-application"),
    ]);
    const { kycVerification, sellerApplication, user, warehouseApplication } =
      schema;
    const { inArray } = drizzle;
    const { adminApplicationRouter } = routerModule;
    const suffix = randomUUID();
    const shopApplicantId = `approval-shop-${suffix}`;
    const warehouseApplicantId = `approval-warehouse-${suffix}`;
    const legacyApplicantId = `approval-legacy-${suffix}`;
    const adminId = `approval-admin-${suffix}`;
    const ids = [
      shopApplicantId,
      warehouseApplicantId,
      legacyApplicantId,
      adminId,
    ];
    const district = `Approval District ${suffix}`;
    const adminContext = {
      session: { user: { id: adminId, role: "admin" } },
    };

    try {
      await db.insert(user).values([
        {
          id: shopApplicantId,
          name: `Manufacturer Applicant ${suffix}`,
          email: `${shopApplicantId}@example.test`,
          role: "consumer",
        },
        {
          id: warehouseApplicantId,
          name: `Wholesaler Applicant ${suffix}`,
          email: `${warehouseApplicantId}@example.test`,
          role: "consumer",
        },
        {
          id: adminId,
          name: `Approval Admin ${suffix}`,
          email: `${adminId}@example.test`,
          role: "admin",
        },
        {
          id: legacyApplicantId,
          name: `Legacy Applicant ${suffix}`,
          email: `${legacyApplicantId}@example.test`,
          role: "consumer",
        },
      ]);
      await db.insert(sellerApplication).values({
        id: `approval-shop-app-${suffix}`,
        userId: shopApplicantId,
        applicationNumber: `APPROVAL-SHOP-${suffix}`,
        shopName: `Manufacturer ${suffix}`,
        ownerName: `Manufacturer Applicant ${suffix}`,
        phoneNumber: `shop-${suffix}`,
        businessType: "retail",
        shopAddress: district,
        district,
        businessNature: "manufacturer",
        status: "pending",
      });
      await db.insert(warehouseApplication).values({
        id: `approval-warehouse-app-${suffix}`,
        userId: warehouseApplicantId,
        applicationNumber: `APPROVAL-WAREHOUSE-${suffix}`,
        warehouseName: `Wholesaler ${suffix}`,
        ownerName: `Wholesaler Applicant ${suffix}`,
        phoneNumber: `warehouse-${suffix}`,
        warehouseAddress: district,
        district,
        businessNature: "wholesaler",
        businessCategory: "Bulk Grocery",
        referralId: `referral-${suffix}`,
        status: "pending",
      });
      await db.insert(sellerApplication).values({
        id: `approval-legacy-app-${suffix}`,
        userId: legacyApplicantId,
        applicationNumber: `APPROVAL-LEGACY-${suffix}`,
        shopName: `Legacy Shop ${suffix}`,
        ownerName: `Legacy Applicant ${suffix}`,
        phoneNumber: `legacy-${suffix}`,
        businessType: "retail",
        shopAddress: district,
        district,
        businessNature: null,
        status: "pending",
      });

      const filters = {
        search: suffix,
        status: "pending",
        type: "warehouse",
        businessNature: "wholesaler",
        district,
        referral: "invited",
        page: 1,
        limit: 20,
      } as const;
      const overview = await invokeProcedure<{
        total: number;
        pending: number;
        approved: number;
        rejected: number;
        pendingShopOwner: number;
        pendingWarehouseOwner: number;
      }>(adminApplicationRouter.getOverview, adminContext, filters);
      const list = await invokeProcedure<{
        items: Array<{
          id: string;
          type: string;
          businessNature: string | null;
          productTypeName: string | null;
        }>;
        total: number;
      }>(adminApplicationRouter.list, adminContext, filters);

      assert.deepEqual(overview, {
        total: 1,
        pending: 1,
        approved: 0,
        rejected: 0,
        suspended: 0,
        frozen: null,
        pendingShopOwner: 0,
        pendingWarehouseOwner: 1,
      });
      assert.equal(list.total, 1);
      assert.equal(list.items[0]?.type, "warehouse");
      assert.equal(list.items[0]?.businessNature, "wholesaler");
      assert.equal(list.items[0]?.productTypeName, "Bulk Grocery");

      const legacyFilters = {
        search: suffix,
        status: "pending",
        type: "seller",
        businessNature: "unspecified",
        district,
        referral: "direct",
        page: 1,
        limit: 20,
      } as const;
      const legacyOverview = await invokeProcedure<{ total: number }>(
        adminApplicationRouter.getOverview,
        adminContext,
        legacyFilters,
      );
      const legacyList = await invokeProcedure<{
        items: Array<{ id: string; businessNature: string | null }>;
        total: number;
      }>(adminApplicationRouter.list, adminContext, legacyFilters);
      assert.equal(legacyOverview.total, 1);
      assert.equal(legacyList.total, 1);
      assert.equal(legacyList.items[0]?.businessNature, null);

      const pendingUsers = await db.query.user.findMany({
        where: inArray(user.id, [shopApplicantId, warehouseApplicantId]),
        columns: { id: true, role: true },
      });
      assert.deepEqual(
        new Set(pendingUsers.map((row) => row.role)),
        new Set(["consumer"]),
      );

      const [{ sellerApplicationRouter }, { warehouseApplicationRouter }] =
        await Promise.all([
          import("./seller-application"),
          import("./warehouse-application"),
        ]);
      await invokeProcedure(sellerApplicationRouter.approve, adminContext, {
        applicationId: `approval-shop-app-${suffix}`,
      });
      await invokeProcedure(warehouseApplicationRouter.approve, adminContext, {
        applicationId: `approval-warehouse-app-${suffix}`,
      });

      const approvedUsers = await db.query.user.findMany({
        where: inArray(user.id, [shopApplicantId, warehouseApplicantId]),
        columns: { id: true, role: true },
      });
      assert.equal(
        approvedUsers.find((row) => row.id === shopApplicantId)?.role,
        "shop_owner",
      );
      assert.equal(
        approvedUsers.find((row) => row.id === warehouseApplicantId)?.role,
        "warehouse",
      );

      const { adminUserManagementRouter } = await import(
        "./admin-user-management"
      );
      const approvedShopOwners = await invokeProcedure<{
        users: Array<{ id: string; accountStatus: string }>;
        pagination: { totalCount: number };
      }>(adminUserManagementRouter.list, adminContext, {
        role: "shop_owner",
        status: "active",
        kyc: "all",
        businessNature: "manufacturer",
        search: suffix,
        page: 1,
        pageSize: 20,
      });
      assert.equal(approvedShopOwners.pagination.totalCount, 1);
      assert.equal(approvedShopOwners.users[0]?.id, shopApplicantId);
      assert.equal(approvedShopOwners.users[0]?.accountStatus, "active");
    } finally {
      await db
        .delete(kycVerification)
        .where(
          inArray(kycVerification.userId, [
            shopApplicantId,
            warehouseApplicantId,
          ]),
        );
      await db
        .delete(sellerApplication)
        .where(inArray(sellerApplication.userId, ids));
      await db
        .delete(warehouseApplication)
        .where(inArray(warehouseApplication.userId, ids));
      await db.delete(user).where(inArray(user.id, ids));
    }
  },
);
