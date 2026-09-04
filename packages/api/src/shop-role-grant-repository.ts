import { db } from "@bikalpo-project/db";
import {
  shopRole,
  shopRolePermission,
  shopUserRole,
} from "@bikalpo-project/db/schema";
import { and, eq } from "drizzle-orm";

import type { ShopRoleGrantRepository } from "./shop-authorization";

export const databaseShopRoleGrantRepository: ShopRoleGrantRepository = {
  async findAssignedRole(userId, shopId) {
    const [assignment] = await db
      .select({ roleId: shopRole.id, roleName: shopRole.name })
      .from(shopUserRole)
      .innerJoin(shopRole, eq(shopUserRole.roleId, shopRole.id))
      .where(
        and(
          eq(shopUserRole.userId, userId),
          eq(shopUserRole.shopId, shopId),
          eq(shopRole.shopId, shopId),
        ),
      )
      .limit(1);

    if (!assignment) return null;
    const rows = await db
      .select({
        resource: shopRolePermission.resource,
        actions: shopRolePermission.actions,
      })
      .from(shopRolePermission)
      .where(eq(shopRolePermission.roleId, assignment.roleId));

    return {
      id: assignment.roleId,
      name: assignment.roleName,
      permissions: Object.fromEntries(
        rows.map((row) => [row.resource, row.actions]),
      ),
    };
  },
};
