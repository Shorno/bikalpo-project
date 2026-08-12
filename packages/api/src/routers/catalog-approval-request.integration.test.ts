import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import dotenv from "dotenv";

dotenv.config({ path: "apps/server/.env" });

const runDatabaseIntegration = process.env.RUN_CATALOG_REQUEST_DB_TEST === "1";

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
  "Warehouse and Shop Owner structured requests stay owner-scoped and approval creates a canonical option",
  { skip: !runDatabaseIntegration },
  async () => {
    const [{ db }, schema, drizzle, routerModule] = await Promise.all([
      import("@bikalpo-project/db"),
      import("@bikalpo-project/db/schema"),
      import("drizzle-orm"),
      import("./catalog-approval-request"),
    ]);
    const { catalogApprovalRequest, productType, user, variantOption } = schema;
    const { eq, inArray } = drizzle;
    const { adminCatalogApprovalRouter, catalogRequestRouter } = routerModule;
    const suffix = randomUUID();
    const shortSuffix = suffix.slice(0, 8);
    const warehouseId = `catalog-warehouse-${suffix}`;
    const shopId = `catalog-shop-${suffix}`;
    const adminId = `catalog-admin-${suffix}`;
    const userIds = [warehouseId, shopId, adminId];
    let createdVariantId: number | null = null;

    try {
      const type = await db.query.productType.findFirst({
        where: eq(productType.isActive, true),
      });
      assert.ok(type, "An active Product Type is required for this test");

      await db.insert(user).values([
        {
          id: warehouseId,
          name: "Catalog Warehouse",
          email: `${warehouseId}@example.test`,
          role: "warehouse",
        },
        {
          id: shopId,
          name: "Catalog Shop",
          email: `${shopId}@example.test`,
          role: "shop_owner",
        },
        {
          id: adminId,
          name: "Catalog Admin",
          email: `${adminId}@example.test`,
          role: "admin",
        },
      ]);

      const warehousePayload = {
        definition: {
          kind: "attribute" as const,
          attribute: "Request Test",
          value: `Warehouse ${shortSuffix}`,
        },
        typeId: type.id,
        categoryId: null,
      };
      const shopPayload = {
        definition: {
          kind: "attribute" as const,
          attribute: "Request Test",
          value: `Shop ${shortSuffix}`,
        },
        displayAlias: `Shop variant ${shortSuffix}`,
        typeId: type.id,
        categoryId: null,
      };

      const warehouseResult = await invokeProcedure<{
        request: { id: number };
      }>(
        catalogRequestRouter.createRequest,
        { session: { user: { id: warehouseId, role: "warehouse" } } },
        { requestType: "variant_option", payload: warehousePayload },
      );
      const shopResult = await invokeProcedure<{ request: { id: number } }>(
        catalogRequestRouter.createRequest,
        { session: { user: { id: shopId, role: "shop_owner" } } },
        { requestType: "variant_option", payload: shopPayload },
      );

      const warehouseHistory = await invokeProcedure<{
        requests: Array<{ id: number }>;
      }>(
        catalogRequestRouter.getMyRequests,
        { session: { user: { id: warehouseId, role: "warehouse" } } },
        { limit: 100 },
      );
      const shopHistory = await invokeProcedure<{
        requests: Array<{ id: number }>;
      }>(
        catalogRequestRouter.getMyRequests,
        { session: { user: { id: shopId, role: "shop_owner" } } },
        { limit: 100 },
      );
      assert.deepEqual(
        warehouseHistory.requests.map((request) => request.id),
        [warehouseResult.request.id],
      );
      assert.deepEqual(
        shopHistory.requests.map((request) => request.id),
        [shopResult.request.id],
      );

      const approval = await invokeProcedure<{
        created: {
          id: number;
          name: string;
          unit: string;
          size: string | null;
          variantType: string;
          definitionKind: string;
          definition: unknown;
          displayAlias: string | null;
          canonicalSignature: string | null;
          needsReview: boolean;
          typeId: number | null;
          categoryId: number | null;
          sortOrder: number;
          skuCode: string | null;
        };
      }>(
        adminCatalogApprovalRouter.approveRequest,
        { session: { user: { id: adminId, role: "admin" } } },
        {
          id: shopResult.request.id,
          requestType: "variant_option",
          payload: shopPayload,
        },
      );
      createdVariantId = approval.created.id;
      const expectedOperationalUnit =
        type.family === "fashion"
          ? "piece"
          : type.family === "footwear"
            ? "pair"
            : "unit";
      assert.equal(
        approval.created.name,
        `${shopPayload.definition.attribute} ${shopPayload.definition.value}`,
      );
      assert.equal(approval.created.unit, expectedOperationalUnit);
      assert.equal(approval.created.size, shopPayload.definition.value);
      assert.equal(approval.created.variantType, "pack");
      assert.equal(approval.created.definitionKind, "attribute");
      assert.deepEqual(approval.created.definition, {
        ...shopPayload.definition,
        operationalUnit: expectedOperationalUnit,
      });
      assert.equal(approval.created.displayAlias, shopPayload.displayAlias);
      assert.equal(
        approval.created.canonicalSignature,
        JSON.stringify({
          kind: "attribute",
          attribute: shopPayload.definition.attribute.toLowerCase(),
          value: shopPayload.definition.value.toLowerCase(),
        }),
      );
      assert.equal(approval.created.needsReview, false);
      assert.equal(approval.created.typeId, type.id);
      assert.equal(approval.created.categoryId, null);
      assert.equal(approval.created.sortOrder, 0);
      assert.match(approval.created.skuCode ?? "", /^\d{2}$/);

      const approvedRequest = await db.query.catalogApprovalRequest.findFirst({
        where: eq(catalogApprovalRequest.id, shopResult.request.id),
      });
      assert.equal(approvedRequest?.status, "approved");
      assert.equal(approvedRequest?.createdEntityId, approval.created.id);
      assert.equal(
        approvedRequest?.createdEntitySnapshot?.canonicalSignature,
        approval.created.canonicalSignature,
      );

      await invokeProcedure(
        adminCatalogApprovalRouter.rejectRequest,
        { session: { user: { id: adminId, role: "admin" } } },
        { id: warehouseResult.request.id, adminNote: "Not needed" },
      );
      const rejected = await db.query.catalogApprovalRequest.findFirst({
        where: eq(catalogApprovalRequest.id, warehouseResult.request.id),
      });
      assert.equal(rejected?.status, "rejected");
      assert.equal(rejected?.createdEntityId, null);
    } finally {
      if (createdVariantId) {
        await db
          .delete(variantOption)
          .where(eq(variantOption.id, createdVariantId));
      }
      await db
        .delete(catalogApprovalRequest)
        .where(
          inArray(catalogApprovalRequest.requestedBy, [warehouseId, shopId]),
        );
      await db.delete(user).where(inArray(user.id, userIds));
    }
  },
);
