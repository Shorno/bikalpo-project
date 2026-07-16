import assert from "node:assert/strict";
import test from "node:test";
import { getTableColumns } from "drizzle-orm";
import { warehouseVariantAlias } from "./warehouse-variant-alias";

test("maps warehouse variant alias timestamps to snake_case columns", () => {
  const columns = getTableColumns(warehouseVariantAlias);

  assert.equal(columns.createdAt.name, "created_at");
  assert.equal(columns.updatedAt.name, "updated_at");
});
