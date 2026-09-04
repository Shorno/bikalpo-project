import assert from "node:assert/strict";
import test from "node:test";
import { getTableColumns } from "drizzle-orm";

import { shopRole, shopUserRole } from "./shop-role";

test("maps shop role timestamps to the migrated snake-case columns", () => {
  const roleColumns = getTableColumns(shopRole);
  const assignmentColumns = getTableColumns(shopUserRole);

  assert.equal(roleColumns.createdAt.name, "created_at");
  assert.equal(roleColumns.updatedAt.name, "updated_at");
  assert.equal(assignmentColumns.createdAt.name, "created_at");
  assert.equal(assignmentColumns.updatedAt.name, "updated_at");
});
